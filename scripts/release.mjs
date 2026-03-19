import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const workspaces = [
  { dir: "npm", access: "public" },
  { dir: "cli", access: "public" }
];

function readPackageManifest(workspaceDir) {
  const manifestPath = path.join(repoRoot, workspaceDir, "package.json");
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

function isAlreadyPublished(name, version) {
  try {
    const output = execFileSync("npm", ["view", `${name}@${version}`, "version"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
    return output === version;
  } catch {
    return false;
  }
}

function publishWorkspace(workspaceDir, access) {
  const args = ["publish", "--workspace", `./${workspaceDir}`, "--access", access];
  if (process.env.GITHUB_ACTIONS === "true") {
    args.push("--provenance");
  }

  execFileSync("npm", args, {
    cwd: repoRoot,
    stdio: "inherit"
  });
}

for (const workspace of workspaces) {
  const manifest = readPackageManifest(workspace.dir);
  const { name, version } = manifest;

  if (isAlreadyPublished(name, version)) {
    console.log(`Skipping ${name}@${version}; already published on npm.`);
    continue;
  }

  console.log(`Publishing ${name}@${version} from ./${workspace.dir}`);
  publishWorkspace(workspace.dir, workspace.access);
}
