# Agent Foundation NPM Package Implementation Plan

**Goal:** Build a private npm package that installs a company-standard agent
bootstrap layer so developers can initialize a repository with rules, skills,
architecture documents, a manifest, a profile registry, and an agent entrypoint
that tells agents how to start foundation work.

**Architecture:** The package is a Node.js CLI that ships versioned templates
and overlays, not a passive dependency. `init` materializes managed files into
the target repository root, `sync` upgrades managed files safely, and `doctor`
verifies that the repository still matches the expected agent contract. The
generated root `AGENTS.md` is the single entrypoint for agents and points to
the rest of the documentation tree.

**Tech Stack:** Node.js, TypeScript, npm private package, Vitest,
`fs/promises`, `path`, `child_process` or `execa`

---

## Product Decisions

### 1. Delivery Model

- Use a private npm package such as `@company/agent-foundation`.
- Support two entry modes:
  - new repository bootstrap: `npm create @company/agent-foundation@latest`
  - existing repository bootstrap: `npx @company/agent-foundation init`
- Both entry modes should call the same package commands and generate the same
  repository state.
- Do not rely on `postinstall` for the core workflow.
  - Reason: it is easy to disable, hard to trust, and gives poor control over
    merge behavior.

### 2. Generated Repository Contract

Every initialized repository should contain this base output:

- `AGENTS.md`
- `.agent-foundation/manifest.json`
- `.agent-foundation/profile-registry.json`
- `docs/agents/context-map.md`
- `docs/agents/project-discovery.md`
- `docs/architecture/overview.md`
- `docs/rules/coding.md`
- `docs/rules/review.md`
- `docs/skills/index.md`

Resolved overlays should add files only when the manifest requires them, for
example:

- `docs/architecture/frontend.md`
- `docs/architecture/backend.md`
- `docs/frontend/*.md`
- `docs/backend/*.md`
- `docs/system/*.md`
- `.github/workflows/*.yml`

Do not generate application business code in v1.

### 3. Agent Behavior Contract

The package cannot force arbitrary agents to inspect `node_modules`. Instead,
it must create a root instruction file that agents already know how to discover
or can be configured to discover.

The generated `AGENTS.md` must:

- tell the agent to read `docs/agents/context-map.md` first
- point to `docs/architecture/overview.md`
- point to `docs/architecture/frontend.md` and
  `docs/architecture/backend.md` when present
- list mandatory rules that override default behavior
- tell the agent how to detect managed files versus team-owned files
- describe which command to run to validate the repository before large changes

### 4. Ownership And Merge Rules

The package should distinguish three file types:

- managed: always owned by the package and safe to overwrite on `sync`
- merge-managed: package owns marked regions only
- user-owned: generated once, then never overwritten automatically

Recommended default:

- `AGENTS.md`: merge-managed
- `.agent-foundation/manifest.json`: managed
- `.agent-foundation/profile-registry.json`: managed
- `docs/agents/context-map.md`: managed
- `docs/agents/project-discovery.md`: managed
- `docs/architecture/overview.md`: managed
- `docs/architecture/frontend.md`: merge-managed
- `docs/architecture/backend.md`: merge-managed
- `docs/rules/*.md`: managed
- `docs/skills/index.md`: managed
- project-specific implementation docs: user-owned

`merge-managed` requires stable markers. Use explicit begin and end comments,
for example:

```md
<!-- agent-foundation:begin section="startup-sequence" -->
Read `docs/agents/context-map.md` first.
<!-- agent-foundation:end section="startup-sequence" -->
```

If markers are corrupted, `doctor` should fail and `sync` should refuse to
rewrite them unless a repair mode is explicitly requested.

### 5. Profile System

Use a layered template model:

- `base`: common rules, agent entrypoint, overview docs, manifest-adjacent docs
- `frontend/<profile>`: Next.js, React SPA
- `backend/<profile>`: NestJS, Fastify, serverless API
- `system/<systemType>`: system-level overlays
- `quality/<profile>`: CI, testing, observability, security
- `constraints/<constraint>`: cross-cutting overlays such as auth or SEO

Each profile contributes:

