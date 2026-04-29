import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useMiniMask } from "./lib/useMiniMask.ts";

// jsdom does not implement requestAnimationFrame
beforeAll(() => {
  (window as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function MaskedInput({ mask }: { mask: (RegExp | string)[] }) {
  const [ref] = useMiniMask({ mask });
  return <input ref={ref} />;
}

function MaskedInputWithGetValue({
  mask,
  initialValue,
  getValueRef,
}: {
  mask: (RegExp | string)[];
  initialValue?: string;
  getValueRef: { current: () => string };
}) {
  const [ref, getValue] = useMiniMask({ mask, initialValue });
  getValueRef.current = getValue;
  return <input ref={ref} />;
}

function getInput(): HTMLInputElement {
  return screen.getByRole("textbox") as HTMLInputElement;
}

/** Optionally reposition the cursor, then fire a beforeinput event. */
function fire(
  input: HTMLInputElement,
  inputType: string,
  data: string | null = null,
  selectionStart?: number,
  selectionEnd?: number,
) {
  if (selectionStart !== undefined) {
    input.setSelectionRange(selectionStart, selectionEnd ?? selectionStart);
  }
  act(() => {
    input.dispatchEvent(
      new InputEvent("beforeinput", {
        inputType,
        data,
        cancelable: true,
        bubbles: true,
      }),
    );
  });
}

const D = /[0-9]/; // digit slot
const A = /[a-z]/i; // alpha slot

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("initialization", () => {
  it("sets value to template: spaces for editable slots, literals for strings", () => {
    render(<MaskedInput mask={[D, "-", D, D]} />);
    expect(getInput().value).toBe(" -  ");
  });
});

describe("typing", () => {
  it("fills the slot at the cursor with a matching character", () => {
    render(<MaskedInput mask={[D, D, D]} />);
    const input = getInput();
    fire(input, "insertText", "4", 0);
    expect(input.value).toBe("4  ");
  });

  it("advances the cursor to the next editable slot, skipping static text", () => {
    render(<MaskedInput mask={[D, "-", D]} />);
    const input = getInput();
    fire(input, "insertText", "5", 0);
    expect(input.selectionStart).toBe(2); // '-' at 1 is skipped
  });

  it("leaves cursor after the last slot when all slots are filled", () => {
    render(<MaskedInput mask={[D, D]} />);
    const input = getInput();
    fire(input, "insertText", "1", 0);
    fire(input, "insertText", "2");
    expect(input.value).toBe("12");
    expect(input.selectionStart).toBe(2);
  });

  it("ignores a character that does not match the slot regexp", () => {
    render(<MaskedInput mask={[D]} />);
    const input = getInput();
    fire(input, "insertText", "a", 0);
    expect(input.value).toBe(" ");
    expect(input.selectionStart).toBe(0);
  });

  it("does nothing when cursor is past the last editable slot", () => {
    render(<MaskedInput mask={[D, "-"]} />);
    const input = getInput();
    fire(input, "insertText", "1", 2); // past the only editable slot
    expect(input.value).toBe(" -");
  });

  it("finds the next editable slot when cursor is on a static character", () => {
    render(<MaskedInput mask={[D, "-", D]} />);
    const input = getInput();
    fire(input, "insertText", "7", 1); // cursor on '-', next editable is position 2
    expect(input.value).toBe(" -7");
    expect(input.selectionStart).toBe(3);
  });

  it("clears the selection and types into the first slot at the selection start", () => {
    render(<MaskedInput mask={[D, D, D]} />);
    const input = getInput();
    fire(input, "insertText", "1", 0);
    fire(input, "insertText", "2");
    fire(input, "insertText", "3");
    input.setSelectionRange(0, 2); // select positions 0–1
    fire(input, "insertText", "9");
    expect(input.value).toBe("9 3");
    expect(input.selectionStart).toBe(1);
  });

  it("does not clear the selection if the typed character is rejected", () => {
    render(<MaskedInput mask={[D, D]} />);
    const input = getInput();
    fire(input, "insertText", "1", 0);
    fire(input, "insertText", "2");
    input.setSelectionRange(0, 2);
    fire(input, "insertText", "x"); // digit mask rejects 'x'
    expect(input.value).toBe("12"); // unchanged
  });
});

describe("backspace", () => {
  it("clears the previous editable slot and moves cursor there", () => {
    render(<MaskedInput mask={[D, D, D]} />);
    const input = getInput();
    fire(input, "insertText", "5", 0);
    fire(input, "deleteContentBackward"); // cursor now at 1
    expect(input.value).toBe("   ");
    expect(input.selectionStart).toBe(0);
  });

  it("skips static characters to find the previous editable slot", () => {
    render(<MaskedInput mask={[D, "-", D]} />);
    const input = getInput();
    fire(input, "insertText", "5", 0); // fills slot 0, cursor → 2
    fire(input, "deleteContentBackward", null, 1); // cursor on '-', should clear slot 0
    expect(input.value).toBe(" - ");
    expect(input.selectionStart).toBe(0);
  });

  it("does nothing when there is no editable slot before the cursor", () => {
    render(<MaskedInput mask={["+", D]} />);
    const input = getInput();
    fire(input, "deleteContentBackward", null, 1); // cursor right after '+', no editable before
    expect(input.value).toBe("+ ");
  });

  it("clears all editable slots in the selection instead of doing single-char delete", () => {
    render(<MaskedInput mask={[D, D, D]} />);
    const input = getInput();
    fire(input, "insertText", "1", 0);
    fire(input, "insertText", "2");
    fire(input, "insertText", "3");
    input.setSelectionRange(0, 2);
    fire(input, "deleteContentBackward");
    expect(input.value).toBe("  3");
    expect(input.selectionStart).toBe(0);
  });

  it("does not erase static characters when they are inside the selection", () => {
    render(<MaskedInput mask={[D, "-", D]} />);
    const input = getInput();
    fire(input, "insertText", "5", 0);
    fire(input, "insertText", "3", 2);
    input.setSelectionRange(0, 3);
    fire(input, "deleteContentBackward");
    expect(input.value).toBe(" - ");
  });
});

describe("delete", () => {
  it("clears the editable slot at the cursor", () => {
    render(<MaskedInput mask={[D, D, D]} />);
    const input = getInput();
    fire(input, "insertText", "5", 0);
    fire(input, "deleteContentForward", null, 0);
    expect(input.value).toBe("   ");
    expect(input.selectionStart).toBe(0);
  });

  it("skips static characters to find the next editable slot", () => {
    render(<MaskedInput mask={[D, "-", D]} />);
    const input = getInput();
    fire(input, "insertText", "5", 0);
    fire(input, "insertText", "3", 2);
    fire(input, "deleteContentForward", null, 1); // cursor on '-', clears next editable at 2
    expect(input.value).toBe("5- ");
    expect(input.selectionStart).toBe(2);
  });

  it("does nothing when there is no editable slot at or after the cursor", () => {
    render(<MaskedInput mask={[D, "!"]} />);
    const input = getInput();
    fire(input, "deleteContentForward", null, 2); // past the only editable slot
    expect(input.value).toBe(" !");
  });

  it("clears all editable slots in the selection instead of doing single-char delete", () => {
    render(<MaskedInput mask={[D, D, D]} />);
    const input = getInput();
    fire(input, "insertText", "1", 0);
    fire(input, "insertText", "2");
    fire(input, "insertText", "3");
    input.setSelectionRange(1, 3);
    fire(input, "deleteContentForward");
    expect(input.value).toBe("1  ");
    expect(input.selectionStart).toBe(1);
  });
});

describe("paste", () => {
  it("fills consecutive editable slots from the cursor position", () => {
    render(<MaskedInput mask={[D, D, D]} />);
    const input = getInput();
    fire(input, "insertFromPaste", "123", 0);
    expect(input.value).toBe("123");
  });

  it("starts filling from the cursor, not from the beginning", () => {
    render(<MaskedInput mask={[D, D, D]} />);
    const input = getInput();
    fire(input, "insertFromPaste", "45", 1);
    expect(input.value).toBe(" 45");
    expect(input.selectionStart).toBe(3);
  });

  it("skips pasted characters that do not match the slot regexp", () => {
    render(<MaskedInput mask={[D, D, D]} />);
    const input = getInput();
    fire(input, "insertFromPaste", "a1b2c3", 0);
    expect(input.value).toBe("123");
  });

  it("stops when all remaining slots are filled", () => {
    render(<MaskedInput mask={[D, D]} />);
    const input = getInput();
    fire(input, "insertFromPaste", "99999", 0);
    expect(input.value).toBe("99");
  });

  it("skips static characters between slots while pasting", () => {
    render(<MaskedInput mask={[D, "-", D, "-", D]} />);
    const input = getInput();
    fire(input, "insertFromPaste", "123", 0);
    expect(input.value).toBe("1-2-3");
  });
});

describe("cut", () => {
  it("clears editable slots in the selection", () => {
    render(<MaskedInput mask={[D, D, D]} />);
    const input = getInput();
    fire(input, "insertText", "1", 0);
    fire(input, "insertText", "2");
    fire(input, "insertText", "3");
    input.setSelectionRange(0, 2);
    fire(input, "deleteByCut");
    expect(input.value).toBe("  3");
    expect(input.selectionStart).toBe(0);
  });

  it("does not clear static characters in the selection", () => {
    render(<MaskedInput mask={[D, "-", D]} />);
    const input = getInput();
    fire(input, "insertText", "5", 0);
    fire(input, "insertText", "3", 2);
    input.setSelectionRange(0, 3);
    fire(input, "deleteByCut");
    expect(input.value).toBe(" - ");
  });

  it("does nothing when there is no selection", () => {
    render(<MaskedInput mask={[D, D]} />);
    const input = getInput();
    fire(input, "insertText", "7", 0);
    fire(input, "deleteByCut", null, 1); // no selection
    expect(input.value).toBe("7 ");
  });
});

describe("blocked input types", () => {
  it("blocks insertLineBreak", () => {
    render(<MaskedInput mask={[D]} />);
    fire(getInput(), "insertLineBreak", null, 0);
    expect(getInput().value).toBe(" ");
  });

  it("blocks historyUndo so mask state cannot be corrupted", () => {
    render(<MaskedInput mask={[D]} />);
    const input = getInput();
    fire(input, "insertText", "5", 0);
    fire(input, "historyUndo");
    expect(input.value).toBe("5");
  });

  it("blocks insertFromDrop", () => {
    render(<MaskedInput mask={[D, D]} />);
    const input = getInput();
    fire(input, "insertFromDrop", "12", 0);
    expect(input.value).toBe("  ");
  });
});

describe("multi-character static strings", () => {
  it("renders the full literal string in the template", () => {
    render(<MaskedInput mask={[D, D, " / ", D, D]} />);
    expect(getInput().value).toBe("   /   ");
  });

  it("typing skips the entire static string to reach the next slot", () => {
    render(<MaskedInput mask={[D, " -> ", D]} />);
    const input = getInput();
    fire(input, "insertText", "1", 0);
    expect(input.selectionStart).toBe(5); // skips ' -> '
    fire(input, "insertText", "2");
    expect(input.value).toBe("1 -> 2");
  });
});

describe("mixed regexp flags", () => {
  it("accepts both upper and lower case when regexp has i flag", () => {
    render(<MaskedInput mask={[A]} />);
    const input = getInput();
    fire(input, "insertText", "A", 0);
    expect(input.value).toBe("A");
  });

  it("strips global flag from regexp to avoid lastIndex state issues", () => {
    render(<MaskedInput mask={[/[0-9]/g, /[0-9]/g]} />);
    const input = getInput();
    fire(input, "insertText", "1", 0);
    fire(input, "insertText", "2");
    expect(input.value).toBe("12"); // would fail with stale lastIndex
  });
});

describe("getValue", () => {
  function setup(mask: (RegExp | string)[], initialValue?: string) {
    const getValueRef = { current: () => "" };
    render(
      <MaskedInputWithGetValue
        mask={mask}
        initialValue={initialValue}
        getValueRef={getValueRef}
      />,
    );
    return { input: getInput(), getValue: () => getValueRef.current() };
  }

  it("returns spaces for each editable slot and excludes static parts", () => {
    const { getValue } = setup([D, "-", D, D]);
    expect(getValue()).toBe("   ");
  });

  it("reflects a character typed into a slot", () => {
    const { input, getValue } = setup([D, D, D]);
    fire(input, "insertText", "7", 0);
    expect(getValue()).toBe("7  ");
  });

  it("excludes static literal strings from the returned value", () => {
    const { input, getValue } = setup([D, "-", D]);
    fire(input, "insertText", "1", 0);
    fire(input, "insertText", "2");
    expect(getValue()).toBe("12");
  });

  it("reflects the pre-filled initialValue on mount", () => {
    const { getValue } = setup([D, D, D], "42");
    expect(getValue()).toBe("42 ");
  });

  it("reflects edits made after an initialValue was applied", () => {
    const { input, getValue } = setup([D, D, D], "123");
    fire(input, "deleteContentBackward", null, 3); // erase slot 2
    expect(getValue()).toBe("12 ");
  });

  it("reflects a cleared slot after backspace", () => {
    const { input, getValue } = setup([D, D]);
    fire(input, "insertText", "5", 0);
    fire(input, "insertText", "9");
    fire(input, "deleteContentBackward"); // erase slot 1
    expect(getValue()).toBe("5 ");
  });

  it("reflects pasted characters and excludes static separators", () => {
    const { input, getValue } = setup([D, D, "-", D, D]);
    fire(input, "insertFromPaste", "1234", 0);
    expect(getValue()).toBe("1234");
  });

  it("reflects slots cleared by cut", () => {
    const { input, getValue } = setup([D, D, D]);
    fire(input, "insertFromPaste", "123", 0);
    input.setSelectionRange(0, 2);
    fire(input, "deleteByCut");
    expect(getValue()).toBe("  3");
  });
});
