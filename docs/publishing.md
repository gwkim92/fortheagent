# Publishing fortheagent

`fortheagent` is published as two npm packages from one repository:

- `fortheagent`
- `fortheagent-cli`

## Why Two npm Packages

Yes, the CLI is also an npm package.

That means this repository publishes two npm artifacts:

1. `fortheagent`
   The shell-first core package with `init`, `sync`, `doctor`, `status`,
   `work`, and `history`.
2. `fortheagent-cli`
   The interactive launcher package, built on top of the same foundation engine.

They are one product family, not two unrelated products.

## Repository Strategy

Keep them in one repository.

Reasons:

- the launcher depends on the core package
- generated output must stay identical
- parity tests already assume one shared contract
- versioning and release review are simpler when both move together

Split repositories only if they stop sharing one core engine or begin to ship on
independent release cadences.

## Release Model

This monorepo uses Changesets.

- one release PR is opened from pending changesets
- both packages version together
- once merged to `main`, GitHub Actions publishes both packages

Publish order is:

1. `fortheagent`
2. `fortheagent-cli`

## Required Secrets

GitHub Actions release needs:

- `NPM_TOKEN`

## Commands

From the repository root:

```bash
npm install
npm test
npm run changeset
npm run version-packages
npm run release
```

## Public Commands

The two packages now expose different executables:

- `fortheagent` for shell-first usage
- `fortheagent-cli` for the interactive launcher

That means they can be installed independently without a command-name
collision.
