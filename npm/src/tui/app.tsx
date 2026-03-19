import path from "node:path";
import React, { useEffect, useMemo, useReducer, type ReactElement } from "react";
import { Box, render, useInput } from "ink";
import { runDoctor } from "../commands/doctor.js";
import { runInit } from "../commands/init.js";
import {
  buildGeneratedFilePreview,
  formatOptionValue,
  inferDefaultsFromScan,
  normalizeAnswers,
  resolvePromptOptions,
  type PromptDefaults,
  type PromptOptionSet
} from "../lib/init-session.js";
import type { RepositoryScan } from "../lib/repo-scan.js";
import type { SelectionInput } from "../lib/selection.js";
import { FooterHints } from "./components/FooterHints.js";
import { PreviewPane } from "./components/PreviewPane.js";
import { ScreenFrame } from "./components/ScreenFrame.js";
import { ContextScreen } from "./screens/ContextScreen.js";
import { PhaseScreen } from "./screens/PhaseScreen.js";
import { RequirementsScreen } from "./screens/RequirementsScreen.js";
import { ReviewScreen } from "./screens/ReviewScreen.js";
import { ScanScreen } from "./screens/ScanScreen.js";
import { StackScreen } from "./screens/StackScreen.js";
import { SubmitScreen } from "./screens/SubmitScreen.js";
import {
  createInitialTuiState,
  tuiReducer,
  type TuiDoctorResult,
  type TuiScreen
} from "./state.js";
import { wizardVisibleSteps } from "./theme.js";

type InitAction = typeof runInit;
type DoctorAction = typeof runDoctor;

const screenTitles: Record<TuiScreen, string> = {
  scan: "Repository scan",
  phase: "Phase",
  stack: "Stack",
  requirements: "Requirements",
  context: "Context",
  review: "Review",
  submit: "Submit"
};

const footerHintsByScreen: Record<TuiScreen, string[]> = {
  scan: ["enter continue", "? help", "ctrl+c quit"],
  phase: ["j/k move", "enter continue", "esc back", "? help"],
  stack: ["j/k choose", "tab field", "enter continue", "esc back"],
  requirements: ["j/k move", "space toggle", "tab field", "enter continue"],
  context: ["type text", "tab next field", "enter commit", "esc back"],
  review: ["enter run init", "esc back", "? help"],
  submit: ["enter exit", "esc back on error", "? help"]
};

function selectionToProjectContext(selection: SelectionInput) {
  return {
    primaryProduct: selection.primaryProduct,
    targetUsers: selection.targetUsers,
    coreEntities: selection.coreEntities,
    criticalRisks: selection.criticalRisks,
    deliveryPriorities: selection.deliveryPriorities,
    currentPainPoints: selection.currentPainPoints,
    stabilityConstraints: selection.stabilityConstraints
  };
}

function getStepNumber(screen: TuiScreen): number {
  const index = wizardVisibleSteps.indexOf(screen as (typeof wizardVisibleSteps)[number]);
  return index >= 0 ? index + 1 : wizardVisibleSteps.length;
}

