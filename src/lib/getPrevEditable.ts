import type { PositionInfo } from "./types.ts";

// ---------------------------------------------------------------------------
// prevEditable
// ---------------------------------------------------------------------------
// Scans backward from `from` and returns the index of the nearest editable slot,
// or null if no editable slot exists at or before that position.
// ---------------------------------------------------------------------------
export function getPrevEditable(
  positions: PositionInfo[],
  from: number,
): number | null {
  for (let i = from; i >= 0; i--) {
    if (positions[i].editable) {
      // Found an editable slot — return its index immediately.
      return i;
    }
  }
  // No editable slot found before the starting position.
  return null;
}
