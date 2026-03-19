import type { SessionContext } from "../lib/repository-context.js";
import { describeRepository } from "../lib/repository-summary.js";
import { runGenerateDocs } from "../commands/generate-docs.js";
import {
  describeCodeGenerationScopeGuard,
  describeArchitectureStarter,
  describeNextSteps,
  reviewCurrentRepository
} from "../lib/workflow-responses.js";
import type { BuiltInWorkflowIntent } from "./workflow-router.js";

export type BuiltInWorkflowResult = {
  handled: boolean;
  responseText: string;
  reloadContext: boolean;
};

export async function runBuiltInWorkflow(options: {
  cwd: string;
  sessionContext: SessionContext;
  workflow: BuiltInWorkflowIntent;
  userMessage: string;
}): Promise<BuiltInWorkflowResult> {
  if (options.workflow.kind === "generate-docs") {
    const result = await runGenerateDocs({
      cwd: options.cwd
    });

    return {
      handled: true,
      responseText: result.responseText,
      reloadContext: true
    };
  }

  if (options.workflow.kind === "architecture-brief") {
    return {
      handled: true,
      responseText: await describeArchitectureStarter(options.sessionContext),
      reloadContext: false
    };
  }

  if (options.workflow.kind === "next-steps") {
    return {
      handled: true,
      responseText: await describeNextSteps(options.sessionContext),
      reloadContext: false
    };
  }

  if (options.workflow.kind === "review-repository") {
    return {
      handled: true,
      responseText: await reviewCurrentRepository(options.sessionContext, options.userMessage),
      reloadContext: false
    };
  }

  if (options.workflow.kind === "scope-guard") {
    return {
      handled: true,
      responseText: await describeCodeGenerationScopeGuard(options.sessionContext, options.userMessage),
      reloadContext: false
    };
  }

  return {
    handled: true,
    responseText: await describeRepository(options.sessionContext),
    reloadContext: false
  };
}
