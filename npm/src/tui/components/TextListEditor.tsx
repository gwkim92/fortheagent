import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { tuiTheme } from "../theme.js";

export function TextListEditor(props: {
  label: string;
  helper: string;
  example?: string;
  draft: string;
  isActive: boolean;
  isFilled: boolean;
}): ReactElement {
  const valuePreview = props.draft.trim() || "Not set yet";

  if (!props.isActive) {
    return (
      <Box marginBottom={1}>
        <Box width={24} marginRight={1}>
          <Text color={tuiTheme.dim}>{props.label}</Text>
        </Box>
        <Text color={props.isFilled ? tuiTheme.body : tuiTheme.dim}>{valuePreview}</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      borderStyle="round"
      borderColor={tuiTheme.accent}
      paddingX={1}
      paddingY={0}
    >
      <Text color={tuiTheme.accent} bold>
        › {props.label}
      </Text>
      <Text color={tuiTheme.dim}>{props.helper}</Text>
      {props.example ? (
        <Text color={tuiTheme.dim}>Try: {props.example}</Text>
      ) : null}
      <Text color={props.draft ? tuiTheme.success : tuiTheme.dim}>
        {props.draft || "Type here"}▌
      </Text>
    </Box>
  );
}
