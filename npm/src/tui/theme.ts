import { brandIdentity } from "../lib/brand.js";

export const tuiTheme = {
  accent: "#f4a261",
  border: "#f4a261",
  body: "#f3efe7",
  success: "#7bd389",
  warning: "#ffd166",
  danger: "#ef476f",
  muted: "#8f8a81",
  dim: "#a89f94",
  codex: "#9fd356",
  claude: "#f6bd60",
  gemini: "#7cc6fe"
} as const;

export const tuiBrand = brandIdentity;

export const wizardScreenOrder = [
  "scan",
  "phase",
  "stack",
  "requirements",
  "context",
  "review",
  "submit"
] as const;

export const wizardVisibleSteps = ["scan", "phase", "stack", "requirements", "context", "review"] as const;
