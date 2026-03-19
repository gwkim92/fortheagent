# Agent Foundation Package Contract

## Purpose

This document defines the repository contract that the npm package must
materialize and maintain.

The package target is no longer a generic repository bootstrap. The target is a
design-ready workspace for Codex and Claude Code:

- concise root entry files
- a structured design-document pack
- stable manifest and registry artifacts
- explicit context-budget metadata
- provider projection metadata
- selection-driven overlays for constraints, practices, and automation
- a handoff prompt that tells the next agent how to proceed

## Core Product Behavior

`init` must:

1. scan the repository
2. ask only for missing high-value product or domain context
3. collect selected profiles and practices
4. write the full design-ready contract
5. run validation automatically at the end

`sync` must:

- restore managed files
- update merge-managed blocks
- validate against the repository copy of `profile-registry.json`
- support `--dry-run`, `--repair`, and `--prune`

`doctor` must:

- validate the manifest
- validate the repository registry copy
- validate required design docs
- validate root entry contracts
- validate merge-managed markers
- detect managed file drift

## Repository States

### `unresolved`

The base foundation exists, but the project is not fully classified yet.

Properties:

- `manifest.status` is `unresolved`
- unresolved axes may be `null`
- only base files are guaranteed

### `resolved`

The repository has explicit selections and matching overlays have been written.

Properties:

- `manifest.status` is `resolved`
- required axes have concrete values
- selected overlays should exist

## Base Output

Every initialized repository must contain:

- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- `.agent-foundation/manifest.json`
- `.agent-foundation/profile-registry.json`
- `.agent-foundation/context-budget.json`
- `.agent-foundation/provider-projections.json`
- `.agent-foundation/doc-index.json`
- `.agent-foundation/doc-health.json`
- `.agent-foundation/handoffs/current.md`
- `.agent-foundation/handoff/design-ready.md`
- `.agents/skills/docs-writer/SKILL.md`
- `.agents/skills/repo-review/SKILL.md`
- `.agents/skills/verification/SKILL.md`
- `.agents/skills/architecture-brief/SKILL.md`
- `.claude/rules/index.md`
- `.claude/rules/architecture.md`
- `.claude/rules/testing.md`
- `.cursor/rules/architecture.mdc`
- `.cursor/rules/testing.mdc`
- `docs/index.md`
- `docs/agents/context-map.md`
- `docs/agents/repo-facts.md`
- `docs/agents/design-handoff.md`
- `docs/agents/docs-contract.md`
- `docs/product/index.md`
- `docs/product/problem-and-users.md`
- `docs/product/domain-glossary.md`
- `docs/product/constraints.md`
- `docs/architecture/overview.md`
- `docs/architecture/domain-boundaries.md`
- `docs/architecture/data-and-integrations.md`
- `docs/architecture/decision-log.md`
- `docs/engineering/index.md`
- `docs/engineering/testing-strategy.md`
- `docs/engineering/delivery-workflow.md`
- `docs/engineering/verification.md`
- `docs/engineering/command-registry.md`
- `docs/operations/index.md`
- `docs/operations/environments.md`
- `docs/operations/runbooks.md`
- `docs/decisions/index.md`
- `docs/decisions/ADR-0001-template.md`
- `docs/work/index.md`
- `docs/rules/index.md`
- `docs/rules/coding.md`
- `docs/rules/review.md`
- `docs/rules/testing.md`
- `docs/rules/documentation.md`
- `docs/skills/index.md`
- `docs/skills/design.md`
- `docs/skills/testing.md`
- `docs/skills/research.md`

## Overlay Output

Overlay files are installed only when selected by the manifest.

Examples:

- `docs/architecture/frontend.md`
- `docs/architecture/backend.md`
- `docs/system/overview.md`
- `docs/product/constraints/<constraint>.md`
- `docs/practices/<practice>.md`
- `.claude/rules/<selection>.md`
- `.cursor/rules/<selection>.mdc`
- `.github/workflows/ci.yml`

## Root Contract

### `AGENTS.md`

- Codex entrypoint
- short and procedural
- must reference:
  - `docs/agents/repo-facts.md`
  - `docs/index.md`
  - `.agent-foundation/handoffs/current.md`

### `CLAUDE.md`

- Claude Code entrypoint
- short and procedural
- uses a small import set instead of a giant memory file
- must reference:
  - `@docs/agents/repo-facts.md`
  - `@docs/index.md`
  - `@.agent-foundation/handoffs/current.md`

### `GEMINI.md`

- Gemini CLI entrypoint
- short and procedural
- points to the same canonical doc set as the Codex and Claude projections
- must reference:
  - `docs/agents/repo-facts.md`
  - `docs/index.md`
  - `.agent-foundation/handoffs/current.md`

## Document Fill Model

