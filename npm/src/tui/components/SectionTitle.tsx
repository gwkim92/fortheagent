import { Box, Text } from "ink";
import type { PropsWithChildren, ReactElement } from "react";
import { tuiTheme } from "../theme.js";

export function SectionTitle({
  children
}: PropsWithChildren): ReactElement {
  return (
    <Box marginBottom={1}>
      <Text color={tuiTheme.accent} bold>
        // {children}
      </Text>
    </Box>
  );
}
