<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Thread & chat-stream performance (FPS) — REQUIRED reading before touching the chat UI

The chat thread streams tokens at ~20fps (throttled). Every careless re-render in
that path multiplies across hundreds of frames and tanks FPS. This spec is the
contract for keeping the thread smooth. **If you change anything under
`components/chat/`, conform to this and re-measure with React Scan.**

## The one rule

> During streaming, the ONLY things that should do real render work are the
> **streaming output itself** (the changed text/reasoning part) and the **live
> usage ring**. The header, composer, selectors, task bar, and *settled* message
> cards (reasoning, tool, agent-progress, sub-agent) must NOT re-render per token.

## Why it's hard (the mechanism)

`useChat` (in `ThreadChat`) subscribes to the chat's **messages** store via
`useSyncExternalStore`, so it re-renders on **every throttled chunk**. Its whole
subtree is in the blast radius. You cannot avoid `ThreadChat` re-rendering; you
make its children **bail** via `memo` + stable props, and you isolate live data
(usage) to the leaf that needs it.

Key SDK facts (verified against `@ai-sdk/react@3`):
- `useChat` does **not** share a `Chat` by `id` — each call makes a new one.
  `useAgentChat` therefore **owns** one `Chat` instance and returns it (`chat`);
  secondary subscribers use `useChat({ chat })` to read the SAME instance.
- `useChat({ chat })`'s `sendMessage`/`stop`/`chat` are stable refs (bound to the
  instance) — safe as `useCallback`/`useMemo` deps and memoized-component props.
- `experimental_throttle: 50` on `useChat` batches updates to ~20fps. Keep it.

## Architecture (current, keep it this way)

- **`useAgentChat`** owns the `Chat` instance (`new Chat`, keyed by thread id) +
  `experimental_throttle`. Returns `{ ...helpers, chat }`.
- **`ThreadChat`** re-renders per chunk but does ~nothing: header + composer are
  memoized and bail; `MessageList` is the intended re-render (stream output).
  - Handlers passed to the composer are `useCallback`'d (`onSubmit`, `onOpenUsage`);
    `onStop`/`sendMessage` are already stable from the hook.
  - **Live usage is decoupled**: `Composer` takes a `contextSlot` ReactNode, not a
    `usage` prop. `ThreadChat` passes a `useMemo`'d `<ThreadUsageRing chat={chat} …/>`.
    The ring self-subscribes via `useChat({ chat })` and re-renders alone for the
    live token count — the composer stays memoized.
- **`Composer`, `ThreadHeader`, `AgentSelector`, `ModelSelector`,
  `ReasoningEffortSelector`, `AttachmentButton`, `TaskBar`** are all `memo`'d.
- **In-message cards** are `memo`'d with **content-signature comparators** so they
  update on new *events* but not on tokens:
  - `RunProgress` → `runProgressKey` (run-level progress phases).
  - `AgentCards` → `agentCardsKey` (agents seen + lifecycle/duration + progress;
    NOT per-delta — cards show steps/status, not streamed text).
  - `ToolCard` → `part.state` + `toolName` + `output` + `interrupt.resolved`.
  - `MessageReasoning` → primitive `text`/`isStreaming` (default shallow memo).
  - `MessageResponse` (Streamdown) → already memoized on `children`.

## Rules for new code

1. **Never pass a per-token-changing prop into a memoized shell component.** Live
   values (usage, token counts, anything derived from `messages` each chunk) must
   be read by a dedicated leaf that self-subscribes (`useChat({ chat })`), not
   threaded through the composer/header.
2. **New message-part renderers must be memoized** with a comparator keyed on a
   cheap **signature of that part's own data** — never the whole `message`. The
   signature must change when a real event arrives and stay equal across tokens.
   Append-only data parts (unique ids) → count/keys; in-place data parts (stable
   id, e.g. `data-agent-step`, `data-task-list`) → include status/content.
3. **Callbacks crossing into memoized components must be `useCallback`'d**;
   element props (`contextSlot`) must be `useMemo`'d. A new closure every render
   defeats the memo.
4. **Tooltips:** use the single root `TooltipProvider` (`components/providers.tsx`).
   Never wrap an individual tooltip in its own `TooltipProvider` (it re-renders a
   provider per instance — see the 304× `TooltipProvider` regression).
5. **Heavy popovers/lists** (e.g. the model list) render only when `open`.
6. **Keep `experimental_throttle`.** Removing it un-throttles the whole subtree.

## How to diagnose (React Scan)

Use the React Scan overlay + Optimize/Ranked tab. Read it as:
- High **"other time" ≫ render time** → cost is browser work (style/layout/paint)
  or `useEffect`/`useLayoutEffect`, usually from **Radix Popper/Tooltip/Collapsible**
  re-rendering thousands of times. Find which user component drags them.
- A component with **renders ≫ prop/context changes** is memoizable. If a memoized
  component still re-renders, its props aren't stable (a changing object/closure)
  or a comparator is missing.
- Components tagged **"Memoizable"** by React Scan are direct candidates.
- Confirm fixes by **re-measuring the same interaction** and checking the offender
  dropped out of the list. This is a loop: fix → re-measure → next offender.

## Reference

Vercel React best-practices rules that apply here: `rerender-memo`,
`rerender-memo-with-default-value`, `rerender-functional-setstate`,
`rerender-use-ref-transient-values`, `rendering-content-visibility`,
`client-event-listeners`. The thread is the hottest path in the app — bias toward
isolating subscriptions and memoizing leaves over "it's probably fine".
