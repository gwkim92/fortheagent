# fortheagent Repository Tour

This file is the shortest internal map for humans or agents that started from
the GitHub repository URL and need to understand the codebase quickly.

## What This Repository Ships

This repository ships one product family with two packages:

- `fortheagent`: the shell-first core package
- `fortheagent-cli`: the interactive launcher

Both packages should generate the same repository contract. The difference is
entry experience, not generated output.

## Read In This Order

1. `README.md`
2. `npm/README.md`
3. `cli/README.md`
4. `docs/package-contract.md`
5. `docs/template-authoring.md`

Stop early if your task is already clear. Do not bulk-read the whole repo by
default.

## Source Of Truth Map

### Core package

- `npm/src/`: canonical implementation of scan, init, sync, doctor, status,
  work, and history
- `npm/templates/`: merge-managed and profile-specific generated content
- `npm/tests/`: contract and regression coverage for the core package

### Interactive launcher

- `cli/src/`: launcher UX, provider integration, and goal-first workflows
- `cli/tests/`: launcher-specific regression coverage
- `cli/provider-integration.md`: provider-specific behavior and boundaries

### Repository specifications

- `docs/package-contract.md`: the generated repository contract
- `docs/template-authoring.md`: how templates and generated files are owned

## What To Ignore At First

Unless your task is specifically about packaging or build output, ignore:

- `dist/`
- `node_modules/`

They are not the source of truth for design or implementation decisions.

## Current Product Boundary

`fortheagent` is a repository-context and workflow-contract tool.

It does:

- repository scanning
- docs contract generation
- startup adapters for Codex, Claude Code, and Gemini CLI
- workflow-state continuity
- machine-checked document health

It does not:

- scaffold finished business applications
- choose final architecture for a team
- provide a fully expanded framework matrix yet

Framework expansion is intentionally deferred. If you find the current frontend
or backend option set narrow, treat that as roadmap context, not as an
accidental omission in the current release scope.

## Where To Start For Common Tasks

If the task is about package naming, install UX, or publish metadata:

- `README.md`
- `npm/package.json`
- `cli/package.json`
- `npm/README.md`
- `cli/README.md`

If the task is about generated docs or contract behavior:

- `docs/package-contract.md`
- `npm/src/lib/foundation-content.ts`
- `npm/src/lib/doc-contract.ts`
- `npm/src/commands/doctor.ts`

If the task is about the interactive launcher:

- `cli/src/run-cli.ts`
- `cli/src/app/run-app.ts`
- `cli/src/app/run-session-shell.ts`
- `cli/src/lib/foundation-engine.ts`