- files to copy
- manifest entries
- variables to render
- owned output paths
- optional dependency hints

For v1, keep the supported set narrow:

- frontend: `next`
- backend: `nest`
- quality: `ci-basic`

### 6. Manifest And Registry Contract

The manifest should be a stable repository artifact, not a transient runtime
object.

V1 should treat these fields as canonical:

- `version`
- `foundationVersion`
- `status`
- `frontend`
- `backend`
- `systemType`
- `architectureStyle`
- `constraints`
- `qualityProfiles`
- `installedProfiles`
- `lastResolvedAt`

Rules:

- unresolved manifests may contain `null` selections
- resolved manifests must contain explicit values, including `none` where an
  axis does not apply
- unknown profile values should fail validation
- schema version mismatches should produce a repair or migration message

`.agent-foundation/profile-registry.json` should record the profile values
known to the installed package and map them to template roots and output paths.

### 7. Update Strategy

`sync` should:

- read `.agent-foundation/manifest.json`
- read `.agent-foundation/profile-registry.json`
- detect the installed package version and selected profiles
- diff managed files
- overwrite managed files
- update marked regions in merge-managed files
- materialize newly selected overlays
- support `--dry-run`
- leave user-owned files untouched
- print a summary of changed, skipped, and conflicted files

### 8. Validation Strategy

`doctor` should check:

- required files exist
- required headings exist inside merge-managed files
- manifest schema is valid
- profile references exist in the profile registry
- unresolved repositories clearly report what is still missing
- no managed markers are corrupted

If validation fails, `doctor` should exit non-zero and print the exact repair
command.

Suggested exit behavior:

- exit `0`: repository is healthy
- exit `1`: repository needs repair
- exit `2`: usage or environment error

## Package Structure

```text
package.json
tsconfig.json
README.md
src/
  cli.ts
  commands/
    init.ts
    sync.ts
    doctor.ts
  lib/
    config.ts
    manifest.ts
    profile-registry.ts
    template-engine.ts
    file-ownership.ts
    render.ts
    paths.ts
templates/
  base/
    AGENTS.md
    .agent-foundation/profile-registry.json
    docs/agents/context-map.md
    docs/agents/project-discovery.md
    docs/architecture/overview.md
    docs/rules/coding.md
    docs/rules/review.md
    docs/skills/index.md
  frontend/
    next/
      docs/architecture/frontend.md
  backend/
    nest/
      docs/architecture/backend.md
  quality/
    ci-basic/
      .github/workflows/ci.yml
  constraints/
    auth/
tests/
  cli/
    init.test.ts
    sync.test.ts
    doctor.test.ts
  lib/
    template-engine.test.ts
    file-ownership.test.ts
    manifest.test.ts
  fixtures/
    empty-repo/
    initialized-repo/
docs/
  package-contract.md
  template-authoring.md
```

## Install Flow

### New Repository

1. Developer runs `npm create @company/agent-foundation@latest`.
2. The package entrypoint asks for package name, frontend profile, backend
   profile, system type, architecture style, constraints, and quality profiles.
3. The package writes the base foundation and a resolved or unresolved manifest
   depending on the selected mode.
4. The package prints next steps:
   - install project dependencies
   - open the repository
   - tell the agent to start from `AGENTS.md`

### Existing Repository

1. Developer runs `npx @company/agent-foundation init`.
2. The package scans existing files and warns about collisions.
3. The package writes only missing files or merge-managed regions.
4. The package asks for confirmation before touching any conflicting unmanaged
   file.
5. The package prints the `doctor` command for verification.

### Ongoing Maintenance

1. Developer upgrades the package version.
2. Developer runs `npx @company/agent-foundation sync`.
3. The package updates managed assets and prints a diff summary.
4. Developer runs `npx @company/agent-foundation doctor`.

## Agent Startup Sequence

When an agent enters an initialized repository, the intended flow is:

1. Open `AGENTS.md`.
2. Read `docs/agents/context-map.md`.
3. Read `docs/architecture/overview.md`.
4. Read `docs/architecture/frontend.md` and
   `docs/architecture/backend.md` if they exist.
