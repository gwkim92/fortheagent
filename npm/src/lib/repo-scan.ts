import { access, readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { classifyFile } from "./file-ownership.js";

type PackageJsonShape = {
  name?: string;
  packageManager?: string;
  workspaces?: unknown;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type SubtreePackage = {
  root: string;
  packageJson: PackageJsonShape | null;
};

export type SubtreeScan = {
  root: string;
  packageName: string | null;
  scripts: Record<string, string>;
  routeHints: string[];
  apiHints: string[];
  testHints: string[];
  realtimeToolHints: string[];
  importantFiles: string[];
};

export type RepositoryScan = {
  root: string;
  packageManager: "npm" | "pnpm" | "yarn" | "bun" | "unknown";
  installCommand: string;
  workspaceLayout: "single-package" | "monorepo";
  packageName: string | null;
  scripts: Record<string, string>;
  existingDocs: string[];
  hasCi: boolean;
  ciFiles: string[];
  frontendHints: string[];
  backendHints: string[];
  routeHints: string[];
  apiHints: string[];
  dataHints: string[];
  realtimeToolHints: string[];
  dataToolHints: string[];
  testHints: string[];
  systemTypeHints: string[];
  architectureStyleHints: string[];
  phaseRecommendation: "greenfield" | "existing";
  phaseRecommendationReasons: string[];
  importantFiles: string[];
  subtreeRoots: string[];
  subtrees: SubtreeScan[];
  availableSkills: string[];
  hasSkillInstaller: boolean;
};

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readPackageJson(cwd: string): Promise<PackageJsonShape | null> {
  try {
    return JSON.parse(await readFile(path.join(cwd, "package.json"), "utf8")) as PackageJsonShape;
  } catch {
    return null;
  }
}

function detectPackageManagerFromPackageJson(
  packageJson: PackageJsonShape | null
): RepositoryScan["packageManager"] {
  const value = packageJson?.packageManager ?? "";

  if (value.startsWith("pnpm@")) {
    return "pnpm";
  }

  if (value.startsWith("yarn@")) {
    return "yarn";
  }

  if (value.startsWith("bun@")) {
    return "bun";
  }

  if (value.startsWith("npm@")) {
    return "npm";
  }

  return "unknown";
}

function collectDependencyMap(packageJson: PackageJsonShape | null): Record<string, string> {
  return {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {})
  };
}

function pushUnique(values: string[], value: string): void {
  if (!values.includes(value)) {
    values.push(value);
  }
}

function isPlaceholderScript(name: string, command: string | undefined): boolean {
  if (!command) {
    return false;
  }

  const normalized = command.trim().replace(/\s+/g, " ").toLowerCase();

  if (
    name === "test" &&
    normalized.includes("no test specified") &&
    normalized.includes("exit 1")
  ) {
    return true;
  }

  return false;
}

async function collectExistingDocs(cwd: string): Promise<string[]> {
  const docsRoot = path.join(cwd, "docs");
  try {
    const entries = await readdir(docsRoot, { recursive: true });
    return entries
      .filter(
        (entry) =>
          typeof entry === "string" &&
          (entry.endsWith(".md") || entry.endsWith(".mdc")) &&
          classifyFile(path.join("docs", entry)) === "user-owned"
      )
      .map((entry) => path.join("docs", entry))
      .sort();
  } catch {
    return [];
  }
}

async function collectUserOwnedCiFiles(cwd: string): Promise<string[]> {
  const workflowsRoot = path.join(cwd, ".github", "workflows");

  try {
    const entries = await readdir(workflowsRoot, { recursive: true });

    return entries
      .filter(
        (entry) =>
          typeof entry === "string" &&
          (entry.endsWith(".yml") || entry.endsWith(".yaml")) &&
          classifyFile(path.join(".github", "workflows", entry)) === "user-owned"
      )
      .map((entry) => path.join(".github", "workflows", entry))
      .sort();
  } catch {
    return [];
  }
}

function extractWorkspacePatterns(packageJson: PackageJsonShape | null): string[] {
  const raw = packageJson?.workspaces;

  if (Array.isArray(raw)) {
    return raw.filter((value): value is string => typeof value === "string");
  }

  if (
    typeof raw === "object" &&
    raw !== null &&
    "packages" in raw &&
    Array.isArray((raw as { packages?: unknown }).packages)
  ) {
    return (raw as { packages: unknown[] }).packages.filter(
      (value): value is string => typeof value === "string"
    );
  }

  return [];
}

async function collectSubtreeRoots(
  cwd: string,
  packageJson: PackageJsonShape | null
): Promise<string[]> {
  const subtreeRoots: string[] = [];
  const workspacePatterns = extractWorkspacePatterns(packageJson);
  const monorepoParents = ["apps", "packages", "services"];
  const extraParents: string[] = [];
  const explicitRoots: string[] = [];

  for (const pattern of workspacePatterns) {
    const normalized = pattern.replaceAll("\\", "/").replace(/^\.\/+/, "");

    if (normalized.endsWith("/*")) {
      pushUnique(extraParents, normalized.slice(0, -2).replace(/\/$/, ""));
      continue;
    }

    if (normalized.endsWith("/**")) {
      pushUnique(extraParents, normalized.slice(0, -3).replace(/\/$/, ""));
      continue;
    }

    pushUnique(explicitRoots, normalized.replace(/\/$/, ""));
  }

  for (const rootPath of explicitRoots) {
    if (await fileExists(path.join(cwd, rootPath))) {
      pushUnique(subtreeRoots, rootPath);
    }
  }

  for (const parent of [...monorepoParents, ...extraParents]) {
    try {
      const entries = await readdir(path.join(cwd, parent), { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          pushUnique(subtreeRoots, path.posix.join(parent, entry.name));
        }
      }
    } catch {
      continue;
    }
  }

  for (const candidate of [
    "app",
    "pages",
    "src",
    "src/app",
    "src/pages",
    "src/routes",
    "src/api",
    "frontend",
    "backend",
    "server"
  ]) {
    if (subtreeRoots.length >= 5) {
      break;
    }

    if (await fileExists(path.join(cwd, candidate))) {
      pushUnique(subtreeRoots, candidate);
    }
  }

  return subtreeRoots.slice(0, 5).sort();
}

async function collectSubtreePackages(
  cwd: string,
  subtreeRoots: string[]
): Promise<SubtreePackage[]> {
  const nested = await Promise.all(
    subtreeRoots.map(async (root) => ({
      root,
      packageJson: await readPackageJson(path.join(cwd, root))
    }))
  );

  return nested.filter((entry) => entry.packageJson !== null);
}

function isWorkspaceLayout(packageJson: PackageJsonShape | null, hasPnpmWorkspace: boolean): boolean {
  return hasPnpmWorkspace || extractWorkspacePatterns(packageJson).length > 0;
}

async function collectCandidateSourceFiles(
  cwd: string,
  subtreeRoots: string[],
  limit = 40
): Promise<string[]> {
  const files: string[] = [];
  const queue = [...subtreeRoots];
  const ignoredDirectories = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    ".turbo",
    ".cache",
    "coverage"
  ]);
  const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

  while (queue.length > 0 && files.length < limit) {
    const relative = queue.shift();

    if (!relative) {
      continue;
    }

    const entries = await readdir(path.join(cwd, relative), { withFileTypes: true }).catch(
      () => null
    );

    if (!entries) {
      continue;
    }

    for (const entry of entries) {
      if (files.length >= limit) {
        break;
      }

      const entryRelative = path.posix.join(relative.replaceAll(path.sep, "/"), entry.name);

      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) {
          queue.push(entryRelative);
        }
        continue;
      }

      if (entry.isFile() && allowedExtensions.has(path.extname(entry.name))) {
        files.push(entryRelative);
      }
    }
  }

  return files;
}

