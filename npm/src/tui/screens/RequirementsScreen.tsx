import { useMemo, useState, type ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import type { MultiChoiceLabel, PromptOptionSet } from "../../lib/init-session.js";
import type { SelectionInput } from "../../lib/selection.js";
import { MultiSelectList } from "../components/MultiSelectList.js";
import { SectionTitle } from "../components/SectionTitle.js";
import { tuiTheme } from "../theme.js";

const labels: MultiChoiceLabel[] = ["constraints", "qualityProfiles", "practiceProfiles"];

export function RequirementsScreen(props: {
  selection: SelectionInput;
  promptOptions: PromptOptionSet;
  isActive: boolean;
  onUpdate: (selection: Partial<SelectionInput>) => void;
  onNext: () => void;
  onBack: () => void;
}): ReactElement {
  const visibleLabels = useMemo(
    () => labels.filter((label) => props.promptOptions[label].length > 0),
    [props.promptOptions]
  );
  const [fieldIndex, setFieldIndex] = useState(0);
  const [choiceIndices, setChoiceIndices] = useState<Record<string, number>>(() =>
    Object.fromEntries(labels.map((label) => [label, 0]))
  );

  const activeLabel = visibleLabels[fieldIndex] ?? visibleLabels[0] ?? "constraints";

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
        return;
      }

      if (key.upArrow || input === "k") {
        const nextIndex = Math.max(0, currentIndex - 1);
        setChoiceIndices((current) => ({ ...current, [activeLabel]: nextIndex }));
        return;
      }

      if (input === " ") {
        const option = options[currentIndex];
        const currentValues = props.selection[activeLabel];
        const nextValues = currentValues.includes(option)
          ? currentValues.filter((value) => value !== option)
          : [...currentValues, option].sort();
        props.onUpdate({ [activeLabel]: nextValues } as Partial<SelectionInput>);
      }
    },
    { isActive: props.isActive }
  );

  return (
    <Box flexDirection="column">
      <SectionTitle>Requirements</SectionTitle>
      {visibleLabels.map((label) => {
        const isFocused = activeLabel === label;
        return (
          <Box key={label} flexDirection="column" marginBottom={1}>
            <Text color={isFocused ? tuiTheme.accent : undefined} bold={isFocused}>
              {label}
            </Text>
            {isFocused ? (
              <MultiSelectList
                label={label}
                options={props.promptOptions[label]}
                values={props.selection[label]}
                activeIndex={choiceIndices[label] ?? 0}
                isActive={props.isActive}
              />
            ) : (
              <Text>
                {"  "}
                {props.selection[label].join(", ") || "none"}
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
