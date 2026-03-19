# fortheagent-cli

`fortheagent-cli` is the interactive launcher for the `fortheagent` product
family.

It uses the same foundation engine as the core package, but adds a
launcher-first workflow, Guided Setup, and goal-first terminal entry.

## Install

```bash
npm install -g fortheagent-cli
```

Then run:

```bash
fortheagent-cli
```

## What This Package Adds

Compared with the core `fortheagent` package, this launcher adds:

- Guided Setup for discovery and repository maintenance
- Ask mode for goal-first terminal workflows
- provider integration as an optional extension
- local workflows before provider escalation

It does not define a different repository contract. Generated output must stay
identical to the core package.

## Launcher Flow

1. Run `fortheagent-cli`.
2. Choose `Guided Setup` or `Ask forTheAgent`.
3. Let the launcher inspect the repository state.
4. Generate, sync, or validate the same docs contract as the core package.
5. Attach a provider only when a workflow actually needs one.

## Direct Commands

The launcher also supports shell-first subcommands:

```bash
fortheagent-cli init
fortheagent-cli init --mode deferred
fortheagent-cli sync
fortheagent-cli doctor
fortheagent-cli status
fortheagent-cli work --mode implementation --active-work-item 0002-auth-boundary
fortheagent-cli history
```

## Provider Features

Provider support is optional. The launcher can work without an AI backend for
repository setup and maintenance.

Provider-specific behavior is documented in
`provider-integration.md`.

## Product Boundary

`fortheagent-cli` is still the same product as `fortheagent`.

Shared:

- manifest schema
- profile registry
- render engine
- `init`, `sync`, `doctor`, `status`, `work`, and `history`
- generated repository output

Launcher-only:

- terminal home screen
- Guided Setup UX
- goal-first session shell
- provider selection and session attachment

## Open Source Positioning

Use this package if you want a more guided terminal experience than raw
subcommands, but still want the same repository contract and the same
machine-checked docs lifecycle.
