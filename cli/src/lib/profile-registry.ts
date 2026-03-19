export const profileRegistry = {
  projectPhase: ["greenfield", "existing"],
  frontend: ["next", "react-spa", "none"],
  backend: ["nest", "fastify", "serverless", "none"],
  systemType: [
    "internal-tool",
    "b2b-saas",
    "content-site",
    "api-platform",
    "realtime-app",
    "data-platform"
  ],
  architectureStyle: [
    "monolith",
    "modular-monolith",
    "service-oriented",
    "event-driven"
  ],
  constraints: [
    "seo",
    "auth",
    "payments",
    "multi-tenant",
    "pii",
    "offline",
    "realtime"
  ],
  qualityProfiles: ["ci-basic"],
  practiceProfiles: ["ddd-core", "tdd-first", "strict-verification"]
} as const;

export type ProjectPhase = (typeof profileRegistry.projectPhase)[number];
export type ProfileRegistry = typeof profileRegistry;
