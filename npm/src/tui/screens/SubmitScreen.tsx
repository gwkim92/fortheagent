import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import type { TuiSubmitState } from "../state.js";
import { SectionTitle } from "../components/SectionTitle.js";
import { StatusMessage } from "../components/StatusMessage.js";

export function SubmitScreen(props: {
  submit: TuiSubmitState;
  isActive: boolean;
  onExit: () => void;
  onBack: () => void;
}): ReactElement {
  useInput(
    (_input, key) => {
      if (!props.isActive || props.submit.status === "running") {
        return;
      }

      if (key.escape && props.submit.status === "error") {
        props.onBack();
        return;
      }

      if (key.return) {
        props.onExit();
      }
    },
    { isActive: props.isActive }
  );

  const doctor = props.submit.doctorResult;

  return (
    <Box flexDirection="column">
      <SectionTitle>Submit</SectionTitle>
      {props.submit.status === "running" ? (
        <StatusMessage tone="info" text="Running init and validating the repository..." />
      ) : null}
      {props.submit.status === "success" ? (
        <>
          <StatusMessage tone="success" text="foundation repository is healthy" />
          <Text>initialized {props.submit.updatedCount} foundation files</Text>
          {doctor?.warnings.map((warning) => (
            <Text key={warning}>Warning: {warning}</Text>
          ))}
          <Box marginTop={1} flexDirection="column">
            <Text>next steps:</Text>
            <Text>  codex  - read AGENTS.md then .agent-foundation/handoff/design-ready.md</Text>
            <Text>  claude - read CLAUDE.md then .agent-foundation/handoff/design-ready.md</Text>
          </Box>
          <Text>Press enter to exit.</Text>
        </>
      ) : null}
      {props.submit.status === "error" ? (
        <>
          <StatusMessage
            tone="error"
            text={props.submit.message ?? "Init or doctor failed. Review the details below."}
          />
          {doctor?.warnings.map((warning) => (
            <Text key={warning}>Warning: {warning}</Text>
          ))}
          {doctor?.errors.map((error) => (
            <Text key={error}>Error: {error}</Text>
          ))}
          {doctor?.repairCommands.map((command) => (
            <Text key={command}>Repair: {command}</Text>
          ))}
          <Text>Press enter to exit or esc to go back.</Text>
        </>
      ) : null}
    </Box>
  );
}
