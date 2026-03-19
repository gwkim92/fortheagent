import type { ProjectPhase } from "./profile-registry.js";

export type SelectionInput = {
  projectPhase: ProjectPhase;
  frontend: string | null;
  backend: string | null;
  systemType: string | null;
  architectureStyle: string | null;
  constraints: string[];
  qualityProfiles: string[];
  practiceProfiles: string[];
  primaryProduct: string;
  targetUsers: string[];
  coreEntities: string[];
  criticalRisks: string[];
  deliveryPriorities: string[];
  currentPainPoints: string[];
  stabilityConstraints: string[];
};

export function resolveTemplatePaths(selection?: SelectionInput): string[] {
  const files = ["templates/base/AGENTS.md", "templates/base/GEMINI.md"];

  if (!selection) {
    return files;
  }

  if (selection.projectPhase === "existing") {
    files.push("templates/phase/existing");
  }

  if (selection.frontend && selection.frontend !== "none") {
    files.push(`templates/frontend/${selection.frontend}/docs/architecture/frontend.md`);
  }

  if (selection.backend && selection.backend !== "none") {
    files.push(`templates/backend/${selection.backend}/docs/architecture/backend.md`);
  }

  if (selection.systemType) {
    files.push(`templates/system/${selection.systemType}/docs/system/overview.md`);
  }

  for (const constraint of selection.constraints) {
    files.push(`templates/constraints/${constraint}`);
  }

  for (const qualityProfile of selection.qualityProfiles) {
    files.push(`templates/quality/${qualityProfile}`);
  }

  for (const practiceProfile of selection.practiceProfiles) {
    files.push(`templates/practice/${practiceProfile}`);
  }

  return [...new Set(files)].sort();
}
