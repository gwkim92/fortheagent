import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { formatSelection } from "../../lib/init-session.js";
import type { RepositoryScan } from "../../lib/repo-scan.js";
import type { SelectionInput } from "../../lib/selection.js";
import { SectionTitle } from "./SectionTitle.js";
import { tuiTheme } from "../theme.js";

export function PreviewPane(props: {
  selection: SelectionInput;
  previewFiles: string[];
  scan: RepositoryScan;
}): ReactElement {
  const files = props.previewFiles.slice(0, 10);
  const selectionLines = formatSelection(props.selection);
  const coreLines = selectionLines.slice(0, 8);
  const confirmedContextLines = selectionLines
    .slice(8)
    .filter((line) => !line.endsWith(": unconfirmed") && !line.endsWith(": none"));
  const previewLines = [...coreLines, ...confirmedContextLines].slice(0, 11);

  return (
    <Box
      width="40%"
      minWidth={34}
      flexDirection="column"
      borderStyle="round"
      borderColor={tuiTheme.accent}
      paddingX={1}
      paddingY={0}
    >
      <SectionTitle>Preview</SectionTitle>
      <Box marginBottom={1}>
        <Text color={tuiTheme.dim}>planned output for the current setup choice</Text>
      </Box>
      {previewLines.map((line) => (
        <Text key={line} color={tuiTheme.body}>
          {line}
        </Text>
      ))}
      <Box marginTop={1} flexDirection="column">
        <Text color={tuiTheme.warning} bold>
          Scan
        </Text>
        <Text color={tuiTheme.body}>  phase: {props.scan.phaseRecommendation}</Text>
        <Text color={tuiTheme.dim}>
          {"  "}
          {props.scan.phaseRecommendationReasons.join("; ") || "no recommendation reasons"}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={tuiTheme.success} bold>
          Planned Files ({props.previewFiles.length})
        </Text>
        <Text color={tuiTheme.dim}>  foundation-managed files that will be created or updated</Text>
        {files.map((file) => (
          <Text key={file} color={tuiTheme.body}>
            {"  - "}
            {file}
          </Text>
        ))}
        {props.previewFiles.length > files.length ? (
          <Text color={tuiTheme.dim}>  ...and {props.previewFiles.length - files.length} more</Text>
        ) : null}
      </Box>
    </Box>
  );
}
