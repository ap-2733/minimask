import type { PositionInfo } from "./types.ts";

// ---------------------------------------------------------------------------
// clearRange
// ---------------------------------------------------------------------------
// Replaces the content of every editable slot in [start, end) with a space,
// leaving static characters untouched.
// ---------------------------------------------------------------------------
export function clearRange(
  chars: string[],
  positions: PositionInfo[],
  start: number,
  end: number,
) {
  for (let i = start; i < end; i++) {
    // Only wipe positions that are editable — static characters are immutable.
    if (positions[i]?.editable) {
      chars[i] = " ";
    }
  }
}