async function collectSubtreeContentHints(
  cwd: string,
  subtreeRoots: string[]
): Promise<{
  realtimeToolHints: string[];
  importantFiles: string[];
}> {
  const realtimeToolHints: string[] = [];
  const importantFiles: string[] = [];
  const candidateFiles = await collectCandidateSourceFiles(cwd, subtreeRoots);

  for (const relativePath of candidateFiles) {
    let content = "";

    try {
      content = await readFile(path.join(cwd, relativePath), "utf8");
    } catch {
      continue;
    }

    const normalized = content.toLowerCase();

    if (normalized.includes("socket.io")) {
      pushUnique(realtimeToolHints, "socket.io");
      pushUnique(importantFiles, relativePath);
    }

    if (
      normalized.includes("new websocket(") ||
      normalized.includes("from \"ws\"") ||
      normalized.includes("from 'ws'") ||
      normalized.includes("require(\"ws\")") ||
      normalized.includes("require('ws')")
    ) {
      pushUnique(realtimeToolHints, "ws");
      pushUnique(importantFiles, relativePath);
    }

    if (normalized.includes("ably")) {
      pushUnique(realtimeToolHints, "ably");
      pushUnique(importantFiles, relativePath);
    }

    if (normalized.includes("pusher")) {
      pushUnique(realtimeToolHints, "pusher");
      pushUnique(importantFiles, relativePath);
    }
  }

  return {
    realtimeToolHints,
    importantFiles
  };
}

