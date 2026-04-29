import type { RefObject } from "react";

// Each position in the mask is either an editable slot (with a regexp validator)
// or a static literal character that the user cannot modify.
export type PositionInfo =
  | { editable: true; regexp: RegExp }
  | { editable: false };

export interface UseMiniMaskOptions {
  /** Mask definition — each `RegExp` is one editable slot, each `string` is literal text. Read once on mount. */
  mask: (RegExp | string)[];
  /** Pre-fills editable slots on mount. Characters are matched left-to-right against each slot's regexp; non-matching characters are skipped. */
  initialValue?: string;
  /** Existing ref to use instead of the internally created one. Useful when the caller already holds a ref to the input for other purposes. */
  ref?: RefObject<HTMLInputElement | null>;
}
