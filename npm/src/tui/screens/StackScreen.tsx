import { useMemo, useState, type ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import type { PromptOptionSet, SingleChoiceLabel } from "../../lib/init-session.js";
import { formatOptionValue } from "../../lib/init-session.js";
import type { SelectionInput } from "../../lib/selection.js";
import { SectionTitle } from "../components/SectionTitle.js";
import { SingleSelectList } from "../components/SingleSelectList.js";
import { tuiTheme } from "../theme.js";

const labels: SingleChoiceLabel[] = [
  "frontend",
  "backend",
  "systemType",
  "architectureStyle"
];

export function StackScreen(props: {
  selection: SelectionInput;
  promptOptions: PromptOptionSet;
  isActive: boolean;
  onUpdate: (selection: Partial<SelectionInput>) => void;
  onNext: () => void;
  onBack: () => void;
}): ReactElement {
  const visibleLabels = useMemo(
    () => labels.filter((label) => props.promptOptions[label].length > 1),
    [props.promptOptions]
  );
  const [fieldIndex, setFieldIndex] = useState(0);
  const [choiceIndices, setChoiceIndices] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      labels.map((label) => [
        label,
        Math.max(
          0,
          props.promptOptions[label].indexOf((props.selection[label] ?? props.promptOptions[label][0]) as string)
        )
      ])
    )
  );

  const activeLabel = visibleLabels[fieldIndex] ?? visibleLabels[0] ?? "frontend";

  useInput(
    (input, key) => {
      if (!props.isActive) {
        return;
      }

      if (key.escape) {
        props.onBack();
        return;
      }

      if (key.rightArrow || input === "l" || key.tab) {
        setFieldIndex((current) => (visibleLabels.length === 0 ? current : (current + 1) % visibleLabels.length));
        return;
      }

      if (key.leftArrow || input === "h" || (key.shift && key.tab)) {
        setFieldIndex((current) =>
          visibleLabels.length === 0 ? current : (current - 1 + visibleLabels.length) % visibleLabels.length
        );
        return;
      }

      if (key.return) {
        props.onNext();
        return;
      }

      const options = props.promptOptions[activeLabel];
      const currentIndex = choiceIndices[activeLabel] ?? 0;

      if (key.downArrow || input === "j") {
        const nextIndex = Math.min(options.length - 1, currentIndex + 1);
        setChoiceIndices((current) => ({ ...current, [activeLabel]: nextIndex }));
        props.onUpdate({ [activeLabel]: options[nextIndex] } as Partial<SelectionInput>);
      }

      if (key.upArrow || input === "k") {
        const nextIndex = Math.max(0, currentIndex - 1);
        setChoiceIndices((current) => ({ ...current, [activeLabel]: nextIndex }));
        props.onUpdate({ [activeLabel]: options[nextIndex] } as Partial<SelectionInput>);
      }
    },
    { isActive: props.isActive }
  );

  return (
    <Box flexDirection="column">
      <SectionTitle>Stack and Shape</SectionTitle>
      {labels.map((label) => {
        const options = props.promptOptions[label];

        if (options.length === 1) {
          return (
            <Box key={label} marginBottom={1} flexDirection="column">
              <Text color={tuiTheme.warning}>{label}</Text>
              <Text>  auto-applied: {formatOptionValue(label, options[0])}</Text>
            </Box>
          );
        }

        const isFocused = activeLabel === label;
        return (
          <Box key={label} flexDirection="column" marginBottom={1}>
            <Text color={isFocused ? tuiTheme.accent : undefined} bold={isFocused}>
              {label}
            </Text>
            {isFocused ? (
              <SingleSelectList
                label={label}
                options={options}
                value={(props.selection[label] ?? options[0]) as string}
                activeIndex={choiceIndices[label] ?? 0}
                isActive={props.isActive}
              />
            ) : (
              <Text>
                {"  "}
                {formatOptionValue(label, (props.selection[label] ?? options[0]) as string)}
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