function determineInstallCommand(input: {
  packageManager: RepositoryScan["packageManager"];
  packageJsonExists: boolean;
  hasPackageLock: boolean;
  hasPnpmLock: boolean;
  hasYarnLock: boolean;
  hasBunLock: boolean;
}): string {
  const {
    packageManager,
    packageJsonExists,
    hasPackageLock,
    hasPnpmLock,
    hasYarnLock,
    hasBunLock
  } = input;

  switch (packageManager) {
    case "pnpm":
      return hasPnpmLock ? "pnpm install --frozen-lockfile" : "pnpm install";
    case "yarn":
      return hasYarnLock ? "yarn install --frozen-lockfile" : "yarn install";
    case "bun":
      return hasBunLock ? "bun install --frozen-lockfile" : "bun install";
    case "npm":
      return hasPackageLock ? "npm ci" : "npm install";
    default:
      return packageJsonExists
        ? "npm install"
        : 'echo "No package.json detected during foundation setup."';
  }
}

function buildPhaseRecommendation(input: {
  existingDocs: string[];
  importantFiles: string[];
  hasCi: boolean;
  scripts: Record<string, string>;
  workspaceLayout: RepositoryScan["workspaceLayout"];
  subtreeRoots: string[];
  frontendHints: string[];
  backendHints: string[];
  routeHints: string[];
  apiHints: string[];
  dataHints: string[];
  realtimeToolHints: string[];
  dataToolHints: string[];
  testHints: string[];
}): {
  recommendation: "greenfield" | "existing";
  reasons: string[];
} {
  const reasons: string[] = [];
  let signalCount = 0;

  if (
    input.frontendHints.length > 0 ||
    input.backendHints.length > 0 ||
    input.routeHints.length > 0 ||
    input.apiHints.length > 0
  ) {
    signalCount += 1;
    reasons.push("source structure or stack hints already exist");
  }

  if (input.workspaceLayout === "monorepo" && input.subtreeRoots.length > 0) {
    signalCount += 2;
    reasons.push("workspace packages or monorepo roots already exist");
  }

  const userDocsDetected =
    input.existingDocs.some((filePath) => classifyFile(filePath) === "user-owned") ||
    input.importantFiles.includes("README.md");
  if (userDocsDetected) {
    signalCount += 1;
    reasons.push("existing repository docs are present");
  }

  if (input.hasCi) {
    signalCount += 1;
    reasons.push("CI workflow is already configured");
  }

  if (Object.keys(input.scripts).length > 0) {
    signalCount += 1;
    reasons.push("meaningful package scripts already exist");
  }

  if (
    input.dataHints.length > 0 ||
    input.realtimeToolHints.length > 0 ||
    input.dataToolHints.length > 0
  ) {
    signalCount += 1;
    reasons.push("data or infrastructure tooling is already configured");
  }

  if (input.apiHints.length > 0 || input.testHints.length > 0) {
    signalCount += 1;
    reasons.push("API or test surfaces already exist");
  }

  if (signalCount >= 2) {
    return {
      recommendation: "existing",
      reasons
    };
  }

  return {
    recommendation: "greenfield",
    reasons:
      reasons.length > 0
        ? reasons
        : ["very little existing project structure was detected"]
  };
}

