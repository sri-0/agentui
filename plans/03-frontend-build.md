# 03 — Frontend Build Plan

File structure, component map, feature specs, and milestones. Assumes `01-streaming-architecture.md` for the streaming internals.

> ⚠️ Next.js 16: before writing any route/page, read the relevant guide in `node_modules/next/dist/docs/01-app/`. `params` is a `Promise` (await it). Route handlers use Web `Request`/`Response`. Pages/layouts are Server Components by default; mark interactive trees `'use client'`.

---

## 1. Dependencies to add

```bash
# verify exact latest-compatible versions at install time
npm i @tanstack/react-query zustand
```
Everything else (AI SDK, streamdown, ai-elements, shadcn, tokenlens, xyflow, motion) is already present.

---

## 2. File structure

```
app/
  layout.tsx                      # add <Providers> (React Query + theme)
  page.tsx                        # → redirect to /chat (landing handled there)
  api/
    chat/route.ts                 # THE proxy (01 §2)
    upload/route.ts               # stub for file upload (deferred ingestion)
  (app)/
    layout.tsx                    # app shell: <Sidebar/> + <RightPanel/> + children
    chat/
      page.tsx                    # landing: centered input, no active thread
      [threadId]/page.tsx         # active thread (await params)

components/
  providers.tsx                   # QueryClientProvider, etc. ('use client')
  chat/
    chat-view.tsx                 # message list + composer for a thread
    use-agent-chat.ts             # useChat wrapper (01 §4)
    composer/
      prompt-input.tsx            # wraps ai-elements/prompt-input
      model-selector.tsx          # grouped by provider (3 §4a)
      agent-selector.tsx          # /v1/agents (3 §4b)
      attachment-button.tsx       # file upload UI (deferred backend)
      temporary-toggle.tsx        # ephemeral chat switch
      context-circle.tsx          # opencode-style usage ring (01 §6)
    messages/
      message-list.tsx            # maps messages → parts (01 §4 table)
      text-part.tsx               # MessageResponse (streamdown)
      reasoning-part.tsx          # ai-elements/reasoning
      tool-part.tsx               # ai-elements/tool
      agent-cards.tsx             # multi-agent cards (01 §5)
      tool-interrupt.tsx          # HITL approve/deny → /v1/agent/resume
    task-bar.tsx                  # todo list docked above composer
  sidebar/
    app-sidebar.tsx               # thread list grouped by day/week
    thread-group.tsx
    new-chat-button.tsx
  right-panel/
    right-panel.tsx               # switches on store.sidepanel.kind
    usage-panel.tsx               # context breakdown
    agent-detail-panel.tsx        # one agent's live stream (01 §5)
    artifact-panel.tsx            # ai-elements/artifact

lib/
  chat/
    types.ts                      # ChatMessage, data parts (01 §1)
    pump-backend-sse.ts           # the transformer (01 §3)
    to-backend-messages.ts        # UI msgs → {role,content}
    forward-headers.ts            # pass-through header filter
  api/
    client.ts                     # backend fetch base (NEXT_PUBLIC_BACKEND_URL)
    agents.ts                     # useAgents()
    models.ts                     # useModels() + grouping selector
    threads.ts                    # useThreads(), useThread(), useThreadMessages(), mutations
  group-threads.ts                # bucket threads by Today/Yesterday/Last 7 days/...

stores/
  ui-store.ts                     # zustand: { selectedModel, selectedAgent, temporary,
                                  #            sidepanel: {kind,...} | null, set* }

hooks/                            # (as needed)
```

---

## 3. App shell & layout

- `(app)/layout.tsx`: three-column grid — left `AppSidebar` (collapsible, shadcn sidebar/sheet pattern), center `children`, right `RightPanel` (slides in when `store.sidepanel` set; off-canvas on small screens). Use shadcn `resizable`/`sheet` patterns; keep within `radix-nova` theme tokens.
- **Landing** (`/chat` with no thread): center the composer vertically with a greeting + suggestion chips (`ai-elements/suggestion.tsx`). On first send, create a thread (`POST /v1/threads`) unless temporary, then route to `/chat/[threadId]`.
- **Active thread** (`/chat/[threadId]`): `ChatView` loads history via `useThreadMessages(threadId)` (React Query) for initial render, then `useChat` for live streaming. Compose: `<MessageList/>` (scroll area, stick-to-bottom via `use-stick-to-bottom` already in `conversation.tsx`), `<TaskBar/>` (conditional), `<Composer/>`.

---

## 4. Chat input (composer) specs

Wraps `components/ai-elements/prompt-input.tsx`. Toolbar row below the textarea holds the controls.

**a. Model selector** — `useModels()` returns the flat `/v1/models` list; client groups by `provider_id`/`provider_name`. Render a shadcn `Command`/`Select` with one group per provider, each item showing **model name** (primary) + **model id** (muted) + capability badges (vision/tools/reasoning) + `context_length`. Only `type:"llm"` entries are selectable here. Persist selection in `ui-store`.

**b. Agent selector** — `useAgents()` (`GET /v1/agents`). Render name + description; show a badge if it has `sub_agents` (multi-agent). Selecting an agent sets `agentId` (sent as `agent_id` in the proxy body). "No agent" = plain model chat. Model + agent are independent selectors (agent runs may pin their own model server-side; still send both).

**c. Attachment upload** — `attachment-button.tsx` + `ai-elements/attachments.tsx` for previews. Accept docs/images; show chips with remove. On send, attach as `files` to `sendMessage`. Backend ingestion deferred → `POST /api/upload` stub stores nothing yet; set `useRag:true` when attachments present so the flag path is exercised.

