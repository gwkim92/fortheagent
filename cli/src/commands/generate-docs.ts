import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertResolvedRepository, buildSessionContext } from "../lib/repository-context.js";

type WriteResult = "created" | "updated" | "unchanged";

type GenerateDocsResult = {
  created: string[];
  updated: string[];
  unchanged: string[];
  responseText: string;
};

const frontendNarratives: Record<string, string> = {
  next: "In this repository, the frontend owns the presentation layer, route handling, and SEO-facing page delivery.",
  "react-spa":
    "In this repository, the frontend owns the client application shell, interactive views, and browser-side state coordination."
};

const backendNarratives: Record<string, string> = {
  nest: "In this repository, the backend owns API modules, server-side workflows, and integration boundaries.",
  fastify:
    "In this repository, the backend owns HTTP services, transport adapters, and request lifecycle orchestration.",
  serverless:
    "In this repository, the backend owns deployed functions, event handlers, and managed cloud integrations."
};

const systemNarratives: Record<string, string> = {
  "internal-tool": "operator workflows and internal business processes",
  "b2b-saas": "multi-tenant product delivery for external customers",
  "content-site": "publishing and serving site content",
  "api-platform": "exposing and evolving service APIs",
  "realtime-app": "low-latency interactive features",
  "data-platform": "data ingestion, processing, and delivery"
};

function architectureLabel(value: string | null): string {
  switch (value) {
    case "monolith":
      return "monolithic";
    case "modular-monolith":
      return "modular monolith";
    case "service-oriented":
      return "service-oriented";
    case "event-driven":
      return "event-driven";
    default:
      return "repository-specific";
  }
}

function stackPhrase(frontend: string | null, backend: string | null): string {
  if (frontend && backend) {
    return `\`${frontend}\` and \`${backend}\``;
  }

  if (frontend) {
    return `\`${frontend}\``;
  }

  if (backend) {
    return `\`${backend}\``;
  }

  return "foundation-only";
}

function buildManagedDocs(manifest: Awaited<ReturnType<typeof assertResolvedRepository>>) {
  const constraints = manifest.constraints.join(", ") || "none";
  const docs: Array<{ path: string; content: string }> = [
    {
      path: "docs/agents/project-discovery.md",
      content: [
        "# Project Discovery",
        "",
        "Discovery is resolved for this repository.",
        "",
        `- frontend profile: \`${manifest.frontend ?? "none"}\``,
        `- backend profile: \`${manifest.backend ?? "none"}\``,
        `- system type: \`${manifest.systemType ?? "none"}\``,
        `- architecture style: \`${manifest.architectureStyle ?? "none"}\``,
        `- active constraints: ${constraints}`,
        "",
        "Treat `.agent-foundation/manifest.json` as the source of truth for these values."
      ].join("\n")
    },
    {
      path: "docs/architecture/overview.md",
      content: [
        "# Architecture Overview",
        "",
        `This repository is a resolved foundation bootstrap for a \`${manifest.systemType ?? "unknown"}\` built as a`,
        `\`${manifest.architectureStyle ?? "unknown"}\`.`,
        "",
        "The current stack selection is:",
        "",
        `- frontend: \`${manifest.frontend ?? "none"}\``,
        `- backend: \`${manifest.backend ?? "none"}\``,
        "",
        "Use the stack-specific architecture documents alongside",
        "`.agent-foundation/manifest.json` when extending the repository."
      ].join("\n")
    }
  ];

  if (manifest.frontend) {
    docs.push({
      path: "docs/architecture/frontend.md",
      content: [
        "# Frontend Architecture",
        "",
        `This repository uses the \`${manifest.frontend}\` frontend profile.`,
        "",
        frontendNarratives[manifest.frontend] ??
          "In this repository, the frontend owns user-facing delivery and application presentation."
      ].join("\n")
    });
  }

  if (manifest.backend) {
    docs.push({
      path: "docs/architecture/backend.md",
      content: [
        "# Backend Architecture",
        "",
        `This repository uses the \`${manifest.backend}\` backend profile.`,
        "",
        backendNarratives[manifest.backend] ??
          "In this repository, the backend owns service orchestration and server-side workflows."
      ].join("\n")
    });
  }

  if (manifest.systemType) {
    docs.push({
      path: "docs/system/overview.md",
      content: [
        "# System Overview",
        "",
        `This repository is classified as a \`${manifest.systemType}\`.`,
        "",
        `The current implementation target is a ${architectureLabel(manifest.architectureStyle)} ${stackPhrase(
          manifest.frontend,
          manifest.backend
        )} application stack tailored to ${systemNarratives[manifest.systemType] ?? "the selected project domain"}.`
      ].join("\n")
    });
  }

  return docs;
}

async function writeIfChanged(targetPath: string, content: string): Promise<WriteResult> {
  await mkdir(path.dirname(targetPath), { recursive: true });

  try {
    const existing = await readFile(targetPath, "utf8");

    if (existing === content) {
      return "unchanged";
    }

    await writeFile(targetPath, `${content}\n`, "utf8");
    return "updated";
  } catch {
    await writeFile(targetPath, `${content}\n`, "utf8");
    return "created";
  }
}

export async function runGenerateDocs(options: { cwd: string }): Promise<GenerateDocsResult> {
  const manifest = await assertResolvedRepository(options.cwd);
  const docs = buildManagedDocs(manifest);
  const created: string[] = [];
  const updated: string[] = [];
  const unchanged: string[] = [];

  for (const doc of docs) {
    const result = await writeIfChanged(path.join(options.cwd, doc.path), doc.content);

    if (result === "created") {
      created.push(doc.path);
      continue;
    }

    if (result === "updated") {
      updated.push(doc.path);
      continue;
    }

    unchanged.push(doc.path);
  }

  const context = await buildSessionContext(options.cwd);
  const stack = [manifest.frontend, manifest.backend].filter(Boolean).join(" + ") || "no app stack";
  const changedFiles = [...created, ...updated];

  return {
    created: created.sort(),
    updated: updated.sort(),
    unchanged: unchanged.sort(),
    responseText: [
      `Generated project-specific docs for ${stack}.`,
      `Project type: ${manifest.systemType ?? "none"}`,
      `Architecture: ${manifest.architectureStyle ?? "none"}`,
      changedFiles.length > 0
        ? `Updated files: ${changedFiles.join(", ")}`
        : "All generated docs were already up to date.",
      `Context files now available: ${context.documents.map((document) => document.path).join(", ")}`
    ].join("\n")
  };
}
