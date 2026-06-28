# Auto Router + Classifier Gate

Status: **PLAN** (not started). Spans both repos: `agentic` (backend, most of it) and
`agentui` (frontend selector + routing chip).

## Problem

Selecting a swarm/coordinator agent **always** runs the full orchestration loop —
even `"hi"` spins up the coordinator + workers. That's because the coordinator is
forced into task-board mode (`ResponseMIMEType: "application/json"` +
"Always reply with a single JSON object" in `agents/swarm/agent.go`). Pipeline
agents (`deep-research`, `triage`) likewise always run every stage. Only leaf
agents (`basic`/`explore`/`plan`/`codeguide`) answer conversationally.

We want:
1. An **auto router** the user can select that picks the best agent per turn.
2. A **classifier gate** in front of heavy agents so trivial/conversational input
   is answered directly instead of invoking the machinery.

## Mental model — a route is just an existing agent

No special "direct answer" path is needed. One of the routes is a plain
conversational agent (`chat`, type `basic`). The classifier just **picks an agent
id**; everything downstream (streaming, task UI, model override, sub-agent cards)
is the existing path, unchanged.

- **Auto router** = pick the best agent id, run it normally. `"hi"` → `chat`
  (ordinary streamed reply, no task UI). *"research X across 3 langs, give a
  verdict"* → `research-swarm`.
- **Gate in front of one agent** = the same router with two routes
  `[chat, <that-agent>]`. Selecting a gated `research-swarm` means "answer
  conversationally unless this genuinely needs the swarm."

So: **one new mechanism** (a classifier that picks a route id). Each route is a
normal agent; routing only chooses which to run.

```
user msg ─▶ [classifier]  pick route id ∈ {chat, explore, deep-research, research-swarm, …}
                 │
                 ├─ "chat"          ─▶ basic LLM  ─▶ streams as normal answer (no task UI)
                 ├─ "deep-research" ─▶ deep-research pipeline (as if selected)
                 └─ "research-swarm"─▶ swarm loop (task UI, worker cards)
```

The classifier is one **cheap, non-streamed, structured-output** call: given the
recent conversation + a list of `{route_id, description}`, return
`{ "route": "<id>", "reason": "…" }`. Structured output (adk
`GenerateContentConfig.ResponseSchema`) makes it reliable; route descriptions come
from each agent's `description` in `agents.yaml`.

## Where it hooks — two options

**Option 1 — Pre-dispatch routing in the handler (RECOMMENDED for v1).**
In `internal/handler/chat.go`, after resolving `agentCfg` (~line 123) and before
`StreamAgentRunFormat` (~line 168): if `agentCfg.Type == "router"` (or
`agentCfg.Gate`), call `router.Classify(...)` → target agent id → resolve *that*
core (with the same `WithModelOverride`) → stream it.
- **Pro:** the chosen agent streams through the **exact existing path**, so
  authorship, task boards, sub-agent cards, and the output-agent main-text logic
  in `streamEvents` all work with zero new attribution code.
- **Con:** routing logic lives in the request path (kept tidy in a small
  `internal/router` package).

