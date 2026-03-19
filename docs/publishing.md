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

## Trusted Publishing

Trusted publishing is the default release path for this repository.

That means the `Release` workflow publishes with GitHub Actions OIDC instead of
an npm token.

Why:

- npm recommends trusted publishing over long-lived publish tokens
- npm can generate provenance automatically for public packages
- there is no write token to rotate or leak in CI

Source:

- [Trusted publishing for npm packages](https://docs.npmjs.com/trusted-publishers/)
- [npm trust](https://docs.npmjs.com/cli/v11/commands/npm-trust/)

## One-Time npm Setup

Each published package must be linked to this repository's release workflow as
a trusted publisher.

Repository:

- `gwkim92/fortheagent`

Workflow file:

- `release.yml`

Packages that need trusted publisher configuration:

- `fortheagent`
- `fortheagent-cli`

If you want to configure this from the CLI, npm currently requires:

- `npm@11.10.0` or newer
- account-level 2FA enabled
- the package to already exist on npm
- granular access tokens are not accepted for `npm trust`

Example commands:

```bash
npx npm@11.11.1 trust github fortheagent --repo gwkim92/fortheagent --file release.yml --yes
npx npm@11.11.1 trust github fortheagent-cli --repo gwkim92/fortheagent --file release.yml --yes
```

You can also configure the same trusted publisher from each package page on
npmjs.com under package settings.

## Commands

From the repository root:

```bash
npm install
npm test
npm run changeset
npm run version-packages
npm run release
```

The release workflow upgrades npm in CI to a trusted-publishing-capable version
before publishing.

The publish step is idempotent:

- if a workspace version is already on npm, release skips it
- if a workspace version is new, release publishes it

That means rerunning the `Release` workflow on the same version should not try
to republish an existing package version.

## Safe Release Flow

1. Add one or more `.changeset/*.md` files for the release.
2. Merge the release-worthy changes into `main`.
3. Ensure trusted publisher is configured for both npm packages.
4. Open GitHub Actions and run the `Release` workflow manually on `main`.
5. If Changesets detects pending changesets, it will create or update the release PR.
6. Merge that release PR into `main`.
7. Run the `Release` workflow manually on `main` again to publish to npm.

## Fallback

If trusted publishing is temporarily unavailable, you can still publish
manually from a local shell with a granular token that has `bypass 2FA`
enabled. That should be treated as a break-glass fallback, not the default
release path.

## Public Commands

The two packages now expose different executables:

- `fortheagent` for shell-first usage
- `fortheagent-cli` for the interactive launcher

That means they can be installed independently without a command-name
collision.
