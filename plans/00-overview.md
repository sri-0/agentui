# Agentic Chat UI — Plan Overview

Corporate LLM chat frontend for the `adk-go` agentic backend (`~/code/agentic`). Built on a fresh Next.js 16 repo with shadcn (`radix-nova`) + the AI Elements component set already vendored in `components/ai-elements/`.

This folder is the source of truth for the build. Read in order:

1. **00-overview.md** (this file) — decisions, stack, scope, open risks.
2. **01-streaming-architecture.md** — the heart: how the backend's hybrid OpenAI/AG-UI SSE stream is converted into AI SDK v6 UI-message parts, and how each part renders.
3. **02-backend-changes.md** — the Go changes to `~/code/agentic` to emit reasoning, usage/context, tasks, and artifacts.
4. **03-frontend-build.md** — file structure, components, feature specs, and milestones.

---

## Confirmed decisions (from kickoff Q&A, 2026-06-13)

| Topic | Decision |
| --- | --- |
| Backend scope | **Update both.** Modify `~/code/agentic` to emit reasoning deltas, usage/context tokens, AG-UI task events, and artifact events. See `02-backend-changes.md`. |
| File upload / RAG | **UI only for now.** Build the attachment UX + a stubbed upload route; wire real ingestion later. |
| Auth / identity | **None.** Do not special-case `X-User-ID`. The single proxy forwards **all** inbound headers verbatim. Other APIs are called directly from the browser (backend CORS is `*`). |
| Design | Keep the provided shadcn `radix-nova` theme. Functionality first; no custom aesthetic pass yet. |
| Build trigger | Plan only — stop after writing `plans/`, wait for review. |

---

## Stack (already installed unless noted)

| Concern | Choice | Version / notes |
| --- | --- | --- |
| Framework | Next.js App Router | `next@16.2.9`, `react@19.2.4`. ⚠️ Breaking changes — read `node_modules/next/dist/docs/` before writing routes (`params` is a `Promise`, route handlers use Web `Request`/`Response`). |
| Streaming + conversion | Vercel AI SDK | `ai@6.0.204`, `@ai-sdk/react@3.0.206`. Confirmed exports: `createUIMessageStream`, `createUIMessageStreamResponse`, `DefaultChatTransport`, `useChat`. |
| Markdown streaming | Streamdown | `streamdown@2.5.0` + `@streamdown/{code,math,mermaid,cjk}`. Already wired in `components/ai-elements/message.tsx` (`MessageResponse`) and `reasoning.tsx`. Gives code highlighting (shiki) + LaTeX (math) for free. |
| UI components | shadcn (`radix-nova`) + AI Elements | 25 shadcn primitives in `components/ui/`, 48 AI Elements in `components/ai-elements/`. |
| Server state / queries | TanStack Query | **NOT yet installed — add `@tanstack/react-query`.** Used for every non-streaming API call (agents, models, threads, history). |
| Global UI state | Zustand | **NOT yet installed — add `zustand`.** One small store for cross-cutting UI state only (sidepanel target, selected model/agent, temporary-chat flag). Chat/message state stays in `useChat`. |
| Token estimation | tokenlens | `tokenlens@1.3.1` (already present) — client-side fallback for the context circle until the backend emits real usage. |
| Styling | Tailwind v4 | Config lives in `app/globals.css` via `@theme` (no `tailwind.config`). OKLCH color tokens. |

**Why Zustand is justified here** (the brief says "only if absolutely required"): the context-usage panel, the per-agent detail panel, and the artifacts panel all render into one shared right-hand sidepanel whose target is set from deep in the message tree (an agent card click) and read by a sibling of the chat view. That cross-tree coordination plus the persisted model/agent selection is the minimal genuinely-global state. Everything else stays local or in `useChat`.

---

## The one proxy vs. direct calls

Per the brief: **exactly one** Next.js route does protocol conversion. Everything else hits the backend directly from the browser.

- **`POST /app/api/chat/route.ts`** — the only proxy. Receives the `useChat` request, forwards to backend `POST /v1/chat/completions` (`stream:true`) with all headers passed through, reads the hybrid OpenAI+AG-UI SSE, and re-emits an AI SDK UI-message stream. Detailed in `01-streaming-architecture.md`.
- **Direct from browser** via TanStack Query (`lib/api/*`): `GET /v1/agents`, `GET /v1/models`, `GET/POST/PUT/DELETE /v1/threads`, `GET /v1/threads/{id}/messages`, `POST /v1/agent/resume`, `POST /v1/rag/search`. Base URL from `NEXT_PUBLIC_BACKEND_URL`. No header rewriting needed (no auth).

---

## Backend facts that shape the frontend (from `~/code/agentic` analysis)

- Wire format is **OpenAI-style SSE** (`data: {json}\n\n`, terminated by `data: [DONE]`). It is **hybrid**: some chunks are real `chat.completion.chunk` (final agent text + tool calls), others are custom wrappers (`agent_progress`, `agent_event`, `tool_result`, `tool_interrupt`) each carrying an embedded `ag_ui` object. Branch per chunk on which keys are present.
- **Final/output agent** answer → plain OpenAI `delta.content`. **Sub-agents** → `agent_event` carrying `agent` (name) + `step`; lifecycle via `ag_ui` `STEP_STARTED`/`STEP_FINISHED` (`stepName`). This is how we attribute streams to agent cards.
- Tool calls are real OpenAI `delta.tool_calls` always paired with a `finish_reason:"tool_calls"` chunk; results arrive as `tool_result` wrapper events.
- HITL: `tool_interrupt` pauses the stream; resume via `POST /v1/agent/resume`.
- `/v1/agents` returns `{object:"list", data:[{id,name,description,model,provider,tools,sub_agents,...}]}`.
- `/v1/models` returns a **flat** list; each entry carries `provider_id` + `provider_name` (group by these) plus `context_length`, capability flags, `name`, `id`.
- **Gaps requiring backend work** (see `02-backend-changes.md`): no reasoning deltas on the agent path, no usage/context tokens on the agent path, no task-list events, no artifact events, no file-upload endpoint.

Key backend files: `internal/server/server.go`, `internal/agent/stream.go`, `internal/sse/encoder.go`, `internal/types/{events,chat,models}.go`, `internal/handler/{chat,models,resume,threads}.go`, `config/default/{models,agents}.yaml`.

---

## Open risks / things to verify during build

- **AI SDK v6 part API**: names confirmed via `node_modules/ai/dist/index.d.ts`, but verify the exact `writer.write` shapes against the installed types when implementing the transformer — do not trust training data (same warning as Next.js).
- **Reasoning on proxied models**: plain (non-agent) models already pass `delta.reasoning` through from OpenRouter; agent models need the backend change. The UI must handle both/absent gracefully.
- **Usage for agent path** is entirely a backend change; until then the context circle uses tokenlens client-side estimation.
- **Next.js 16 route handler streaming**: confirm `createUIMessageStreamResponse` works unbuffered under Next 16; set `X-Accel-Buffering: no` and verify no edge/runtime buffering.
