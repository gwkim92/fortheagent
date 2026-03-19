import { profileRegistry } from "./profile-registry.js";

export type Question = {
  name:
    | "projectPhase"
    | "frontend"
    | "backend"
    | "systemType"
    | "architectureStyle"
    | "constraints"
    | "qualityProfiles"
    | "practiceProfiles";
  kind: "single-select" | "multi-select";
  options: readonly string[];
};

export function buildQuestions(): Question[] {
  return [
    {
      name: "projectPhase",
      kind: "single-select",
      options: Object.keys(profileRegistry.axes.phase)
    },
    {
      name: "frontend",
      kind: "single-select",
      options: Object.keys(profileRegistry.axes.frontend)
    },
    {
      name: "backend",
      kind: "single-select",
      options: Object.keys(profileRegistry.axes.backend)
    },
    {
      name: "systemType",
      kind: "single-select",
      options: Object.keys(profileRegistry.axes.systemType)
    },
    {
      name: "architectureStyle",
      kind: "single-select",
      options: Object.keys(profileRegistry.axes.architectureStyle)
    },
    {
      name: "constraints",
      kind: "multi-select",
      options: Object.keys(profileRegistry.axes.constraints)
    },
    {
      name: "qualityProfiles",
      kind: "multi-select",
      options: Object.keys(profileRegistry.axes.quality)
    },
    {
      name: "practiceProfiles",
      kind: "multi-select",
      options: Object.keys(profileRegistry.axes.practice)
    }
  ];
}