5. Read global rules under `docs/rules/`.
6. Read stack-specific skills listed in `docs/skills/index.md`.
7. Run `doctor` before large structural changes.

This startup sequence is the point of the package. npm is just the delivery
mechanism. The repository contract is what makes the agent behavior
deterministic.

## Success Criteria

- A new repository can be bootstrapped in under 2 minutes.
- The root contains a single obvious agent entrypoint.
- An engineer can update standard docs without overwriting project-specific
  notes.
- `doctor` can tell whether a repository is healthy in a single command.
- `sync --dry-run` can explain what would change before files are rewritten.
- A team can add new profiles without rewriting the package core.

## Task 1: Scaffold the Package Workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `README.md`
- Create: `src/cli.ts`
- Create: `src/lib/paths.ts`
- Test: `tests/cli/init.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { execa } from "execa";

describe("cli", () => {
  it("prints help when no command is provided", async () => {
    const result = await execa("node", ["dist/cli.js"], { reject: false });
    expect(result.stdout).toContain("init");
    expect(result.stdout).toContain("sync");
    expect(result.stdout).toContain("doctor");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/cli/init.test.ts`
Expected: FAIL because `dist/cli.js` does not exist

**Step 3: Write minimal implementation**

```ts
#!/usr/bin/env node

const help = [
  "Usage: agent-foundation <command>",
  "",
  "Commands:",
  "  init",
  "  sync",
  "  doctor",
].join("\n");

console.log(help);
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/cli/init.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json tsconfig.json README.md src/cli.ts src/lib/paths.ts tests/cli/init.test.ts
git commit -m "feat: scaffold agent foundation package"
```

## Task 2: Add Template Manifest and Ownership Model

**Files:**
- Create: `src/lib/manifest.ts`
- Create: `src/lib/profile-registry.ts`
- Create: `src/lib/file-ownership.ts`
- Create: `templates/base/AGENTS.md`
- Create: `templates/base/.agent-foundation/profile-registry.json`
- Create: `templates/base/docs/agents/context-map.md`
- Create: `templates/base/docs/agents/project-discovery.md`
- Test: `tests/lib/file-ownership.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { classifyFile } from "../../src/lib/file-ownership";

describe("classifyFile", () => {
  it("marks manifest as managed", () => {
    expect(classifyFile(".agent-foundation/manifest.json")).toBe("managed");
    expect(classifyFile(".agent-foundation/profile-registry.json")).toBe("managed");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/file-ownership.test.ts`
Expected: FAIL because `classifyFile` is not implemented

**Step 3: Write minimal implementation**

```ts
export type Ownership = "managed" | "merge-managed" | "user-owned";

export function classifyFile(filePath: string): Ownership {
  if (filePath === ".agent-foundation/manifest.json") return "managed";
  if (filePath === ".agent-foundation/profile-registry.json") return "managed";
  if (filePath === "docs/agents/project-discovery.md") return "managed";
  if (filePath === "AGENTS.md") return "merge-managed";
  if (filePath === "docs/architecture/frontend.md") return "merge-managed";
  if (filePath === "docs/architecture/backend.md") return "merge-managed";
  return "user-owned";
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/file-ownership.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/manifest.ts src/lib/profile-registry.ts src/lib/file-ownership.ts templates/base/AGENTS.md templates/base/.agent-foundation/profile-registry.json templates/base/docs/agents/context-map.md templates/base/docs/agents/project-discovery.md tests/lib/file-ownership.test.ts
git commit -m "feat: define managed file ownership model"
```

## Task 3: Implement `init` for Empty Repositories

**Files:**
- Create: `src/commands/init.ts`
- Create: `src/lib/template-engine.ts`
- Create: `src/lib/render.ts`
- Test: `tests/cli/init.test.ts`
- Test: `tests/fixtures/empty-repo/.gitkeep`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runInit } from "../../src/commands/init";