**Option 2 — Router as an in-graph adk agent type.**
A `router` builder in `bootstrap.builders` that classifies then delegates via
`ResolveSubAgentByName` + `BuildAgentTree`.
- **Pro:** fully config-driven, composable, nestable.
- **Con:** inherits the **nested-authorship problem** (the deferred "hierarchical
  attribution" item) — a routed leaf agent's text would render as a sub-agent card
  instead of the main answer unless we re-author events or extend
  `baseAgent`/`isOutputAgent` in `stream.go`.

**Recommendation:** ship Option 1; evolve toward Option 2 later if routers need to
route to routers.

## Components to build

### Backend (`agentic`)
1. **`internal/router/` (new):**
   `Classify(ctx, cfg, classifierModel, routes []RouteInfo, messages) (routeID, reason, error)`
   — one structured completion via the `pkg/genai/openai` wrapper. `RouteInfo` =
   `{id, description, keywords}`.
2. **Config (`internal/config/agents.go`)** — add to `AgentConfig`:
   - `Routes []string` (route agent ids) for `type: router`.
   - `Gate bool` + optional `GateFallback string` (default `chat`) — shorthand that
     wraps *any* agent in a 2-route router `[chat, self]` without a separate entry.
   - optional `ClassifierModel string` (cheap model for the decision; falls back to
     the selected model).
3. **Handler hook (`internal/handler/chat.go`)** — the ~10-line pre-dispatch branch
   (Option 1). Resolve target core with existing override logic; emit a lightweight
   run-progress (`Routing…`) before classify returns so the UI isn't blank.
4. **`config/default/agents.yaml`** — add a `chat` agent (type `basic`, friendly
   prompt) and an `auto` agent (type `router`,
   routes: `[chat, explore, plan, deep-research, research-swarm]`). Optionally set
   `gate: true` on `research-swarm`/`deep-research`.
5. **Optional fast-path:** a cheap heuristic before the LLM call (very short
   message / greeting regex / no question → `chat`) to skip the round-trip on `"hi"`.

### Frontend (`agentui`)
6. **Agent selector** — add **"Auto"** (`agent_id = auto`) as default/first entry.
   Meta-agent: always available regardless of model capabilities.
7. **Routing UX** — existing `RunProgress` "Analyzing…" covers the classify gap.
   For a heavy route, optionally show a one-line "Using deep research…" chip
   (a `data-agent-progress` `phase:"routing"` event). For `chat`, stream as a
   plain message.
8. **No changes** to the streaming/perf path — a routed agent renders identically
   to a selected one.

## Phasing

1. Classifier + handler hook + `chat`/`auto` config. Verify with curl: `"hi"` →
   plain streamed reply (no board); *"research Python vs Go vs Rust, verdict"* →
   routes to `research-swarm`. Log every decision (`route`, `reason`).
2. `gate: true` shorthand so selecting `research-swarm` directly still answers
   `"hi"` conversationally.
3. Frontend "Auto" entry + routing chip.
4. Fast-path heuristic + `classifier_model` tuning; routing-decision log/metric to
   catch misroutes.

## Decisions to make

- **Classifier model:** dedicated cheap/fast model (lower latency + cost,
  recommended) vs. reuse the user-selected model (the earlier "selected model for
  everything" rule). Lean: special-case the *meta* decision to a cheap model; keep
  the selected model for the actual work.
- **Default behavior:** make **Auto** the default selection, or keep explicit
  agents default and offer Auto opt-in?
- **Gate scope:** gate *all* heavy agents, or only swarm/coordinator/deep-research
  (leave leaf agents ungated since they're already cheap)?

## Risks

- **Extra latency/cost:** one classify round-trip per turn — mitigated by cheap
  model + heuristic fast-path.
- **Misrouting:** mitigated by good `description`s, structured output, and a "when
  unsure, prefer `chat`" instruction; the decision log makes it tunable.
- **Don't stack gates:** a router's routes should reference **un-gated** agents (the
  router *is* the gate), or you double-classify.

## Relevant existing code

| Concern | Location |
|---|---|
| Type→builder registry, `BuildAgentTree` | `agentic/internal/bootstrap/bootstrap.go` (`builders` map) |
| Per-request agent resolution + model override | `agentic/internal/handler/chat.go` (~L62, L114-131, L168) |
| `AgentConfig`, `WithModelOverride`, `ResolveSubAgentByName` | `agentic/internal/config/agents.go` |
| Leaf LLM builder (for `chat` + direct route) | `agentic/agents/shared/shared.go` (`BuildLLMAgent`) |
| Stream attribution (main text vs sub-agent) | `agentic/internal/agent/stream.go` (`baseAgent`, `isOutputAgent`, `streamEvents`) |
| Swarm forced-JSON coordinator (why it never answers directly) | `agentic/agents/swarm/agent.go`, `agentic/agents/swarm/checktasks.go` |
| Agent selector / capability gating | `agentui/components/chat/...` selector + `lib/api/agents.ts` |
