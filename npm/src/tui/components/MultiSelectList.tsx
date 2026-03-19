import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { formatOptionValue, getOptionCopy, type MultiChoiceLabel } from "../../lib/init-session.js";
import { tuiTheme } from "../theme.js";

export function MultiSelectList(props: {
  label: MultiChoiceLabel;
  options: string[];
  values: string[];
  activeIndex: number;
  isActive: boolean;
}): ReactElement {
  return (
    <Box flexDirection="column">
      {props.options.map((option, index) => {
        const copy = getOptionCopy(props.label, option);
        const focused = props.isActive && props.activeIndex === index;
        const selected = props.values.includes(option);

        return (
          <Box key={option} flexDirection="column" marginBottom={1}>
            <Text
              color={focused ? tuiTheme.accent : selected ? tuiTheme.success : tuiTheme.body}
              bold={focused || selected}
            >
              {focused ? "›" : " "} [{selected ? "■" : " "}] {formatOptionValue(props.label, option)}
            </Text>
            {copy.description ? (
              <Text color={tuiTheme.dim}>    {copy.description}</Text>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}