**d. Temporary chat toggle** — `temporary-toggle.tsx`. When on: visually distinct composer (badge/!persisted), `threadId` omitted from proxy body (no `thread_id` → backend doesn't persist), thread not written to sidebar, history not saved. A clear "Temporary" indicator in the header.

**e. Context circle** — `context-circle.tsx`, see `01 §6`. SVG ring filling with `contextUsed/contextWindow`; color shifts as it approaches the limit. Click → `store.sidepanel = {kind:'usage'}`.

---

## 5. Message rendering

`MessageList` maps `messages`; for each message, iterate `message.parts` and dispatch per the table in `01 §4`. Key points:
- **Text** → `MessageResponse` (`ai-elements/message.tsx`) — Streamdown already provides code highlighting + LaTeX (`@streamdown/math`) + mermaid. No extra work for "code and latex rendering."
- **Reasoning** → `ai-elements/reasoning.tsx` (collapsible, auto-expands while streaming).
- **Tools** → `ai-elements/tool.tsx` (input args + result; pending/complete states).
- **Agent cards** → `agent-cards.tsx` (`01 §5`); click opens agent detail panel.
- **HITL** `data-tool-interrupt` → `tool-interrupt.tsx` using `ai-elements/confirmation.tsx`; approve/deny posts to `/v1/agent/resume` then resumes the stream (re-send / continue).

---

## 6. Task bar, sidepanel, artifacts

- **Task bar** (`task-bar.tsx`): reads the latest `data-task-list` part; renders compact checklist (`ai-elements/task.tsx`) docked above the composer while any task is `pending`/`in_progress`; collapses when all complete.
- **Right panel** (`right-panel.tsx`) switches on `store.sidepanel.kind`:
  - `usage` → `usage-panel.tsx`: total + per-bucket breakdown from `data-usage` (or tokenlens estimate), context-window bar.
  - `agent` → `agent-detail-panel.tsx`: live `MessageResponse` of that agent's `data-agent-stream`.
  - `artifact` → `artifact-panel.tsx`: `ai-elements/artifact.tsx` rendering `data-artifact` content (markdown/code/html).
- Artifacts also surface a small inline chip in the message ("View artifact →") that sets the panel.

---

## 7. Sidebar thread list

- `useThreads()` → `GET /v1/threads`. `group-threads.ts` buckets by updated time: **Today / Yesterday / Previous 7 days / Previous 30 days / Older** (and month labels beyond). Each group rendered with `thread-group.tsx`.
- Item: title (or first user message), relative time, hover actions (rename → `PUT /v1/threads/{id}`, delete → `DELETE`). Active thread highlighted.
- `new-chat-button.tsx` routes to `/chat` (landing). Temporary chats never appear here.
- React Query invalidates `['threads']` after create/rename/delete; optimistic updates for rename/delete.

---

## 8. State & data-fetching conventions

- **TanStack Query** for all non-streaming reads/writes. Query keys: `['agents']`, `['models']`, `['threads']`, `['thread', id]`, `['thread-messages', id]`. Sensible `staleTime` (agents/models are near-static — 5–10 min). Wrap app in `QueryClientProvider` in `components/providers.tsx`.
- **useChat** owns live message state. Seed it with history from `useThreadMessages` on thread mount.
- **Zustand** (`ui-store`) holds only: `selectedModel`, `selectedAgent`, `temporary`, `sidepanel`. Persist `selectedModel`/`selectedAgent` to `localStorage` (zustand `persist`).
- **Env**: `NEXT_PUBLIC_BACKEND_URL` (browser → direct backend calls), `BACKEND_URL` (server → proxy route). Add `.env.example`.

---

## 9. Milestones (suggested build order)

1. **Scaffold** — add deps; `providers.tsx`; `ui-store`; `lib/api/client.ts`; `.env.example`; redirect `app/page.tsx` → `/chat`.
2. **Proxy + transformer** — `app/api/chat/route.ts`, `lib/chat/{types,pump-backend-sse,to-backend-messages,forward-headers}.ts`. Verify plain text streaming end-to-end against the backend (start `~/code/agentic`).
3. **App shell** — `(app)/layout.tsx`, sidebar scaffold, landing page with centered composer.
4. **Composer** — model selector (grouped), agent selector, temporary toggle, attachment UI (stub), basic send.
5. **Message rendering** — text (Streamdown), reasoning, tools. Confirm code + LaTeX render.
6. **Threads** — sidebar list grouped by day, create/route/rename/delete, history hydration.
7. **Multi-agent** — agent cards + agent detail sidepanel; HITL confirmation + resume.
8. **Usage + context** — context circle, usage sidepanel (tokenlens estimate first).
9. **Tasks + artifacts** — task bar, artifact sidepanel.
10. **Backend changes** (`02`) — reasoning, real usage/context, task_list, artifact events; swap estimates for real data.
11. **Polish** — empty/loading/error states, responsive off-canvas panels, keyboard shortcuts, a11y pass.

Milestones 2 and 7 are the highest-risk; validate them against a running backend early.

---

## 10. Definition of done (functional)

- Landing → type → streams a markdown answer with working code + LaTeX.
- Model selector groups by provider; agent selector lists `/v1/agents`.
- Multi-agent run shows a card per agent; clicking opens that agent's live stream in the panel.
- Reasoning streams render (agent path after backend change; proxied models immediately).
- Context circle fills and opens a usage breakdown panel.
- Task list appears above the composer during multi-step runs.
- Artifacts open in the sidepanel.
- Temporary chat leaves no thread in the sidebar.
- Threads persist, grouped by day, rename/delete work.
- Exactly one proxy route; all other calls go direct to the backend with headers forwarded.
