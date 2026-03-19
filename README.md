# fortheagent

`fortheagent` bootstraps and maintains an agent-ready repository contract for
Codex, Claude Code, and Gemini CLI.

It does not generate business features. It generates the working documentation,
handoff state, validation metadata, and workflow history that let agents keep
moving without rebuilding repository context from scratch.

## Why This Exists

Most repositories make agents do too much cold-start work:

- figure out what the product is
- discover where to read first
- guess which docs are stale
- reconstruct current work from scattered notes
- infer how to validate changes safely

`fortheagent` creates a consistent contract for that context:

- thin root adapters: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`
- canonical docs under `docs/`
- machine-managed metadata under `.agent-foundation/`
- active handoff state in `.agent-foundation/handoffs/current.md`
- active and archived work history in `docs/work/`
- `doctor`, `sync`, `status`, `work`, and `history` to keep the contract healthy

## Packages

This repository publishes two packages for the same product family.

### `fortheagent`

The core package. Use it when you want a shell-first workflow:

- `init`
- `sync`
- `doctor`
- `status`
- `work`
- `history`

Typical usage:

```bash
npx fortheagent init
```

### `fortheagent-cli`

The interactive launcher. Use it when you want Guided Setup and a goal-first
terminal workflow. It installs the `fortheagent-cli` command and layers an
interactive launcher on top of the same foundation engine.

Typical usage:

```bash
npm install -g fortheagent-cli
fortheagent-cli
```

## Publishing Model

Yes, both artifacts are npm packages.

- `fortheagent`: the shell-first core package
- `fortheagent-cli`: the interactive launcher package

They are released from one monorepo and versioned together. See
`docs/publishing.md` for the release workflow.

They use different public commands:

- `fortheagent` for the core package
- `fortheagent-cli` for the interactive launcher

## If An Agent Starts From The GitHub URL

If you hand this repository URL to an agent, the fastest reliable reading order
is:

1. Read this `README.md` first for product boundary and package layout.
2. Read `npm/README.md` if the task is about the shell-first core package.
3. Read `cli/README.md` if the task is about the interactive launcher.
4. Read `docs/repository-tour.md` for the shortest code-and-doc map.
5. Read `docs/package-contract.md` if the task needs the generated repository
   contract in detail.
6. Read `docs/template-authoring.md` if the task is about generated file
   structure or template ownership.

When browsing on GitHub, agents should treat:

- `npm/src/` as the canonical core implementation
- `cli/src/` as the interactive wrapper around that core
- `docs/` as human-readable repository specifications
- `dist/` as build output, not source of truth
- `node_modules/` as vendored dependencies, not source of truth

Framework expansion and broader profile coverage are intentionally deferred for
later releases. The current repository should be read as a stable `fortheagent`
core plus launcher, not as a complete framework matrix yet.

## What It Generates

Every resolved repository gets the same contract shape:

- root adapters: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`
- router and knowledge docs under `docs/`
- current handoff and machine metadata under `.agent-foundation/`
- optional subtree adapters for `apps/*`, `packages/*`, `services/*`, and other
  detected work roots
- provider projections for Claude and Cursor rules
- active work items and archived work snapshots

Key generated paths include:

- `.agent-foundation/manifest.json`
- `.agent-foundation/doc-index.json`
- `.agent-foundation/doc-health.json`
- `.agent-foundation/handoffs/current.md`
- `docs/index.md`
- `docs/agents/repo-facts.md`
- `docs/engineering/command-registry.md`
- `docs/operations/runbooks.md`
- `docs/decisions/ADR-0001-template.md`
- `docs/work/index.md`

## Quick Start

### Greenfield repository

```bash
npx fortheagent init
```

### Deferred base contract only

```bash
npx fortheagent init --mode deferred
```

### Existing repository

```bash
npx fortheagent init --project-phase existing
```

### Keep the contract current

```bash
fortheagent sync
fortheagent doctor
fortheagent status
fortheagent history
```

## Open Source Scope

`fortheagent` is an open source repository-context and workflow-contract tool.

In scope:

- repository scanning
- docs contract generation
- current-state and handoff management
- startup adapters for major agent tools
- workflow continuity for active and archived work
- repository health checks

Out of scope:

- scaffolding full product codebases
- choosing the final architecture for the team
- replacing product or engineering judgment

The generated docs are working scaffolds and continuity artifacts, not final
architecture truth.

## Repository Layout

- `README.md`: workspace overview
- `npm/`: core `fortheagent` package
- `cli/`: interactive `fortheagent-cli` package
- `docs/repository-tour.md`: shortest map for humans and agents entering from GitHub
- `cli/provider-integration.md`: provider-specific launcher extensions

## Status

Current release direction:

- one shared foundation engine
- one product name: `fortheagent`
- two distribution forms: shell-first core package and interactive launcher
- identical generated repository output from both entrypoints
