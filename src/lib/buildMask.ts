import type { PositionInfo } from "./types.ts";

// ---------------------------------------------------------------------------
// buildMask
// ---------------------------------------------------------------------------
// Converts the user-supplied mask array into two parallel data structures:
//   template – the initial string to display (spaces for editable slots, literals as-is)
//   positions – one PosInfo entry per character in the template
// ---------------------------------------------------------------------------
export function buildMask(mask: (RegExp | string)[]): {
  template: string;
  positions: PositionInfo[];
} {
  // Start with an empty template string and an empty positions array.
  let template = "";
  const positions: PositionInfo[] = [];

  // Walk every item in the mask definition array.
  for (const item of mask) {
    if (item instanceof RegExp) {
      // RegExp items represent a single editable character slot.
      // Represent it with a space in the initial template.
      template += " ";

      // Strip the global flag so that `regexp.test()` never has stale `lastIndex` state.
      const safeRegexp = item.global
        ? new RegExp(item.source, item.flags.replace("g", ""))
        : item;

      // Record this position as editable, storing the sanitized regexp.
      positions.push({ editable: true, regexp: safeRegexp });
    } else {
      // String items are literal text — copy them verbatim into the template.
      template += item;

      // Add one non-editable PosInfo entry for each character in the literal string.
      for (let i = 0; i < item.length; i++) {
        positions.push({ editable: false });
      }
    }
  }
  return { template, positions };
}
