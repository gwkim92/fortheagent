import type { PromptDefaults, PromptOptionSet } from "../lib/init-session.js";
import type { RepositoryScan } from "../lib/repo-scan.js";
import type { SelectionInput } from "../lib/selection.js";

export type TuiScreen =
  | "scan"
  | "phase"
  | "stack"
  | "requirements"
  | "context"
  | "review"
  | "submit";

export type TuiDoctorResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  repairCommands: string[];
};

export type TuiSubmitState = {
  status: "idle" | "running" | "success" | "error";
  updatedCount: number;
  doctorResult: TuiDoctorResult | null;
  message: string | null;
  exitCode: number | null;
};

export type TuiState = {
  scan: RepositoryScan;
  defaults: PromptDefaults;
  promptOptions: PromptOptionSet;
  selection: SelectionInput;
  currentScreen: TuiScreen;
  previewFiles: string[];
  helpOpen: boolean;
  submit: TuiSubmitState;
};

export type TuiAction =
  | { type: "set-screen"; screen: TuiScreen }
  | { type: "merge-selection"; selection: Partial<SelectionInput> }
  | { type: "set-preview-files"; files: string[] }
  | { type: "toggle-help" }
  | { type: "set-help"; open: boolean }
  | { type: "set-submit-running" }
  | {
      type: "set-submit-result";
      status: "success" | "error";
      updatedCount: number;
      doctorResult: TuiDoctorResult | null;
      message: string | null;
      exitCode: number;
    };

export function createInitialTuiState(input: {
  scan: RepositoryScan;
  defaults: PromptDefaults;
  promptOptions: PromptOptionSet;
  selection: SelectionInput;
  currentScreen?: TuiScreen;
}): TuiState {
  return {
    scan: input.scan,
    defaults: input.defaults,
    promptOptions: input.promptOptions,
    selection: input.selection,
    currentScreen: input.currentScreen ?? "scan",
    previewFiles: [],
    helpOpen: false,
    submit: {
      status: "idle",
      updatedCount: 0,
      doctorResult: null,
      message: null,
      exitCode: null
    }
  };
}

export function tuiReducer(state: TuiState, action: TuiAction): TuiState {
  switch (action.type) {
    case "set-screen":
      return {
        ...state,
        currentScreen: action.screen
      };
    case "merge-selection":
      return {
        ...state,
        selection: {
          ...state.selection,
          ...action.selection
        }
      };
    case "set-preview-files":
      return {
        ...state,
        previewFiles: action.files
      };
    case "toggle-help":
      return {
        ...state,
        helpOpen: !state.helpOpen
      };
    case "set-help":
      return {
        ...state,
        helpOpen: action.open
      };
    case "set-submit-running":
      return {
        ...state,
        currentScreen: "submit",
        submit: {
          status: "running",
          updatedCount: 0,
          doctorResult: null,
          message: null,
          exitCode: null
        }
      };
    case "set-submit-result":
      return {
        ...state,
        currentScreen: "submit",
        submit: {
          status: action.status,
          updatedCount: action.updatedCount,
          doctorResult: action.doctorResult,
          message: action.message,
          exitCode: action.exitCode
        }
      };
    default:
      return state;
  }
}

