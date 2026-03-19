# fortheagent

`fortheagent` bootstraps an agent-ready repository contract for Codex, Claude
Code, and Gemini CLI.

Use this package when you want a direct shell-first workflow for repository
setup and maintenance.

## Install

Run without installing:

```bash
npx fortheagent init
```

Or install globally:

```bash
npm install -g fortheagent
```

If you want the interactive launcher instead of the shell-first package, use
`fortheagent-cli`.

## Commands

```bash
fortheagent init
fortheagent init --mode deferred
fortheagent sync
fortheagent sync --dry-run
fortheagent sync --repair
fortheagent sync --prune
fortheagent doctor
fortheagent status
fortheagent work --mode implementation --active-work-item 0002-auth-boundary
fortheagent work --archive-active --active-work-item 0003-auth-rollout
fortheagent history
```

## What `init` Does

`init` combines repository scan, lightweight discovery, docs generation, and
health validation in one flow.

It writes:

- root adapters: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`
- docs under `docs/`
- metadata and handoffs under `.agent-foundation/`
- optional overlay docs for selected stack, constraints, and practices
- workflow state, active work items, and archived handoff history

## Current Profile Coverage

Frontend:

- `next`
- `react-spa`
- `none`

Backend:

- `nest`
- `fastify`
- `serverless`
- `none`

System types:

- `internal-tool`
- `b2b-saas`
- `content-site`
- `api-platform`
- `realtime-app`
- `data-platform`

Architecture styles:

- `monolith`
- `modular-monolith`
- `service-oriented`
- `event-driven`

## Generated Contract

The generated repository is built around:

- startup docs routed through `docs/agents/repo-facts.md`, `docs/index.md`, and
  `.agent-foundation/handoffs/current.md`
- durable docs under `docs/product`, `docs/system`, `docs/architecture`,
  `docs/engineering`, `docs/operations`, and `docs/decisions`
- active work under `docs/work/active`
- archived work and handoff history under `docs/work/archive` and
  `.agent-foundation/handoffs/archive`
- machine-checked metadata in `.agent-foundation/doc-index.json` and
  `.agent-foundation/doc-health.json`

## Who This Is For

Use `fortheagent` if you want:

- a repository bootstrap tool for agent-heavy teams
- repeatable startup context for Codex, Claude Code, and Gemini CLI
- handoff and work-state continuity inside the repository
- `doctor` and `sync` as part of normal repository maintenance

## Non-Goals

`fortheagent` does not:

- scaffold full product applications
- choose your final service architecture for you
- replace ADRs, product thinking, or engineering review

The generated docs are meant to be refined by humans and agents together.