Generated design docs should be useful on first write. They should not be empty
stubs.

Skill guidance docs should also be useful on first write. They should:

- name recommended skills for the current stack and constraints
- note which recommended skills are already installed locally when detectable
- tell the next agent to propose installation when a recommended skill is missing
- treat `.agents/skills/*` as on-demand capability packs rather than startup context

Where applicable, documents should organize content into:

- `Confirmed facts`
- `Working assumptions`
- `Open questions`
- `Required outputs`

Confirmed facts come from repository scan data or explicit user answers.
Assumptions are allowed, but they must be labeled as assumptions.

## Manifest Contract

### Required fields

| Field | Type | Notes |
| --- | --- | --- |
| `version` | string | Manifest schema version |
| `foundationVersion` | string | Package version that last wrote assets |
| `status` | string | `unresolved` or `resolved` |
| `frontend` | string or null | Frontend selection |
| `backend` | string or null | Backend selection |
| `systemType` | string or null | Product/system classification |
| `architectureStyle` | string or null | Codebase structure classification |
| `constraints` | string[] | Selected cross-cutting requirements |
| `qualityProfiles` | string[] | Automation or quality overlays |
| `practiceProfiles` | string[] | Engineering practice overlays |
| `projectContext` | object | Product/domain answers captured during init |
| `installedProfiles` | string[] | Canonical applied profile identifiers |
| `lastResolvedAt` | string or null | ISO timestamp or `null` |

### `projectContext` shape

| Field | Type |
| --- | --- |
| `primaryProduct` | string |
| `targetUsers` | string[] |
| `coreEntities` | string[] |
| `criticalRisks` | string[] |
| `deliveryPriorities` | string[] |

### Supported enums

- `frontend`
  - `next`
  - `react-spa`
  - `none`
- `backend`
  - `nest`
  - `fastify`
  - `serverless`
  - `none`
- `systemType`
  - `internal-tool`
  - `b2b-saas`
  - `content-site`
  - `api-platform`
  - `realtime-app`
  - `data-platform`
- `architectureStyle`
  - `monolith`
  - `modular-monolith`
  - `service-oriented`
  - `event-driven`
- `constraints`
  - `seo`
  - `auth`
  - `payments`
  - `multi-tenant`
  - `pii`
  - `offline`
  - `realtime`
- `qualityProfiles`
  - `ci-basic`
- `practiceProfiles`
  - `ddd-core`
  - `tdd-first`
  - `strict-verification`

### Installed profile format

`installedProfiles` must be derived canonically from the manifest using:

- `base`
- `frontend:*`
- `backend:*`
- `system:*`
- `architecture:*`
- `quality:*`
- `practice:*`
- `constraint:*`

## Profile Registry Contract

`.agent-foundation/profile-registry.json` is the repository-local copy of the
package registry.

It must:

- declare valid values per axis
- map each profile value to template roots
- declare expected outputs
- include axes for:
  - `frontend`
  - `backend`
  - `systemType`
  - `architectureStyle`
  - `quality`
  - `practice`
  - `constraints`

The repository copy is the source used by `sync` and `doctor`.

## Ownership Rules

### `managed`

The package fully rewrites the file on `sync`.

Examples:

- `.agent-foundation/manifest.json`
- `.agent-foundation/profile-registry.json`
- `.agent-foundation/doc-index.json`
- `.agent-foundation/doc-health.json`
- `.agent-foundation/handoffs/current.md`
- `.agent-foundation/handoff/design-ready.md`
- `.claude/rules/architecture.md`
- `.cursor/rules/architecture.mdc`
- `docs/agents/repo-facts.md`
- `.github/workflows/ci.yml`

### `merge-managed`

The package only rewrites managed blocks.

Examples:

- `AGENTS.md`
- `CLAUDE.md`
- most design docs under `docs/`

### `user-owned`

The package leaves the file alone.

## Marker Rules

All merge-managed files must use:

```md
<!-- agent-foundation:begin section="section-name" -->
Managed content here.
<!-- agent-foundation:end section="section-name" -->
```

Rules:

- section names must match
- section names must be unique per file
- nested markers are invalid
- content outside markers is user-owned

## Current V1 Expectations

V1 should remain focused:

- no business-code generation
- no automatic agent launch
- generated docs are English-first
- CI generation should use discovered scripts when possible
- selected constraints and practices must materially change generated docs

## Validation Expectations

`doctor` should fail when:

- required files are missing
- selected profiles are invalid
- root contract references are missing
- managed markers are corrupted
- managed file content drifts from generated content
- required overlay files are missing

`doctor` should warn when:

- stale merge-managed overlays exist
- registry rewrite is recommended
- always-loaded startup surface grows beyond budget
- long guidance lines are duplicated across too many docs

`sync --prune` should remove only stale managed overlays, not stale
merge-managed documents.