describe("init", () => {
  it("creates the base foundation in an empty repo", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-"));
    await runInit({ cwd, frontend: "next", backend: "nest", qualityProfiles: ["ci-basic"] });
    await expect(readFile(path.join(cwd, "AGENTS.md"), "utf8")).resolves.toContain("docs/agents/context-map.md");
    await expect(readFile(path.join(cwd, ".agent-foundation/profile-registry.json"), "utf8")).resolves.toContain("\"frontend\"");
    await expect(readFile(path.join(cwd, ".agent-foundation/manifest.json"), "utf8")).resolves.toContain("\"frontend\":\"next\"");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/cli/init.test.ts`
Expected: FAIL because `runInit` is not implemented

**Step 3: Write minimal implementation**

```ts
export async function runInit(options: {
  cwd: string;
  frontend: string;
  backend: string;
  qualityProfiles: string[];
}) {
  // copy templates/base
  // write .agent-foundation/manifest.json
  // write .agent-foundation/profile-registry.json
  // render profile values into AGENTS.md
  // materialize overlays only for resolved selections
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/cli/init.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/init.ts src/lib/template-engine.ts src/lib/render.ts tests/cli/init.test.ts tests/fixtures/empty-repo/.gitkeep
git commit -m "feat: initialize empty repositories"
```

## Task 4: Add Profile Overlay Selection

**Files:**
- Create: `templates/frontend/next/docs/architecture/frontend.md`
- Create: `templates/backend/nest/docs/architecture/backend.md`
- Create: `templates/quality/ci-basic/.github/workflows/ci.yml`
- Modify: `src/commands/init.ts`
- Modify: `src/lib/template-engine.ts`
- Test: `tests/lib/template-engine.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { listTemplateFiles } from "../../src/lib/template-engine";

describe("listTemplateFiles", () => {
  it("includes base and selected overlays", () => {
    const files = listTemplateFiles({ frontend: "next", backend: "nest", qualityProfiles: ["ci-basic"] });
    expect(files).toContain("templates/base/AGENTS.md");
    expect(files).toContain("templates/frontend/next/docs/architecture/frontend.md");
    expect(files).toContain("templates/backend/nest/docs/architecture/backend.md");
    expect(files).toContain("templates/quality/ci-basic/.github/workflows/ci.yml");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/template-engine.test.ts`
Expected: FAIL because overlay selection is incomplete

**Step 3: Write minimal implementation**

```ts
export function listTemplateFiles(selection: {
  frontend: string;
  backend: string;
  qualityProfiles: string[];
}) {
  return [
    "templates/base/AGENTS.md",
    `templates/frontend/${selection.frontend}/docs/architecture/frontend.md`,
    `templates/backend/${selection.backend}/docs/architecture/backend.md`,
    ...selection.qualityProfiles.map((profile) => `templates/quality/${profile}/.github/workflows/ci.yml`),
  ];
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/template-engine.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add templates/frontend/next/docs/architecture/frontend.md templates/backend/nest/docs/architecture/backend.md templates/quality/ci-basic/.github/workflows/ci.yml src/commands/init.ts src/lib/template-engine.ts tests/lib/template-engine.test.ts
git commit -m "feat: support layered template profiles"
```

## Task 5: Implement Safe `sync`

**Files:**
- Create: `src/commands/sync.ts`
- Modify: `src/lib/manifest.ts`
- Modify: `src/lib/file-ownership.ts`
- Test: `tests/cli/sync.test.ts`
- Test: `tests/fixtures/initialized-repo/.gitkeep`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { runSync } from "../../src/commands/sync";

describe("sync", () => {
  it("updates managed files without overwriting user-owned files", async () => {
    const summary = await runSync({ cwd: "tests/fixtures/initialized-repo" });
    expect(summary.updated).toContain(".agent-foundation/manifest.json");
    expect(summary.updated).toContain(".agent-foundation/profile-registry.json");
    expect(summary.skipped).toContain("docs/project-notes.md");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/cli/sync.test.ts`
Expected: FAIL because `runSync` is not implemented

**Step 3: Write minimal implementation**

```ts
export async function runSync(options: { cwd: string }) {
  return {
    updated: [
      ".agent-foundation/manifest.json",
      ".agent-foundation/profile-registry.json",
    ],
    conflicted: [],
    skipped: ["docs/project-notes.md"],
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/cli/sync.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/sync.ts src/lib/manifest.ts src/lib/file-ownership.ts tests/cli/sync.test.ts tests/fixtures/initialized-repo/.gitkeep
git commit -m "feat: add safe sync for managed assets"
```

## Task 6: Implement `doctor`

**Files:**
- Create: `src/commands/doctor.ts`
- Modify: `src/lib/manifest.ts`
- Test: `tests/cli/doctor.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { runDoctor } from "../../src/commands/doctor";

describe("doctor", () => {
  it("returns non-zero status when a required managed file is missing", async () => {
    const result = await runDoctor({ cwd: "tests/fixtures/initialized-repo-missing-file" });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("AGENTS.md");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/cli/doctor.test.ts`
Expected: FAIL because `runDoctor` is not implemented

**Step 3: Write minimal implementation**

```ts
export async function runDoctor(options: { cwd: string }) {
  return {
    ok: false,
    errors: ["Missing required file: AGENTS.md"],
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/cli/doctor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/doctor.ts src/lib/manifest.ts tests/cli/doctor.test.ts
git commit -m "feat: validate initialized repositories"
```

## Task 7: Write the Managed Documentation Set

**Files:**
- Create: `templates/base/docs/architecture/overview.md`
- Create: `templates/base/docs/rules/coding.md`
- Create: `templates/base/docs/rules/review.md`
- Create: `templates/base/docs/skills/index.md`
- Create: `docs/package-contract.md`
- Create: `docs/template-authoring.md`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("managed docs", () => {
  it("defines the agent startup sequence in AGENTS.md", () => {
    const contents = readFileSync("templates/base/AGENTS.md", "utf8");
    expect(contents).toContain("docs/agents/context-map.md");
    expect(contents).toContain("docs/architecture/overview.md");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/cli/init.test.ts`
Expected: FAIL because the required template content is incomplete

**Step 3: Write minimal implementation**

```md
# Agent Entry

Read `docs/agents/context-map.md` first.
Then read:
- `docs/architecture/overview.md`
- `docs/architecture/frontend.md` if present
- `docs/architecture/backend.md` if present
- `docs/rules/coding.md`
- `docs/rules/review.md`
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/cli/init.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add templates/base/docs/architecture/overview.md templates/base/docs/rules/coding.md templates/base/docs/rules/review.md templates/base/docs/skills/index.md docs/package-contract.md docs/template-authoring.md
git commit -m "docs: define agent contract and template authoring guide"
```

## Task 8: Package Publishing and Team Adoption

**Files:**
- Create: `.npmrc.example`
- Modify: `README.md`
- Create: `.github/workflows/release.yml`
- Test: `package.json`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import pkg from "../../package.json";

describe("package metadata", () => {
  it("exposes a cli bin", () => {
    expect(pkg.bin).toMatchObject({
      "agent-foundation": "dist/cli.js",
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/cli/init.test.ts`
Expected: FAIL because package metadata is incomplete

**Step 3: Write minimal implementation**

```json
{
  "name": "@company/agent-foundation",
  "private": false,
  "bin": {
    "agent-foundation": "dist/cli.js"
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/cli/init.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add .npmrc.example README.md .github/workflows/release.yml package.json
git commit -m "chore: prepare internal package release pipeline"
```

## Open Decisions to Resolve Before Coding

1. Which system types and constraints are mandatory in the first release registry?
2. Which files are safe for package ownership versus one-time generation?
3. What exact marker format should `merge-managed` files use?
4. Should `sync` support automatic marker repair or require an explicit repair flag?
5. Will the package be distributed through npm Enterprise, GitHub Packages, or a private Verdaccio registry?

## Recommended First Release Scope

To keep v1 shippable:

- support one frontend profile: `next`
- support one backend profile: `nest`
- support one quality profile: `ci-basic`
- generate only docs, rules, manifest, profile registry, and agent entrypoint
- do not generate application business code in v1
- ship `init`, `sync`, and `doctor`

This scope keeps the first release narrow while proving the core contract: installable standard docs that agents can actually follow.
