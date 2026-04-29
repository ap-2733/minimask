import { useEffect, useMemo, useRef } from "react";
import type { UseMiniMaskOptions } from "./types.ts";
import { buildMask } from "./buildMask.ts";
import { getNextEditable } from "./getNextEditable.ts";
import { getPrevEditable } from "./getPrevEditable.ts";
import { clearRange } from "./clearRange.ts";

// ---------------------------------------------------------------------------
// useMiniMask
// ---------------------------------------------------------------------------
// React hook that attaches masked-input behaviour to an <input> element.
// The mask is read once on mount and never re-evaluated.
// Returns [ ref, getValue ]. Attach ref to the <input> via its `ref` prop
// unless you passed your own ref in options.
// ---------------------------------------------------------------------------
export function useMiniMask({
  mask,
  initialValue,
  ref: externalRef,
}: UseMiniMaskOptions) {
  const internalRef = useRef<HTMLInputElement>(null);
  // Prefer the caller-supplied ref so they can share the same ref object.
  const ref = externalRef ?? internalRef;

  // Build template and positions once; the empty dependency array means the
  // mask is intentionally treated as static for the lifetime of the component.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { template, positions } = useMemo(() => buildMask(mask), []);

  // Pre-fill editable slots from initialValue (same logic as paste: skip chars
  // that fail the slot's regexp, stop when slots run out).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialChars = useMemo(() => {
    const chars = [...template];
    let slot = getNextEditable(positions, 0);
    if (initialValue) {
      for (const char of initialValue) {
        if (slot === null) break;
        const info = positions[slot] as { editable: true; regexp: RegExp };
        if (info.regexp.test(char)) {
          chars[slot] = char;
          slot = getNextEditable(positions, slot + 1);
        }
      }
    }
    return chars;
  }, []);

  // Mutable character array that mirrors the current visible value of the input.
  // Stored in a ref, so updates inside the event handler never trigger re-renders.
  const charsRef = useRef(initialChars);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Bail out if the ref has not been attached to a DOM node yet.
    if (!ref.current) {
      return;
    }

    // Cache the DOM node in a local variable — TypeScript narrows its type here,
    // so we avoid repeated null-checks inside the nested handler function.
    const input = ref.current;

    // Stamp the initial masked value onto the input element.
    input.value = charsRef.current.join("");

    // -------------------------------------------------------------------------
    // handleBeforeInput
    // -------------------------------------------------------------------------
    // Central event handler. `beforeinput` fires before the browser mutates the
    // DOM, so cancelling it (e.preventDefault) lets us fully own the value.
    // -------------------------------------------------------------------------
    function handleBeforeInput(e: InputEvent) {
      // Prevent the browser from making any native change to the input value.
      e.preventDefault();

      // Read the current cursor position / selection boundaries.
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;

      // Whether the user has highlighted a range of characters.
      const hasSelection = start !== end;
      switch (e.inputType) {
        // -----------------------------------------------------------------------
        // insertText — user typed a single character
        // -----------------------------------------------------------------------
        case "insertText": {
          // Ignore the event if no character data was supplied.
          if (!e.data) {
            break;
          }

          // Find the nearest editable slot at or after the cursor.
          const slot = getNextEditable(positions, start);

          // If there are no more editable slots, silently discard the input.
          if (slot === null) {
            break;
          }

          // Retrieve the regexp for the target slot.
          const info = positions[slot] as { editable: true; regexp: RegExp };

          // Reject characters that do not satisfy the slot's validation regexp.
          if (!info.regexp.test(e.data)) {
            break;
          }

          // If a selection was active, erase all editable slots it covered first.
          if (hasSelection) {
            clearRange(charsRef.current, positions, start, end);
          }

          // Write the accepted character into the slot.
          charsRef.current[slot] = e.data;

          // Flush the updated character array back to the DOM.
          input.value = charsRef.current.join("");

          // Advance the cursor to the next editable slot after the one just filled,
          // or place it one position past the filled slot if no further slot exists.
          const next = getNextEditable(positions, slot + 1);
          input.setSelectionRange(next ?? slot + 1, next ?? slot + 1);
          break;
        }

        // -----------------------------------------------------------------------
        // deleteContentBackward — Backspace key
        // deleteContentForward  — Delete key
        // -----------------------------------------------------------------------
        case "deleteContentBackward":
        case "deleteContentForward": {
          if (hasSelection) {
            // When text is selected, clear all editable slots within the selection
            // instead of performing the usual single-character delete.
            clearRange(charsRef.current, positions, start, end);

            // Write the cleared value to the DOM.
            input.value = charsRef.current.join("");

            // Collapse the cursor to the start of the former selection.
            input.setSelectionRange(start, start);
          } else if (e.inputType === "deleteContentBackward") {
            // Backspace: find the nearest editable slot *before* the cursor.
            const prev = getPrevEditable(positions, start - 1);
            if (prev !== null) {
              // Replace that slot's character with a space (the "empty" sentinel).
              charsRef.current[prev] = " ";

              // Sync the DOM.
              input.value = charsRef.current.join("");

              // Move the cursor to the slot that was just cleared.
              input.setSelectionRange(prev, prev);
            }
          } else {
            // Delete key: find the nearest editable slot *at or after* the cursor.
            const cur = getNextEditable(positions, start);
            if (cur !== null) {
              // Clear the slot.
              charsRef.current[cur] = " ";

              // Sync the DOM.
              input.value = charsRef.current.join("");

              // Leave the cursor where it was (the cleared slot's position).
              input.setSelectionRange(cur, cur);
            }
          }
          break;
        }

        // -----------------------------------------------------------------------
        // insertFromPaste — user pasted text
        // -----------------------------------------------------------------------
        case "insertFromPaste": {
          // Retrieve the pasted string from the event or the DataTransfer object.
          const text = e.data ?? e.dataTransfer?.getData("text/plain") ?? "";

          // Nothing to do if the clipboard was empty.
          if (!text) {
            break;
          }

          // Start filling from the first editable slot at or after the cursor.
          let slot = getNextEditable(positions, start);

          // Iterate over every character in the pasted text.
          for (const char of text) {
            // Stop if we've run out of editable slots.
            if (slot === null) {
              break;
            }

            // Retrieve the regexp for the current target slot.
            const info = positions[slot] as { editable: true; regexp: RegExp };
            if (info.regexp.test(char)) {
              // Character matches — write it and advance to the next slot.
              charsRef.current[slot] = char;
              slot = getNextEditable(positions, slot + 1);
            }

            // Characters that fail the regexp test are silently skipped.
          }

          // Flush all changes to the DOM.
          input.value = charsRef.current.join("");

          // Place the cursor at the next unfilled slot or at the end of the mask
          // if all slots have been filled.
          input.setSelectionRange(
            slot ?? positions.length,
            slot ?? positions.length,
          );
          break;
        }

        // -----------------------------------------------------------------------
        // deleteByCut — user cut the selected text
        // -----------------------------------------------------------------------
        case "deleteByCut": {
          // Only act when there is an active selection to cut.
          if (hasSelection) {
            // Erase every editable slot within the selection range.
            clearRange(charsRef.current, positions, start, end);

            // Sync the cleared value to the DOM.
            input.value = charsRef.current.join("");

            // Collapse the cursor to the start of the former selection.
            input.setSelectionRange(start, start);
          }
          break;
        }

        // All other inputTypes (historyUndo, historyRedo, insertLineBreak,
        // insertFromDrop, etc.) are silently blocked by the e.preventDefault()
        // at the top of this handler — no further action is needed.
      }
    }

    // Register the handler on the input element.
    input.addEventListener("beforeinput", handleBeforeInput);

    // Return a cleanup function that removes the listener when the component unmounts.
    return () => input.removeEventListener("beforeinput", handleBeforeInput);
  }, []);

  /** Returns the current value of editable slots only, concatenated in order. Static literal characters are excluded. */
  function getValue() {
    return charsRef.current.filter((_, i) => positions[i].editable).join("");
  }

  return [ref, getValue] as const;
}
