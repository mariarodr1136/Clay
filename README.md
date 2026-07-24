# Clay

![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6) ![Next.js](https://img.shields.io/badge/Next.js_16-App_Router-000000) ![React](https://img.shields.io/badge/React_19-Frontend-61DAFB) ![tRPC](https://img.shields.io/badge/tRPC-11-2596BE) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle_ORM-4169E1) ![Claude](https://img.shields.io/badge/Claude-Agent_Loop-D97757) ![Vitest](https://img.shields.io/badge/Vitest-14_tests-6E9F18) ![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000)

A project tracker where the UI isn't fixed. Describe the dashboard you need in plain language, and an agent built on the Claude API writes it — live, against your real projects and tasks, in seconds.

Instead of a fixed set of dashboards and a settings menu to configure them, Clay exposes an allow-listed catalog of queries over your data and gives an LLM tool-use loop exactly two abilities: run one of those queries, or propose a view (a small layout of widgets bound to the results). Every request that changes an existing view creates a new version rather than overwriting it, so nothing you or the agent builds is ever lost.

**Live Demo:** [clay-gray.vercel.app](https://clay-gray.vercel.app) — a read-only preview with sample data, no account required. Or run it locally and open `/demo` (see [Getting Started](#getting-started)).

---

## Table of Contents

- [Screenshots](#screenshots)
- [Highlights](#highlights)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [How the Agent Works](#how-the-agent-works)
- [Security Model](#security-model)
- [Contributing](#contributing)
- [Contact](#contact)

---

## Screenshots

| | |
|---|---|
| ![Project portfolio overview](docs/screenshots/projects.jpg) | ![Task board for a project](docs/screenshots/project-board.jpg) |
| Project portfolio — status, load, and overdue work across every project at a glance | Task board — status, priority, owner, and points for a single project |
| ![Agent-generated executive dashboard](docs/screenshots/view-executive-dashboard.jpg) | ![Chat with the view-building agent](docs/screenshots/chat.jpg) |
| A dashboard the agent generated from one sentence, bound to live catalog queries | "Ask for a view" chat — the agent's tool calls are shown as it builds |
| ![Audit log of view changes](docs/screenshots/audit-log.jpg) | |
| Every view created, refined, or published — attributed to the person or agent action behind it | |

---

## Highlights

- **Ask for a view, get a view** — type a request like "build a delivery dashboard with velocity and overdue work" and the agent inspects the data model, runs a query to sanity-check the shape of the data, and proposes a fully-formed view in one pass.
- **A real widget vocabulary** — KPI tiles (with notes and danger intent), multi-series line/area charts, stacked bars, donuts, progress meters, filter bars, and badge-aware tables — all declarative, Zod-validated, and bound to catalog queries; never generated code.
- **Versioned, never overwritten** — every agent edit (and every manual one) writes a new `view_versions` row with a parent pointer, so a view's entire prompt/edit history is always recoverable.
- **Read-only, allow-listed agent tools** — the agent never writes SQL or touches the database directly. Its only read path is a fixed catalog of org-scoped queries (`tasksList`, `statusByProject`, `openTasksByAssignee`, `overdueTasks`, `upcomingTasks`, `completionsOverTime`, etc.), and every tool call is validated against a Zod schema before it runs.
- **Bring-your-own-key** — the chat UI takes your own Anthropic API key, held only in the browser tab and sent per-request; there's no server-side key to leak or bill against.
- **Full audit trail** — every view created or changed in an organization shows up in the audit log, whether it was the agent or a person.
- **Adversarial test coverage** — a dedicated security suite asserts the agent can never escalate a view to org-wide scope, can't reference an unknown widget type or catalog id, and can't write across an organization boundary even with a version id from the wrong org.
- **Rate-limited by design** — 10 agent requests per 5-minute window per user, enforced server-side ahead of any Anthropic call.
- **Real projects and tasks underneath** — a standard project/task tracker (status, priority, due dates, assignees, comments) sits under the generated-view layer, so there's always real data for views to bind to.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict), Tailwind CSS v4, shadcn/ui + Radix primitives, React Hook Form + Zod, Recharts |
| **Backend** | tRPC 11, Drizzle ORM, PostgreSQL, Next.js Route Handlers |
| **Auth** | Clerk (organizations provisioned automatically on first sign-in) |
| **AI** | Anthropic Claude via `@anthropic-ai/sdk`, a bounded tool-use loop (max 6 rounds) over a fixed tool set |
| **Quality** | Vitest (unit + adversarial security tests), ESLint 9 + typescript-eslint |

---

## Getting Started

**Prerequisites:** Node.js 20+, npm, Docker (for local Postgres), and a Clerk application (publishable + secret key).

```bash
# 1. Clone and install
git clone https://github.com/mariarodr1136/Clay.git
cd Clay
npm install

# 2. Start Postgres
docker compose up -d

# 3. Configure environment
cp .env.example .env.local
# then add your Clerk keys to .env.local:
#   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
#   CLERK_SECRET_KEY=

# 4. Sync the schema to your database
npm run db:push

# 5. Run the app
npm run dev
```

The app runs at http://localhost:3000. Sign up to get an empty personal workspace with a guided start — create your first project, or load a sample workspace (a seeded project plus generated views) with one click. Or visit `/demo` for a read-only, fully loaded showcase with no account: a six-project portfolio, eight example dashboards, scripted agent conversations, and an audit trail.

To use the "ask your interface into existence" chat, paste your own Anthropic API key into the chat panel — it's sent per-request and never stored server-side.

### Deployment

The live demo runs on [Vercel](https://vercel.com), with Postgres on [Neon](https://neon.tech) and a dedicated Clerk instance for public sign-ups. To deploy your own copy: import the repo into Vercel, add a Postgres database (the Neon integration under the project's Storage tab wires up `DATABASE_URL` automatically), set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`, and push the schema with `npm run db:push` against that database before the first deploy.

### Development Workflow

| Command | What it does |
|---|---|
| `npm run dev` | Runs the Next.js dev server (Turbopack) |
| `npm test` | Vitest suite — unit tests plus adversarial agent-security tests |
| `npm run lint` | ESLint across the project |
| `npm run build` | Production build |
| `npm run db:push` | Push the Drizzle schema straight to Postgres (no migration files) |
| `npm run db:studio` | Open Drizzle Studio to browse the database |

---

## Project Structure

```
Clay/
├── docker-compose.yml               # Local Postgres for development
├── drizzle.config.ts                # Drizzle Kit config (schema → Postgres via db:push)
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Marketing homepage
│   │   ├── demo/                     # Public, read-only showcase — sample portfolio, dashboards, scripted agent chats
│   │   ├── sign-in/ sign-up/         # Clerk auth pages
│   │   ├── (app)/                    # Authenticated app shell
│   │   │   ├── dashboard/            # Project list
│   │   │   ├── projects/[id]/        # Task board for a single project
│   │   │   ├── chat/                 # "Ask for a view" chat (BYOK Anthropic key)
│   │   │   ├── views/[viewId]/       # A generated view + its version history
│   │   │   └── audit/                # Org-wide activity log
│   │   └── api/
│   │       ├── agent/route.ts        # Runs the Claude tool-use loop for a request
│   │       └── trpc/[trpc]/          # tRPC route handler
│   ├── components/                   # UI primitives (shadcn/Radix), shared chart core, agent + view components
│   ├── fixtures/                     # Static demo data + sample-workspace view fixtures
│   ├── lib/                          # tRPC client, view DSL (Zod), task display metadata
│   └── server/
│       ├── agent/                    # Tool-use loop, tool executor, rate limiter, tools/
│       ├── auth/                     # ensureUserOrg — provisions an empty org on first sign-in
│       ├── data-access/              # The query catalog — the agent's only read path
│       ├── db/                       # Drizzle schema, client, opt-in sample-workspace seed
│       └── trpc/                     # Routers: projects, tasks, views
└── src/test/                         # Vitest setup helpers
```

---

## How the Agent Works

Every request to `/api/agent` runs a bounded tool-use loop (up to 6 rounds) against Claude, with exactly five tools available:

| Tool | Purpose |
|---|---|
| `describe_entities` | Describe the data model (projects, tasks) available to build views over |
| `list_query_catalog` | List the allow-listed, org-scoped queries widgets can bind to |
| `run_query` | Run one catalog query and inspect the real result before proposing a view |
| `get_view` | Fetch an existing view's current schema, e.g. to refine it on a follow-up |
| `propose_view` | Create or patch a view — the agent's only way to answer the user, called exactly once as its final action |

A request either targets a project (building a new view) or an existing view (refining one via a follow-up like "make this chart bigger"). Refinements always produce a new `view_versions` row with a `parentVersionId`, never an in-place edit — so the full history of prompts and schemas behind any view is recoverable at any time.

---

## Security Model

- **Every query is org-scoped server-side.** `organizationId` always comes from the authenticated session — no caller, including the agent, ever supplies it as a parameter.
- **The agent's only data access is the query catalog** — a fixed, allow-listed set of read queries (`src/server/data-access/catalog.ts`). It cannot write SQL, and it cannot read or write anything outside that catalog.
- **Every tool call is Zod-validated before it runs.** An invalid `tool_use` block comes back to the model as a normal error result rather than crashing the request, so the model can see what was wrong and retry.
- **Widget types and catalog ids are allow-listed at persistence time**, independent of what the model returns.
- **The agent can never escalate a view to organization-wide scope**, on create or on patch — that requires an explicit user action.
- **Cross-organization writes are rejected**, even when a caller presents a real version id that belongs to a different organization.
- **Per-user rate limiting** (10 requests / 5 minutes) sits in front of every Anthropic call.

These invariants are covered by a dedicated adversarial test suite (`src/server/agent/security.test.ts`) in addition to the unit tests.

---

## Contributing

Issues and pull requests are welcome.

1. Fork the repository and create a branch (`feat/your-feature` or `fix/your-bug-fix`)
2. Make your changes and run the checks: `npm run lint && npm test && npm run build`
3. Push your branch and open a pull request describing your changes and testing performed

---

## Contact

Questions or feedback? Reach out at [mrodr.contact@gmail.com](mailto:mrodr.contact@gmail.com).
