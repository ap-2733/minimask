import type { PositionInfo } from "./types.ts";

// ---------------------------------------------------------------------------
// nextEditable
// ---------------------------------------------------------------------------
// Scans forward from `from` and returns the index of the first editable slot,
// or null if no editable slot exists at or after that position.
// ---------------------------------------------------------------------------
export function getNextEditable(
  positions: PositionInfo[],
  from: number,
): number | null {
  for (let i = from; i < positions.length; i++) {
    if (positions[i].editable) {
      // Found an editable slot — return its index immediately.
      return i;
    }
  }
  // No editable slot found in the remaining positions.
  return null;
}
