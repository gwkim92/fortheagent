import { useMemo, useState, type ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import type { SelectionInput } from "../../lib/selection.js";
import { SectionTitle } from "../components/SectionTitle.js";
import { TextListEditor } from "../components/TextListEditor.js";
import { tuiTheme } from "../theme.js";

type ContextField =
  | "primaryProduct"
  | "targetUsers"
  | "coreEntities"
  | "criticalRisks"
  | "deliveryPriorities"
  | "currentPainPoints"
  | "stabilityConstraints";

const fieldCopy: Record<
  ContextField,
  {
    label: string;
    helper: string;
    example?: string;
  }
> = {
  primaryProduct: {
    label: "What are you building?",
    helper: "What is this project trying to build or support?",
    example: "Finance ops dashboard"
  },
  targetUsers: {
    label: "Who is this for?",
    helper: "Who uses this system day to day? Separate multiple groups with commas.",
    example: "Ops team, admins"
  },
  coreEntities: {
    label: "What are the core entities?",
    helper: "Name the important domain nouns, resources, or records.",
    example: "User, order, payment"
  },
  criticalRisks: {
    label: "What could go wrong?",
    helper: "What could go wrong technically or operationally?",
    example: "Permission leaks, duplicate charges"
  },
  deliveryPriorities: {
    label: "What matters first?",
    helper: "What should shape the first design pass?",
    example: "Fast setup, safe rollout"
  },
  currentPainPoints: {
    label: "What hurts today?",
    helper: "Which parts of the current repository are slow, brittle, or painful?",
    example: "Coupled modules, flaky tests"
  },
  stabilityConstraints: {
    label: "What must not break?",
    helper: "What cannot break during refactoring or adoption?",
    example: "Public API, billing flow"
  }
};

function toDraftValue(field: ContextField, selection: SelectionInput): string {
  const value = selection[field];
  return Array.isArray(value) ? value.join(", ") : value;
}

function toSelectionPatch(field: ContextField, value: string): Partial<SelectionInput> {
  if (field === "primaryProduct") {
    return { primaryProduct: value.trim() };
  }

  return {
    [field]: [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))].sort()
  } as Partial<SelectionInput>;
}

export function ContextScreen(props: {
  selection: SelectionInput;
  isActive: boolean;
  onUpdate: (selection: Partial<SelectionInput>) => void;
  onNext: () => void;
  onBack: () => void;
}): ReactElement {
  const fields = useMemo<ContextField[]>(
    () => [
      "primaryProduct",
      "targetUsers",
      "coreEntities",
      "criticalRisks",
      "deliveryPriorities",
      ...(props.selection.projectPhase === "existing"
        ? (["currentPainPoints", "stabilityConstraints"] as const)
        : [])
    ],
    [props.selection.projectPhase]
  );
  const [fieldIndex, setFieldIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field, toDraftValue(field, props.selection)]))
  );
  const activeField = fields[fieldIndex];
  const savedFields = fields.filter(
    (field) => field !== activeField && Boolean((drafts[field] ?? "").trim())
  );

  const commitField = (field: ContextField): void => {
    props.onUpdate(toSelectionPatch(field, drafts[field] ?? ""));
  };

  useInput(
    (input, key) => {
      if (!props.isActive) {
        return;
      }

      const field = fields[fieldIndex];
      if (!field) {
        return;
      }

      if (key.escape) {
        commitField(field);
        props.onBack();
        return;
      }

      if (key.tab || key.rightArrow || input === "l" || key.downArrow || input === "j") {
        commitField(field);
        if (fieldIndex === fields.length - 1) {
          props.onNext();
        } else {
          setFieldIndex(fieldIndex + 1);
        }
        return;
      }

      if ((key.shift && key.tab) || key.leftArrow || input === "h" || key.upArrow || input === "k") {
        commitField(field);
        setFieldIndex(Math.max(0, fieldIndex - 1));
        return;
      }

      if (key.return) {
        commitField(field);
        if (fieldIndex === fields.length - 1) {
          props.onNext();
        } else {
          setFieldIndex(fieldIndex + 1);
        }
        return;
      }

      if (key.backspace || key.delete) {
        setDrafts((current) => ({
          ...current,
          [field]: (current[field] ?? "").slice(0, -1)
        }));
        return;
      }

      if (!key.ctrl && !key.meta && input) {
        setDrafts((current) => ({
          ...current,
          [field]: `${current[field] ?? ""}${input}`
        }));
      }
    },
    { isActive: props.isActive }
  );

  return (
    <Box flexDirection="column">
      <SectionTitle>Project Brief</SectionTitle>
      <Box marginBottom={1} flexDirection="column">
        <Text color={tuiTheme.warning} bold>
          Question {fieldIndex + 1} of {fields.length}
        </Text>
        <Text color={tuiTheme.dim}>
          Give the agent enough context to start design work. Short phrases are fine.
        </Text>
        <Text color={tuiTheme.dim}>
          Use commas for multi-value answers. Press enter to save a field and move on.
        </Text>
      </Box>
      {activeField ? (
        <TextListEditor
          label={fieldCopy[activeField].label}
          helper={fieldCopy[activeField].helper}
          example={fieldCopy[activeField].example}
          draft={drafts[activeField] ?? ""}
          isActive
          isFilled={Boolean((drafts[activeField] ?? "").trim())}
        />
      ) : null}
      <Box marginTop={1} flexDirection="column">
        <Text color={tuiTheme.accent} bold>
          Saved so far
        </Text>
        {savedFields.length > 0 ? (
          savedFields.map((field) => (
            <TextListEditor
              key={field}
              label={fieldCopy[field].label}
              helper={fieldCopy[field].helper}
              example={fieldCopy[field].example}
              draft={drafts[field] ?? ""}
              isActive={false}
              isFilled={Boolean((drafts[field] ?? "").trim())}
            />
          ))
        ) : (
          <Text color={tuiTheme.dim}>Nothing saved yet.</Text>
        )}
      </Box>
    </Box>
  );
}
