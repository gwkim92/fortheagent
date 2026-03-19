import { describe, expect, it } from "vitest";
import {
  buildProviderProjectionManifest,
  collectProjectionRefs
} from "../../src/lib/provider-projections.js";
import { validateProjectionParity } from "../../src/lib/projection-parity.js";

describe("provider projections", () => {
  it("builds codex, claude, and gemini projections from one canonical doc set", () => {
    const manifest = buildProviderProjectionManifest();

    expect(manifest.projections.map((projection) => projection.provider)).toEqual([
      "codex",
      "claude",
      "gemini"
    ]);
    expect(new Set(manifest.projections.map((projection) => projection.requiredDocs.join("|"))).size).toBe(1);
  });

  it("collects imports from codex, claude, and gemini entry files", () => {
    expect(
      collectProjectionRefs(
        "AGENTS.md",
        "Read `docs/agents/repo-facts.md` and `docs/index.md`."
      )
    ).toEqual(["docs/agents/repo-facts.md", "docs/index.md"]);

    expect(
      collectProjectionRefs(
        "CLAUDE.md",
        "@docs/agents/repo-facts.md\n@docs/index.md\n@.agent-foundation/handoff/design-ready.md\n"
      )
    ).toEqual([
      ".agent-foundation/handoff/design-ready.md",
      "docs/agents/repo-facts.md",
      "docs/index.md"
    ]);
  });

  it("detects projection parity drift", () => {
    const errors = validateProjectionParity(
      new Map([
        ["AGENTS.md", "Read `docs/index.md`."],
        [
          "CLAUDE.md",
          "@docs/agents/repo-facts.md\n@docs/index.md\n@.agent-foundation/handoff/design-ready.md\n"
        ],
        [
          "GEMINI.md",
          "Read `docs/agents/repo-facts.md`, `docs/index.md`, and `.agent-foundation/handoff/design-ready.md`."
        ]
      ]),
      buildProviderProjectionManifest()
    );

    expect(errors).toContain(
      "Projection parity mismatch: AGENTS.md is missing required doc reference docs/agents/repo-facts.md"
    );
  });
});
