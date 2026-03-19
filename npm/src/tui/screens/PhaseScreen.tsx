import { useState, type ReactElement } from "react";
import { Text, useInput } from "ink";
import type { SelectionInput } from "../../lib/selection.js";
import { SingleSelectList } from "../components/SingleSelectList.js";
import { SectionTitle } from "../components/SectionTitle.js";

const phaseOptions = ["greenfield", "existing"] as const;

export function PhaseScreen(props: {
  selection: SelectionInput;
  isActive: boolean;
  onUpdate: (selection: Partial<SelectionInput>) => void;
  onNext: () => void;
  onBack: () => void;
}): ReactElement {
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, phaseOptions.indexOf(props.selection.projectPhase))
  );

  useInput(
    (input, key) => {
      if (!props.isActive) {
        return;
      }

      if (key.escape) {
        props.onBack();
        return;
      }

      if (key.downArrow || input === "j") {
        const nextIndex = Math.min(phaseOptions.length - 1, activeIndex + 1);
        setActiveIndex(nextIndex);
        props.onUpdate({ projectPhase: phaseOptions[nextIndex] });
        return;
      }

      if (key.upArrow || input === "k") {
        const nextIndex = Math.max(0, activeIndex - 1);
        setActiveIndex(nextIndex);
        props.onUpdate({ projectPhase: phaseOptions[nextIndex] });
        return;
      }

      if (key.return) {
        props.onUpdate({ projectPhase: phaseOptions[activeIndex] });
        props.onNext();
      }
    },
    { isActive: props.isActive }
  );

  return (
    <>
      <SectionTitle>Project Phase</SectionTitle>
      <Text>Pick whether this foundation is for a new project or an existing repository.</Text>
      <SingleSelectList
        label="projectPhase"
        options={[...phaseOptions]}
        value={props.selection.projectPhase}
        activeIndex={activeIndex}
        isActive={props.isActive}
      />
    </>
  );
}
