import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { tuiTheme } from "../theme.js";

export function StatusMessage(props: {
  tone: "info" | "warning" | "error" | "success";
  text: string;
}): ReactElement {
  const color =
    props.tone === "success"
      ? tuiTheme.success
      : props.tone === "warning"
        ? tuiTheme.warning
        : props.tone === "error"
          ? tuiTheme.danger
          : tuiTheme.accent;

  return (
    <Box
      marginBottom={1}
      borderStyle="round"
      borderColor={color}
      paddingX={1}
      paddingY={0}
    >
      <Text color={color} bold>
        {props.tone === "success"
          ? "OK"
          : props.tone === "warning"
            ? "WARN"
            : props.tone === "error"
              ? "ERROR"
              : "INFO"}
      </Text>
      <Text color={tuiTheme.body}> {props.text}</Text>
    </Box>
  );
}
