import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { tuiTheme } from "../theme.js";

function formatHintChip(hint: string): { key: string; description: string } {
  const [key, ...rest] = hint.split(" ");

  return {
    key,
    description: rest.join(" ")
  };
}

export function FooterHints(props: {
  hints: string[];
  status?: string;
}): ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={tuiTheme.muted}
      paddingX={1}
      paddingY={1}
    >
      <Box flexWrap="wrap">
        {props.hints.map((hint) => {
          const chip = formatHintChip(hint);

          return (
            <Box key={hint} marginRight={2}>
              <Text color={tuiTheme.accent} bold>
                [{chip.key}]
              </Text>
              <Text color={tuiTheme.muted}>{chip.description ? ` ${chip.description}` : ""}</Text>
            </Box>
          );
        })}
      </Box>
      {props.status ? (
        <Box marginTop={1}>
          <Text color={tuiTheme.dim}>status: </Text>
          <Text color={tuiTheme.body}>{props.status}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
