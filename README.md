# useMiniMask

Extremely mininmal and lightweight (1kb minified and gzipped) React hook that constrains an uncontrolled `<input>` to a fixed mask defined as an array of `RegExp` (editable slot) and `string` (literal text) items.

## Installation

```bash
npm install minimask
```

React 19 or later is required as a peer dependency.

## Usage

```tsx
import { useMiniMask } from "minimask";

const PHONE_MASK = [
  "+1(", /\d/, /\d/, /\d]/, ")", /\d/, /\d/, /\d/, "-", /\d/, /\d/, "-", /\d/, /\d/,
];

function PhoneInput() {
  const { ref, getValue } = useMiniMask(PHONE_MASK);

  return (
    <input
      ref={ref}
      type="text"
      onBlur={() => console.log(getValue())}
    />
  );
}
```

Define the mask array outside the component (or with `useMemo`) — it is read once on mount and never re-evaluated.

## API

```ts
useMiniMask(options): { ref, getValue }
```

| Option | Type | Description |
| --- | --- | --- |
| `mask` | `(RegExp \| string)[]` | Mask definition. Read once on mount. |
| `initialValue` | `string` (optional) | Pre-fills editable slots on mount. Characters are matched left-to-right against each slot's regexp; non-matching characters are skipped. |
| `ref` | `RefObject<HTMLInputElement>` (optional) | Supply an existing ref to use instead of the internally created one. Useful when the caller already holds a ref to the input for other purposes. |

| Return | Type | Description |
| --- | --- | --- |
| `ref` | `RefObject<HTMLInputElement>` | The ref to attach to the `<input>`. Same object as the option ref when one is supplied. |
| `getValue` | `() => string` | Returns the current value of editable slots only, concatenated in order. Static literal characters are excluded. |

## Mask format

| Item | Meaning |
| --- | --- |
| `RegExp` | One editable character slot. Only characters matching the expression are accepted. |
| `string` | One or more literal characters. Displayed as-is, cannot be edited or deleted. |

Editable slots are initialized with spaces unless `initialValue` is supplied.

## Behaviour

- **Typing** — fills the next editable slot at or after the cursor that matches the regexp, then advances the cursor to the next editable slot.
- **Backspace / Delete** — clears the nearest editable slot behind / ahead of the cursor, replacing it with a space.
- **Selection** — the cursor can be placed anywhere, including inside static regions. Keyboard and mouse selection work natively. Operating on a selection (typing, delete, cut) clears all editable slots within the selected range.
- **Paste** — pasted characters are matched against consecutive editable slots from the cursor position, skipping characters that do not satisfy the regexp.
- **Cut** — clears editable slots in the selection; the copied text is whatever the browser placed in the clipboard.

## Constraints

- Uncontrolled only. Do not pass a `value` prop to the input — the hook manages the DOM value directly.
- The mask is static. Changing the array reference after mount has no effect.