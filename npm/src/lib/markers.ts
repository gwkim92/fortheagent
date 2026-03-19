const beginPattern = /<!-- agent-foundation:begin section="([^"]+)" -->/g;
const endPattern = /<!-- agent-foundation:end section="([^"]+)" -->/g;
const blockPattern =
  /<!-- agent-foundation:begin section="([^"]+)" -->[\s\S]*?<!-- agent-foundation:end section="\1" -->/g;

export type ManagedBlock = {
  section: string;
  block: string;
};

export function listManagedBlocks(content: string): ManagedBlock[] {
  const blocks = Array.from(content.matchAll(blockPattern));

  return blocks.map((match) => ({
    section: match[1],
    block: match[0]
  }));
}

export function hasValidManagedMarkers(content: string): boolean {
  const beginSections = Array.from(content.matchAll(beginPattern)).map((match) => match[1]);
  const endSections = Array.from(content.matchAll(endPattern)).map((match) => match[1]);
  const blocks = listManagedBlocks(content);

  if (beginSections.length === 0 || beginSections.length !== endSections.length) {
    return false;
  }

  if (blocks.length !== beginSections.length) {
    return false;
  }

  return beginSections.every((section, index) => section === endSections[index]);
}

export function mergeManagedContent(templateContent: string, existingContent: string): string | null {
  if (!hasValidManagedMarkers(templateContent) || !hasValidManagedMarkers(existingContent)) {
    return null;
  }

  const templateBlocks = listManagedBlocks(templateContent);
  const existingBlocks = listManagedBlocks(existingContent);

  if (
    templateBlocks.length !== existingBlocks.length ||
    templateBlocks.some((block, index) => block.section !== existingBlocks[index]?.section)
  ) {
    return null;
  }

  let merged = existingContent;

  for (const block of templateBlocks) {
    const existingBlock = existingBlocks.find((candidate) => candidate.section === block.section);

    if (!existingBlock) {
      return null;
    }

    merged = merged.replace(existingBlock.block, block.block);
  }

  return merged;
}
