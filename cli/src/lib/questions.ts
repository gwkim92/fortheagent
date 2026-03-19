import { profileRegistry } from "./profile-registry.js";

export type Question =
  | {
      name:
        | "projectPhase"
        | "frontend"
        | "backend"
        | "systemType"
        | "architectureStyle";
      kind: "single-select";
      options: readonly string[];
    }
  | {
      name: "constraints" | "qualityProfiles" | "practiceProfiles";
      kind: "multi-select";
      options: readonly string[];
    }
  | {
      name:
        | "primaryProduct"
        | "targetUsers"
        | "coreEntities"
        | "criticalRisks"
        | "deliveryPriorities"
        | "currentPainPoints"
        | "stabilityConstraints";
      kind: "text";
      options: [];
    };

export function buildQuestions(): Question[] {
  return [
    {
      name: "projectPhase",
      kind: "single-select",
      options: profileRegistry.projectPhase
    },
    {
      name: "frontend",
      kind: "single-select",
      options: profileRegistry.frontend
    },
    {
      name: "backend",
      kind: "single-select",
      options: profileRegistry.backend
    },
    {
      name: "systemType",
      kind: "single-select",
      options: profileRegistry.systemType
    },
    {
      name: "architectureStyle",
      kind: "single-select",
      options: profileRegistry.architectureStyle
    },
    {
      name: "constraints",
      kind: "multi-select",
      options: profileRegistry.constraints
    },
    {
      name: "qualityProfiles",
      kind: "multi-select",
      options: profileRegistry.qualityProfiles
    },
    {
      name: "practiceProfiles",
      kind: "multi-select",
      options: profileRegistry.practiceProfiles
    },
    {
      name: "primaryProduct",
      kind: "text",
      options: []
    },
    {
      name: "targetUsers",
      kind: "text",
      options: []
    },
    {
      name: "coreEntities",
      kind: "text",
      options: []
    },
    {
      name: "criticalRisks",
      kind: "text",
      options: []
    },
    {
      name: "deliveryPriorities",
      kind: "text",
      options: []
    },
    {
      name: "currentPainPoints",
      kind: "text",
      options: []
    },
    {
      name: "stabilityConstraints",
      kind: "text",
      options: []
    }
  ];
}
