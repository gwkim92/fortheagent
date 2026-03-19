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

- release is manual
- run the `Release` workflow from the `main` branch when you are ready
- if `main` contains pending changesets, the workflow creates or updates the release PR
- if `main` already contains the versioned release commit, the workflow publishes both packages

Publish order is:

1. `fortheagent`
2. `fortheagent-cli`

## Required Secrets

GitHub Actions release needs:

- `NPM_TOKEN`

Repository secret location:

- `Settings`
- `Secrets and variables`
- `Actions`
- add `NPM_TOKEN`

## Commands

From the repository root:

```bash
npm install
npm test
npm run changeset
npm run version-packages
npm run release
```

## Safe Release Flow

1. Add one or more `.changeset/*.md` files for the release.
2. Merge the release-worthy changes into `main`.
3. Open GitHub Actions and run the `Release` workflow manually on `main`.
4. If Changesets detects pending changesets, it will create or update the release PR.
5. Merge that release PR into `main`.
6. Run the `Release` workflow manually on `main` again to publish to npm.

## Public Commands

The two packages now expose different executables:

- `fortheagent` for shell-first usage
- `fortheagent-cli` for the interactive launcher

That means they can be installed independently without a command-name
collision.