export function InitTuiApp(props: {
  cwd: string;
  scan: RepositoryScan;
  promptOptions: PromptOptionSet;
  defaults: PromptDefaults;
  runInitAction?: InitAction;
  runDoctorAction?: DoctorAction;
  onExit: (code: number) => void;
  initialScreen?: TuiScreen;
}): ReactElement {
  const initialSelection = useMemo(
    () => normalizeAnswers({}, props.promptOptions, props.defaults),
    [props.defaults, props.promptOptions]
  );
  const [state, dispatch] = useReducer(
    tuiReducer,
    createInitialTuiState({
      scan: props.scan,
      defaults: props.defaults,
      promptOptions: props.promptOptions,
      selection: initialSelection,
      currentScreen: props.initialScreen
    })
  );
  const runInitAction = props.runInitAction ?? runInit;
  const runDoctorAction = props.runDoctorAction ?? runDoctor;

  useInput((input) => {
    if (input === "?") {
      dispatch({ type: "toggle-help" });
    }
  });

  useEffect(() => {
    let disposed = false;

    void buildGeneratedFilePreview(state.selection).then((files) => {
      if (!disposed) {
        dispatch({ type: "set-preview-files", files });
      }
    });

    return () => {
      disposed = true;
    };
  }, [state.selection]);

  const preview = (
    <PreviewPane
      selection={state.selection}
      previewFiles={state.previewFiles}
      scan={state.scan}
    />
  );

  const navigate = (screen: TuiScreen): void => {
    dispatch({ type: "set-help", open: false });
    dispatch({ type: "set-screen", screen });
  };

  const submit = async (): Promise<void> => {
    dispatch({ type: "set-submit-running" });

    try {
      const initResult = await runInitAction({
        cwd: props.cwd,
        mode: "interactive",
        projectPhase: state.selection.projectPhase,
        frontend: state.selection.frontend ?? undefined,
        backend: state.selection.backend ?? undefined,
        systemType: state.selection.systemType ?? undefined,
        architectureStyle: state.selection.architectureStyle ?? undefined,
        constraints: state.selection.constraints,
        qualityProfiles: state.selection.qualityProfiles,
        practiceProfiles: state.selection.practiceProfiles,
        projectContext: selectionToProjectContext(state.selection)
      });
      const doctorResult = (await runDoctorAction({ cwd: props.cwd })) as TuiDoctorResult;

      dispatch({
        type: "set-submit-result",
        status: doctorResult.ok ? "success" : "error",
        updatedCount: initResult.updated.length,
        doctorResult,
        message: doctorResult.ok ? null : "Doctor reported issues after init.",
        exitCode: doctorResult.ok ? 0 : 1
      });
    } catch (error) {
      dispatch({
        type: "set-submit-result",
        status: "error",
        updatedCount: 0,
        doctorResult: null,
        message: error instanceof Error ? error.message : String(error),
        exitCode: 1
      });
    }
  };

  const body = (() => {
    switch (state.currentScreen) {
      case "scan":
        return <ScanScreen scan={state.scan} isActive={!state.helpOpen} onContinue={() => navigate("phase")} />;
      case "phase":
        return (
          <PhaseScreen
            selection={state.selection}
            isActive={!state.helpOpen}
            onUpdate={(selection) => dispatch({ type: "merge-selection", selection })}
            onNext={() => navigate("stack")}
            onBack={() => navigate("scan")}
          />
        );
      case "stack":
        return (
          <StackScreen
            selection={state.selection}
            promptOptions={state.promptOptions}
            isActive={!state.helpOpen}
            onUpdate={(selection) => dispatch({ type: "merge-selection", selection })}
            onNext={() => navigate("requirements")}
            onBack={() => navigate("phase")}
          />
        );
      case "requirements":
        return (
          <RequirementsScreen
            selection={state.selection}
            promptOptions={state.promptOptions}
            isActive={!state.helpOpen}
            onUpdate={(selection) => dispatch({ type: "merge-selection", selection })}
            onNext={() => navigate("context")}
            onBack={() => navigate("stack")}
          />
        );
      case "context":
        return (
          <ContextScreen
            selection={state.selection}
            isActive={!state.helpOpen}
            onUpdate={(selection) => dispatch({ type: "merge-selection", selection })}
            onNext={() => navigate("review")}
            onBack={() => navigate("requirements")}
          />
        );
      case "review":
        return (
          <ReviewScreen
            selection={state.selection}
            previewFiles={state.previewFiles}
            isActive={!state.helpOpen}
            onConfirm={() => {
              void submit();
            }}
            onBack={() => navigate("context")}
          />
        );
      case "submit":
        return (
          <SubmitScreen
            submit={state.submit}
            isActive={!state.helpOpen}
            onExit={() => props.onExit(state.submit.exitCode ?? 1)}
            onBack={() => navigate("review")}
          />
        );
      default:
        return <Box />;
    }
  })();

  return (
    <ScreenFrame
      repoName={path.basename(props.cwd)}
      packageManager={props.scan.packageManager}
      workspaceLayout={props.scan.workspaceLayout}
      phase={formatOptionValue("projectPhase", state.selection.projectPhase)}
      step={getStepNumber(state.currentScreen)}
      totalSteps={wizardVisibleSteps.length}
      title={screenTitles[state.currentScreen]}
      preview={preview}
      footer={
        <FooterHints
          hints={footerHintsByScreen[state.currentScreen]}
          status={state.submit.status === "running" ? "Running init and doctor..." : undefined}
        />
      }
      helpOpen={state.helpOpen}
    >
      {body}
    </ScreenFrame>
  );
}

export async function runInitTui(input: {
  cwd: string;
  scan: RepositoryScan;
  defaults?: PromptDefaults;
}): Promise<number> {
  const promptOptions = await resolvePromptOptions();
  const defaults = {
    ...inferDefaultsFromScan(input.scan, promptOptions),
    ...(input.defaults ?? {})
  };

  return await new Promise<number>((resolve) => {
    let exitCode = 1;
    const app = render(
      <InitTuiApp
        cwd={input.cwd}
        scan={input.scan}
        promptOptions={promptOptions}
        defaults={defaults}
        onExit={(code) => {
          exitCode = code;
          app.unmount();
        }}
      />
    );

    void app.waitUntilExit().then(() => {
      resolve(exitCode);
    });
  });
}
