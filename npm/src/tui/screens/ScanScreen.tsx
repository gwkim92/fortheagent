import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import type { RepositoryScan } from "../../lib/repo-scan.js";
import { SectionTitle } from "../components/SectionTitle.js";
import { StatusMessage } from "../components/StatusMessage.js";

export function ScanScreen(props: {
  scan: RepositoryScan;
  isActive: boolean;
  onContinue: () => void;
}): ReactElement {
  useInput(
    (_input, key) => {
      if (!props.isActive) {
        return;
      }

      if (key.return) {
        props.onContinue();
      }
    },
    { isActive: props.isActive }
  );

  return (
    <Box flexDirection="column">
      <SectionTitle>Repository Scan</SectionTitle>
      <Text>We scanned the current repository before asking questions.</Text>
      <StatusMessage
        tone="info"
        text={`Recommended phase: ${props.scan.phaseRecommendation}`}
      />
      <Text>Package manager: {props.scan.packageManager}</Text>
      <Text>Workspace layout: {props.scan.workspaceLayout}</Text>
      {props.scan.packageName ? <Text>Package: {props.scan.packageName}</Text> : null}
      {props.scan.importantFiles.length === 0 ? (
        <Text>Current repo signals: no notable project files detected yet.</Text>
      ) : null}
      {props.scan.frontendHints.length > 0 ? (
        <Text>Frontend hints: {props.scan.frontendHints.join(", ")}</Text>
      ) : null}
      {props.scan.backendHints.length > 0 ? (
        <Text>Backend hints: {props.scan.backendHints.join(", ")}</Text>
      ) : null}
      {props.scan.systemTypeHints.length > 0 ? (
        <Text>System hints: {props.scan.systemTypeHints.join(", ")}</Text>
      ) : null}
      <Box marginTop={1} flexDirection="column">
        <Text bold>Recommendation reasons</Text>
        {props.scan.phaseRecommendationReasons.map((reason) => (
          <Text key={reason}>- {reason}</Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text>Press enter to continue.</Text>
      </Box>
    </Box>
  );
}
