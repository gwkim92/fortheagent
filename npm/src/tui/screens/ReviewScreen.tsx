import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { formatSelection } from "../../lib/init-session.js";
import type { SelectionInput } from "../../lib/selection.js";
import { SectionTitle } from "../components/SectionTitle.js";
import { StatusMessage } from "../components/StatusMessage.js";

export function ReviewScreen(props: {
  selection: SelectionInput;
  previewFiles: string[];
  isActive: boolean;
  onConfirm: () => void;
  onBack: () => void;
}): ReactElement {
  useInput(
    (_input, key) => {
      if (!props.isActive) {
        return;
      }

      if (key.escape) {
        props.onBack();
        return;
      }

      if (key.return) {
        props.onConfirm();
      }
    },
    { isActive: props.isActive }
  );

  return (
    <Box flexDirection="column">
      <SectionTitle>Review</SectionTitle>
      <StatusMessage
        tone="info"
        text={
          props.selection.projectPhase === "existing"
            ? "This run will create current-state and migration docs without touching README or unrelated docs."
            : "This run will create a design-ready kickoff pack for a new project."
        }
      />
      {formatSelection(props.selection).map((line) => (
        <Text key={line}>{line}</Text>
      ))}
      <Box marginTop={1} flexDirection="column">
        <Text bold>Files to create or update</Text>
        {props.previewFiles.slice(0, 20).map((file) => (
          <Text key={file}>- {file}</Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text>Press enter to run init and doctor.</Text>
      </Box>
    </Box>
  );
}
