export type SelectionInput = {
  projectPhase: "greenfield" | "existing";
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
