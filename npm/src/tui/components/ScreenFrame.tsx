import { Box, Text } from "ink";
import type { PropsWithChildren, ReactElement, ReactNode } from "react";
import { tuiBrand, tuiTheme } from "../theme.js";

function renderStepDots(step: number, totalSteps: number): string {
  return Array.from({ length: totalSteps }, (_, index) => (index + 1 <= step ? "●" : "○")).join(
    " "
  );
}

export function ScreenFrame(
  props: PropsWithChildren<{
    repoName: string;
    packageManager: string;
    workspaceLayout: string;
    phase: string;
    step: number;
    totalSteps: number;
    title: string;
    preview: ReactNode;
    footer: ReactNode;
    helpOpen: boolean;
  }>
): ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <Box
        borderStyle="round"
        borderColor={tuiTheme.border}
        paddingX={1}
        paddingY={0}
        marginBottom={1}
        flexDirection="column"
      >
        <Box flexDirection="column">
          <Text color={tuiTheme.accent} bold>
            {tuiBrand.glyph} {tuiBrand.name}
            <Text color={tuiTheme.dim}> // {tuiBrand.tagline}</Text>
          </Text>
          <Box>
            <Text color={tuiTheme.dim}>targets </Text>
            <Text color={tuiTheme.codex} bold>
              Codex
            </Text>
            <Text color={tuiTheme.dim}> · </Text>
            <Text color={tuiTheme.claude} bold>
              Claude Code
            </Text>
            <Text color={tuiTheme.dim}> · </Text>
            <Text color={tuiTheme.gemini} bold>
              Gemini CLI
            </Text>
          </Box>
        </Box>
        <Box>
          <Box flexGrow={1} flexDirection="column">
            <Text color={tuiTheme.body}>
              workspace: <Text bold>{props.repoName}</Text>
            </Text>
            <Text color={tuiTheme.dim}>
              pm: {props.packageManager}   layout: {props.workspaceLayout}
            </Text>
          </Box>
          <Box flexDirection="column" alignItems="flex-end">
            <Text color={tuiTheme.warning} bold>
              {props.phase}
            </Text>
            <Text color={tuiTheme.dim}>
              {props.title} · step {props.step}/{props.totalSteps}
            </Text>
          </Box>
        </Box>
        <Box>
          <Text color={tuiTheme.accent}>{renderStepDots(props.step, props.totalSteps)}</Text>
        </Box>
      </Box>

      <Box flexDirection="row" alignItems="flex-start">
        <Box flexGrow={1} flexDirection="column">
          <Box
            width="58%"
            minWidth={40}
            marginRight={1}
            borderStyle="round"
            borderColor={tuiTheme.muted}
            paddingX={1}
            paddingY={1}
            flexDirection="column"
          >
            {props.children}
          </Box>
        </Box>
        {props.preview}
      </Box>
      {props.helpOpen ? (
        <Box
          marginTop={1}
          borderStyle="round"
          borderColor={tuiTheme.warning}
          paddingX={1}
          paddingY={1}
        >
          <Text color={tuiTheme.warning} bold>
            Help
          </Text>
          <Text color={tuiTheme.body}>
            {" "}
            ↑↓ or j/k move, ←→ or h/l switch field, space toggles, enter confirms, tab
            cycles, esc goes back, ? toggles help.
          </Text>
        </Box>
      ) : null}
      <Box marginTop={1}>{props.footer}</Box>
    </Box>
  );
}