async function collectSkillNamesFromDirectory(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          return collectSkillNamesFromDirectory(fullPath);
        }

        if (entry.isFile() && entry.name === "SKILL.md") {
          return [path.basename(path.dirname(fullPath))];
        }

        return [];
      })
    );

    return nested.flat();
  } catch {
    return [];
  }
}

async function collectLocalSkillNames(): Promise<string[]> {
  const codexHome = process.env.CODEX_HOME ?? path.join(homedir(), ".codex");
  const roots = [path.join(homedir(), ".agents", "skills"), path.join(codexHome, "skills")];
  const names = await Promise.all(roots.map((root) => collectSkillNamesFromDirectory(root)));

  return [...new Set(names.flat().filter(Boolean))].sort();
}

export async function scanRepository(cwd: string): Promise<RepositoryScan> {
  const packageJson = await readPackageJson(cwd);
  const dependencies = collectDependencyMap(packageJson);
  const packageManagerFromManifest = detectPackageManagerFromPackageJson(packageJson);
  let packageManager: RepositoryScan["packageManager"] = packageManagerFromManifest;
  const packageJsonExists = packageJson !== null;
  const hasPnpmLock = await fileExists(path.join(cwd, "pnpm-lock.yaml"));
  const hasYarnLock = await fileExists(path.join(cwd, "yarn.lock"));
  const hasBunLock =
    (await fileExists(path.join(cwd, "bun.lockb"))) ||
    (await fileExists(path.join(cwd, "bun.lock")));
  const hasPackageLock =
    (await fileExists(path.join(cwd, "package-lock.json"))) ||
    (await fileExists(path.join(cwd, "npm-shrinkwrap.json")));

  if (packageManager === "unknown") {
    if (hasPnpmLock) {
      packageManager = "pnpm";
    } else if (hasYarnLock) {
      packageManager = "yarn";
    } else if (hasBunLock) {
      packageManager = "bun";
    } else if (hasPackageLock) {
      packageManager = "npm";
    } else if (packageJsonExists) {
      packageManager = "npm";
    }
  }

  const installCommand = determineInstallCommand({
    packageManager,
    packageJsonExists,
    hasPackageLock,
    hasPnpmLock,
    hasYarnLock,
    hasBunLock
  });

  const hasPnpmWorkspace = await fileExists(path.join(cwd, "pnpm-workspace.yaml"));
  const workspaceLayout = isWorkspaceLayout(packageJson, hasPnpmWorkspace)
    ? "monorepo"
    : "single-package";
  const subtreeRoots = await collectSubtreeRoots(cwd, packageJson);
  const subtreePackages = await collectSubtreePackages(cwd, subtreeRoots);

  const frontendHints: string[] = [];
  const backendHints: string[] = [];
  const routeHints: string[] = [];
  const apiHints: string[] = [];
  const dataHints: string[] = [];
  const realtimeToolHints: string[] = [];
  const dataToolHints: string[] = [];
  const testHints: string[] = [];
  const systemTypeHints: string[] = [];
  const architectureStyleHints: string[] = [];
  const importantFiles: string[] = [];
  const subtrees: SubtreeScan[] = [];
  const availableSkills = await collectLocalSkillNames();

  if ("next" in dependencies || (await fileExists(path.join(cwd, "next.config.js")))) {
    pushUnique(frontendHints, "next");
    pushUnique(importantFiles, "next.config.js");
  }

  if (
    !frontendHints.includes("next") &&
    ("react" in dependencies || "react-dom" in dependencies)
  ) {
    pushUnique(frontendHints, "react-spa");
  }

  if ("@nestjs/core" in dependencies || "@nestjs/common" in dependencies) {
    pushUnique(backendHints, "nest");
  }

  if ("fastify" in dependencies || "@fastify/swagger" in dependencies) {
    pushUnique(backendHints, "fastify");
  }

  if (
    "serverless" in dependencies ||
    "@serverless/typescript" in dependencies ||
    (await fileExists(path.join(cwd, "serverless.yml"))) ||
    (await fileExists(path.join(cwd, "serverless.ts")))
  ) {
    pushUnique(backendHints, "serverless");
    pushUnique(architectureStyleHints, "event-driven");
    if (await fileExists(path.join(cwd, "serverless.yml"))) {
      pushUnique(importantFiles, "serverless.yml");
    }
    if (await fileExists(path.join(cwd, "serverless.ts"))) {
      pushUnique(importantFiles, "serverless.ts");
    }
  }

  if (await fileExists(path.join(cwd, "app"))) {
    pushUnique(routeHints, "app/");
  }

  if (await fileExists(path.join(cwd, "src", "app"))) {
    pushUnique(routeHints, "src/app/");
  }

  if (await fileExists(path.join(cwd, "pages"))) {
    pushUnique(routeHints, "pages/");
  }

  if (await fileExists(path.join(cwd, "src", "pages"))) {
    pushUnique(routeHints, "src/pages/");
  }

  if (await fileExists(path.join(cwd, "app", "api"))) {
    pushUnique(apiHints, "app/api/");
  }

  if (await fileExists(path.join(cwd, "pages", "api"))) {
    pushUnique(apiHints, "pages/api/");
  }

  if (await fileExists(path.join(cwd, "src", "routes"))) {
    pushUnique(apiHints, "src/routes/");
  }

  if (await fileExists(path.join(cwd, "src", "api"))) {
    pushUnique(apiHints, "src/api/");
  }

  if (await fileExists(path.join(cwd, "prisma", "schema.prisma"))) {
    pushUnique(dataHints, "Prisma schema");
    pushUnique(importantFiles, "prisma/schema.prisma");
  }

  if ("drizzle-orm" in dependencies) {
    pushUnique(dataHints, "Drizzle ORM");
    pushUnique(dataToolHints, "drizzle");
  }

  if (await fileExists(path.join(cwd, "drizzle.config.ts"))) {
    pushUnique(dataHints, "Drizzle config");
    pushUnique(importantFiles, "drizzle.config.ts");
  }

  if ("typeorm" in dependencies) {
    pushUnique(dataHints, "TypeORM");
    pushUnique(dataToolHints, "typeorm");
  }

  if ("@supabase/supabase-js" in dependencies || (await fileExists(path.join(cwd, "supabase", "config.toml")))) {
    pushUnique(dataHints, "Supabase");
    pushUnique(dataToolHints, "supabase");
    if (await fileExists(path.join(cwd, "supabase", "config.toml"))) {
      pushUnique(importantFiles, "supabase/config.toml");
    }
  }

  if ("prisma" in dependencies || (await fileExists(path.join(cwd, "prisma", "schema.prisma")))) {
    pushUnique(dataToolHints, "prisma");
  }

  if ("zod" in dependencies) {
    pushUnique(importantFiles, "zod");
  }

  if (await fileExists(path.join(cwd, "README.md"))) {
    pushUnique(importantFiles, "README.md");
  }

  if (await fileExists(path.join(cwd, "turbo.json"))) {
    pushUnique(importantFiles, "turbo.json");
  }

  if (await fileExists(path.join(cwd, "nx.json"))) {
    pushUnique(importantFiles, "nx.json");
  }

  if (await fileExists(path.join(cwd, "Dockerfile"))) {
    pushUnique(importantFiles, "Dockerfile");
  }

  if (await fileExists(path.join(cwd, "docker-compose.yml"))) {
    pushUnique(importantFiles, "docker-compose.yml");
  }

  if (await fileExists(path.join(cwd, "vercel.json"))) {
    pushUnique(importantFiles, "vercel.json");
  }

  if (await fileExists(path.join(cwd, "openapi.yaml"))) {
    pushUnique(apiHints, "openapi.yaml");
    pushUnique(importantFiles, "openapi.yaml");
    pushUnique(systemTypeHints, "api-platform");
  }

  if (await fileExists(path.join(cwd, "openapi.json"))) {
    pushUnique(apiHints, "openapi.json");
    pushUnique(importantFiles, "openapi.json");
    pushUnique(systemTypeHints, "api-platform");
  }

  if (
    "socket.io" in dependencies ||
    "socket.io-client" in dependencies
  ) {
    pushUnique(realtimeToolHints, "socket.io");
  }

  if ("ws" in dependencies) {
    pushUnique(realtimeToolHints, "ws");
  }

  if ("ably" in dependencies) {
    pushUnique(realtimeToolHints, "ably");
  }

  if ("pusher-js" in dependencies) {
    pushUnique(realtimeToolHints, "pusher");
  }

  if (realtimeToolHints.length > 0) {
    pushUnique(systemTypeHints, "realtime-app");
    pushUnique(architectureStyleHints, "event-driven");
  }

  if (
    "contentlayer" in dependencies ||
    "@contentlayer/core" in dependencies ||
    "@next/mdx" in dependencies ||
    "mdx-bundler" in dependencies ||
    "gray-matter" in dependencies
  ) {
    pushUnique(systemTypeHints, "content-site");
  }

  const scripts = Object.fromEntries(
    Object.entries(packageJson?.scripts ?? {}).filter(
      ([name, command]) => !isPlaceholderScript(name, command)
    )
  );

  if (scripts.test) {
    pushUnique(testHints, `test script: ${scripts.test}`);
  }
  if (scripts.lint) {
    pushUnique(testHints, `lint script: ${scripts.lint}`);
  }
  if (scripts.build) {
    pushUnique(testHints, `build script: ${scripts.build}`);
  }

  if ("vitest" in dependencies || (await fileExists(path.join(cwd, "vitest.config.ts")))) {
    pushUnique(testHints, "Vitest");
  }
  if ("jest" in dependencies || (await fileExists(path.join(cwd, "jest.config.js")))) {
    pushUnique(testHints, "Jest");
  }
  if ("playwright" in dependencies || "@playwright/test" in dependencies) {
    pushUnique(testHints, "Playwright");
  }
  if ("cypress" in dependencies || (await fileExists(path.join(cwd, "cypress.config.ts")))) {
    pushUnique(testHints, "Cypress");
    if (await fileExists(path.join(cwd, "cypress.config.ts"))) {
      pushUnique(importantFiles, "cypress.config.ts");
    }
  }
  if (await fileExists(path.join(cwd, "playwright.config.ts"))) {
    pushUnique(importantFiles, "playwright.config.ts");
  }
  if (await fileExists(path.join(cwd, "__tests__"))) {
    pushUnique(testHints, "__tests__/");
  }
  if (await fileExists(path.join(cwd, "tests"))) {
    pushUnique(testHints, "tests/");
  }

  for (const subtree of subtreePackages) {
    const subtreeDependencies = collectDependencyMap(subtree.packageJson);
    const subtreeScripts = Object.fromEntries(
      Object.entries(subtree.packageJson?.scripts ?? {}).filter(
        ([name, command]) => !isPlaceholderScript(name, command)
      )
    );
    const subtreeRouteHints: string[] = [];
    const subtreeApiHints: string[] = [];
    const subtreeTestHints: string[] = [];
    const subtreeRealtimeToolHints: string[] = [];
    const subtreeImportantFiles: string[] = [];

    pushUnique(importantFiles, path.posix.join(subtree.root, "package.json"));
    pushUnique(subtreeImportantFiles, path.posix.join(subtree.root, "package.json"));

    if (
      "next" in subtreeDependencies ||
      (await fileExists(path.join(cwd, subtree.root, "next.config.js"))) ||
      (await fileExists(path.join(cwd, subtree.root, "next.config.ts"))) ||
      (await fileExists(path.join(cwd, subtree.root, "next.config.mjs")))
    ) {
      pushUnique(frontendHints, "next");
      if (await fileExists(path.join(cwd, subtree.root, "next.config.js"))) {
        pushUnique(importantFiles, path.posix.join(subtree.root, "next.config.js"));
        pushUnique(subtreeImportantFiles, path.posix.join(subtree.root, "next.config.js"));
      }
      if (await fileExists(path.join(cwd, subtree.root, "next.config.ts"))) {
        pushUnique(importantFiles, path.posix.join(subtree.root, "next.config.ts"));
        pushUnique(subtreeImportantFiles, path.posix.join(subtree.root, "next.config.ts"));
      }
      if (await fileExists(path.join(cwd, subtree.root, "next.config.mjs"))) {
        pushUnique(importantFiles, path.posix.join(subtree.root, "next.config.mjs"));
        pushUnique(subtreeImportantFiles, path.posix.join(subtree.root, "next.config.mjs"));
      }
    }

    if (
      !frontendHints.includes("next") &&
      ("react" in subtreeDependencies || "react-dom" in subtreeDependencies)
    ) {
      pushUnique(frontendHints, "react-spa");
    }

    if ("@nestjs/core" in subtreeDependencies || "@nestjs/common" in subtreeDependencies) {
      pushUnique(backendHints, "nest");
    }

    if ("fastify" in subtreeDependencies || "@fastify/swagger" in subtreeDependencies) {
      pushUnique(backendHints, "fastify");
    }

    if (
      "serverless" in subtreeDependencies ||
      "@serverless/typescript" in subtreeDependencies ||
      (await fileExists(path.join(cwd, subtree.root, "serverless.yml"))) ||
      (await fileExists(path.join(cwd, subtree.root, "serverless.ts")))
    ) {
      pushUnique(backendHints, "serverless");
      pushUnique(architectureStyleHints, "event-driven");
      if (await fileExists(path.join(cwd, subtree.root, "serverless.yml"))) {
        pushUnique(importantFiles, path.posix.join(subtree.root, "serverless.yml"));
        pushUnique(subtreeImportantFiles, path.posix.join(subtree.root, "serverless.yml"));
      }
      if (await fileExists(path.join(cwd, subtree.root, "serverless.ts"))) {
        pushUnique(importantFiles, path.posix.join(subtree.root, "serverless.ts"));
        pushUnique(subtreeImportantFiles, path.posix.join(subtree.root, "serverless.ts"));
      }
    }

    if ("drizzle-orm" in subtreeDependencies) {
      pushUnique(dataHints, "Drizzle ORM");
      pushUnique(dataToolHints, "drizzle");
    }

    if ("typeorm" in subtreeDependencies) {
      pushUnique(dataHints, "TypeORM");
      pushUnique(dataToolHints, "typeorm");
    }

    if ("@supabase/supabase-js" in subtreeDependencies) {
      pushUnique(dataHints, "Supabase");
      pushUnique(dataToolHints, "supabase");
    }

    if ("prisma" in subtreeDependencies) {
      pushUnique(dataToolHints, "prisma");
    }

    if ("socket.io" in subtreeDependencies || "socket.io-client" in subtreeDependencies) {
      pushUnique(realtimeToolHints, "socket.io");
      pushUnique(subtreeRealtimeToolHints, "socket.io");
    }

    if ("ws" in subtreeDependencies) {
      pushUnique(realtimeToolHints, "ws");
      pushUnique(subtreeRealtimeToolHints, "ws");
    }

    if ("ably" in subtreeDependencies) {
      pushUnique(realtimeToolHints, "ably");
      pushUnique(subtreeRealtimeToolHints, "ably");
    }

    if ("pusher-js" in subtreeDependencies) {
      pushUnique(realtimeToolHints, "pusher");
      pushUnique(subtreeRealtimeToolHints, "pusher");
    }

    if (
      "contentlayer" in subtreeDependencies ||
      "@contentlayer/core" in subtreeDependencies ||
      "@next/mdx" in subtreeDependencies ||
      "mdx-bundler" in subtreeDependencies ||
      "gray-matter" in subtreeDependencies
    ) {
      pushUnique(systemTypeHints, "content-site");
    }

    if (subtreeScripts.test) {
      pushUnique(testHints, `${subtree.root} test script: ${subtreeScripts.test}`);
      pushUnique(subtreeTestHints, `test script: ${subtreeScripts.test}`);
    }
    if (subtreeScripts.lint) {
      pushUnique(testHints, `${subtree.root} lint script: ${subtreeScripts.lint}`);
      pushUnique(subtreeTestHints, `lint script: ${subtreeScripts.lint}`);
    }
    if (subtreeScripts.build) {
      pushUnique(testHints, `${subtree.root} build script: ${subtreeScripts.build}`);
      pushUnique(subtreeTestHints, `build script: ${subtreeScripts.build}`);
    }
    if (subtreeScripts.dev) {
      pushUnique(subtreeTestHints, `dev script: ${subtreeScripts.dev}`);
    }

    for (const [relativeDir, target] of [
      ["app", routeHints],
      ["src/app", routeHints],
      ["pages", routeHints],
      ["src/pages", routeHints],
      ["app/api", apiHints],
      ["pages/api", apiHints],
      ["src/routes", apiHints],
      ["src/api", apiHints],
      ["tests", testHints],
      ["__tests__", testHints]
    ] as const) {
      if (await fileExists(path.join(cwd, subtree.root, relativeDir))) {
        const hint = `${subtree.root}/${relativeDir}/`;
        pushUnique(target, hint);

        if (target === routeHints) {
          pushUnique(subtreeRouteHints, hint);
        }

        if (target === apiHints) {
          pushUnique(subtreeApiHints, hint);
        }

        if (target === testHints) {
          pushUnique(subtreeTestHints, `${relativeDir}/`);
        }
      }
    }

    if (await fileExists(path.join(cwd, subtree.root, "playwright.config.ts"))) {
      pushUnique(testHints, "Playwright");
      pushUnique(importantFiles, path.posix.join(subtree.root, "playwright.config.ts"));
      pushUnique(subtreeImportantFiles, path.posix.join(subtree.root, "playwright.config.ts"));
      pushUnique(subtreeTestHints, "Playwright");
    }

    if (await fileExists(path.join(cwd, subtree.root, "cypress.config.ts"))) {
      pushUnique(testHints, "Cypress");
      pushUnique(importantFiles, path.posix.join(subtree.root, "cypress.config.ts"));
      pushUnique(subtreeImportantFiles, path.posix.join(subtree.root, "cypress.config.ts"));
      pushUnique(subtreeTestHints, "Cypress");
    }

    subtrees.push({
      root: subtree.root,
      packageName: subtree.packageJson?.name ?? null,
      scripts: subtreeScripts,
      routeHints: subtreeRouteHints,
      apiHints: subtreeApiHints,
      testHints: subtreeTestHints,
      realtimeToolHints: subtreeRealtimeToolHints,
      importantFiles: subtreeImportantFiles
    });
  }

  const subtreeContentHints = await collectSubtreeContentHints(cwd, subtreeRoots);
  for (const value of subtreeContentHints.realtimeToolHints) {
    pushUnique(realtimeToolHints, value);
  }
  for (const value of subtreeContentHints.importantFiles) {
    pushUnique(importantFiles, value);
  }

  if (realtimeToolHints.length > 0) {
    pushUnique(systemTypeHints, "realtime-app");
    pushUnique(architectureStyleHints, "event-driven");
  }

  if (
    systemTypeHints.length === 0 &&
    dataHints.length >= 2 &&
    frontendHints.length === 0 &&
    backendHints.length === 0
  ) {
    pushUnique(systemTypeHints, "data-platform");
  }

  if (
    systemTypeHints.length === 0 &&
    apiHints.length > 0 &&
    frontendHints.length === 0
  ) {
    pushUnique(systemTypeHints, "api-platform");
  }

  if (
    architectureStyleHints.length === 0 &&
    workspaceLayout === "monorepo" &&
    (backendHints.length > 0 || apiHints.length > 0)
  ) {
    pushUnique(architectureStyleHints, "service-oriented");
  }

  const ciFiles = await collectUserOwnedCiFiles(cwd);
  const hasCi = ciFiles.length > 0;
  for (const ciFile of ciFiles) {
    pushUnique(importantFiles, ciFile);
  }
  const existingDocs = await collectExistingDocs(cwd);
  const phaseRecommendation = buildPhaseRecommendation({
    existingDocs,
    importantFiles,
    hasCi,
    scripts,
    workspaceLayout,
    subtreeRoots,
    frontendHints,
    backendHints,
    routeHints,
    apiHints,
    dataHints,
    realtimeToolHints,
    dataToolHints,
    testHints
  });

  return {
    root: cwd,
    packageManager,
    installCommand,
    workspaceLayout,
    packageName: packageJson?.name ?? null,
    scripts,
    existingDocs,
    hasCi,
    ciFiles,
    frontendHints,
    backendHints,
    routeHints,
    apiHints,
    dataHints,
    realtimeToolHints,
    dataToolHints,
    testHints,
    systemTypeHints,
    architectureStyleHints,
    phaseRecommendation: phaseRecommendation.recommendation,
    phaseRecommendationReasons: phaseRecommendation.reasons,
    importantFiles,
    subtreeRoots,
    subtrees,
    availableSkills,
    hasSkillInstaller: availableSkills.includes("skill-installer")
  };
}
