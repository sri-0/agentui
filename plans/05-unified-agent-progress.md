# Unified per-sub-agent `agent_progress` lifecycle

Status: **future / not started** · Captured 2026-06-14

Goal: make every sub-agent's card driven by **one** event source (`agent_progress`)
instead of three (`data-agent-delta` + `data-agent-step` + `data-agent-progress`),
so the data model is uniform and the frontend memo signature collapses to a single
"re-render when this agent's progress changes" check.

This is a **cleanup**, not a perf win — the current memo comparator already ignores
delta tokens (see `AGENTS.md` → "Thread & chat-stream performance"). Do it when next
revising the agent event model. Everything works today; don't rush it.

---

## Why this exists (current state)

The sub-agent card (`components/chat/messages/agent-cards.tsx`) is assembled from
three streams, which is why its memo signature (`agentCardsKey`) has three parts:

| Source (frontend part) | Backend emitter | Drives on the card |
| --- | --- | --- |
| `data-agent-delta` | `writeAgentEvent` / `writeReasoning` (text_delta / reasoning_delta) | **which agents get a card** + the side-panel stream |
| `data-agent-step` | `writeAgentProgress(agent_start/agent_done)` / `writeAgentDone` | **status badge + duration** |
| `data-agent-progress` (with `agent`) | `writeAgentProgress(executing/error, …)` | **the step log** |

The card existence is keyed off `data-agent-delta` because a pure reason-then-write
sub-agent (e.g. `research_planner`) calls no tools and so emits **no** `agent_progress`
today — its only signal that it ran is that it streamed output (deltas). Tool-using
sub-agents (e.g. `data_analyst`) do emit `executing` progress.

Backend reference (`~/code/agentic`):
- `internal/agent/stream.go`: `transitionAgent` (emits `agent_start`/`agent_done`),
  `closeGroup` → `writeAgentDone` (duration), `writeAgentProgress` (executing/error),
  `writeAgentEvent`/`writeReasoning` (deltas). `isOutputAgent(author)` already
  distinguishes the output agent from sub-agents.
- `internal/types/events.go`: `AgentProgressEvent` (phase/message/agent/step/duration_ms).

Frontend reference: `agent-cards.tsx` `collectAgents()` + `agentCardsKey()`;
`pump-backend-sse.ts` branches 2 (`agent_event`) and 3 (`agent_progress`).

---

## Target design

Emit a **uniform `agent_progress` lifecycle for every sub-agent** (gated to
non-output agents), carrying everything the card needs:

```
agent_progress { agent, phase: "started",  step }
agent_progress { agent, phase: "executing", message: "Running web_search…", step }   // tool, if any
agent_progress { agent, phase: "error",     message: "Error: …", step }              // if any
agent_progress { agent, phase: "done",      duration_ms, step }
```

- The **card** is then built purely from `agent_progress` for that agent: existence =
  "has any `agent_progress`"; status = latest phase (`started`→working, `done`→done,
  any `error`→error); duration = `done.duration_ms`; step log = the `executing`/`error`
  messages, deduped.
- `data-agent-delta` stays **only** for the side-panel stream (reasoning + answer);
  the card ignores it entirely.

---

## Caveats (the load-bearing bits — don't skip)

1. **Output-agent gating.** The output agent has no card today because it has no
   `data-agent-delta`. If existence is keyed off `agent_progress`, the backend MUST
   emit the lifecycle for sub-agents only (gate on `isOutputAgent(author)` — already
   in scope in `stream.go`), or the output agent grows a spurious card.
2. **Lifecycle/duration move.** `agent_start`/`agent_done`+`duration` currently arrive
   as `data-agent-step`. To have one source, fold them into the `agent_progress`
   lifecycle (`phase: started`/`done` + `duration_ms`). Either keep `agent_step` too
   (and gain little) or retire it — retiring it means the frontend stops reading
   `data-agent-step` for the cards.
3. **Clickability.** "Open this agent's stream in the side panel" depends on it
   *having* a stream (a delta). If existence comes from progress, either keep a delta
   check for the clickable affordance, or declare all sub-agent cards clickable and
   show an empty side panel if there were no deltas. Decide which.
4. **Reason/write steps (optional).** If you want pure reason/write agents to show
   steps (not just an empty log + status), emit synthetic `agent_progress` like
   `phase: "reasoning"` / `phase: "writing"`. The user earlier preferred NOT to fake
   these on the frontend — this is the backend doing it honestly. Optional.

---

## Steps

### Backend (`~/code/agentic`)
1. In `stream.go`, for `author` where `!isOutputAgent(author)`:
   - Emit `agent_progress{phase:"started"}` on first appearance (replace/augment
     `agent_start`).
   - Keep `executing`/`error` progress as-is (already attributed).
   - Emit `agent_progress{phase:"done", duration_ms}` on close (replace `writeAgentDone`'s
     `agent_done` — or keep the same event, just ensure it's the single lifecycle).
   - (Optional caveat 4) emit `reasoning`/`writing` phases.
2. Ensure NO lifecycle `agent_progress` is emitted for the output agent.
3. Decide whether to retire `data-agent-step` (caveat 2). If retired, remove
   `writeAgentDone`/`agent_start`/`agent_done` and the `DurationMs` on the step.
4. `go build ./...` + verify the SSE shapes (one capture: deep-research run, confirm
   each sub-agent has `started`…`done{duration_ms}` and the output agent has none).

### Frontend (this repo)
5. `pump-backend-sse.ts`: `agent_progress` branch now also carries lifecycle
   (`started`/`done`/`duration_ms`). Map `done`+`duration_ms` into a part the card can
   read. If `data-agent-step` is retired, drop branch 3's `data-agent-step` emission;
   else keep both during migration.
6. `agent-cards.tsx` `collectAgents()`: build existence/status/duration/steps from
   `data-agent-progress` only. Keep the `data-agent-delta` check **only** if you keep
   clickability tied to "has a stream" (caveat 3).
7. **Collapse the memo signature**: `agentCardsKey` becomes a single pass over
   `data-agent-progress` (agent + phase + message + duration). Delete the delta/step
   tracking from it. (Consider the correct-by-construction form — compare
   `collectAgents()` output — discussed in chat; strictly safer, ~same cost.)
8. `types.ts`: adjust `data-agent-progress` / `data-agent-step` parts to match.
9. Re-measure with React Scan (same deep-research interaction) to confirm no
   regression in the per-token skip behavior.

---

## Verification checklist
- [ ] Output agent has **no** card; its answer is in the main thread.
- [ ] Pure reason/write sub-agent (`research_planner`) gets a card with status +
      duration (and steps if caveat 4 done).
- [ ] Tool-using sub-agent shows its `executing`/`error` steps, deduped.
- [ ] Clicking a sub-agent card still opens its reasoning+answer in the side panel.
- [ ] During output-agent text streaming, the cards do NOT re-render per token
      (React Scan: `AgentCards` absent / minimal).
- [ ] Multi-agent run (deep-research) and single-agent run (basic_agent → no cards)
      both correct.

---

## Cross-references
- `AGENTS.md` → "Thread & chat-stream performance (FPS)" — the memo rules this feeds.
- `plans/agent-ui-redesign.md` — the original multi-agent card design + the decision
  to show only real backend progress (not frontend-synthesized steps).
- `agent-cards.tsx` (`collectAgents`, `agentCardsKey`), `pump-backend-sse.ts`
  (branches 2–3), `~/code/agentic/internal/agent/stream.go`,
  `~/code/agentic/internal/types/events.go`.
