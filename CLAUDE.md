# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # run App.tsx in browser (Vite dev server)
npm run build      # tsc -b && vite build → outputs to dist/
npm run lint       # eslint
npx tsc --noEmit   # type-check without emitting
```

There are no tests.

## Architecture

This is a Vite library project. The build entry is `src/index.ts`; everything in `src/` is included in the type declarations. `react` and `react/jsx-runtime` are externalized — not bundled.

**`src/useMiniMask.ts`** is the entire library. It exports a single hook:

```ts
useMiniMask(mask: (RegExp | string)[]): RefObject<HTMLInputElement>
```

- Each `RegExp` in the mask is one editable character slot; each `string` is literal static text.
- The hook builds a flat `positions` array (one entry per display character) and a `chars` array (the mutable values). Both are derived once from `mask` — the mask is treated as static and never re-read after mount.
- All editing is intercepted via a `beforeinput` listener. `e.preventDefault()` is called unconditionally; the hook rewrites `input.value` and `setSelectionRange` manually for every handled `inputType`. Unhandled `inputType`s are silently blocked.
- The hook is uncontrolled-only — it writes directly to the DOM and does not integrate with React's `onChange`.

**`src/App.tsx`** is a dev sandbox, not part of the published library.