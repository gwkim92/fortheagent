import {
  collectProjectionRefs,
  type ProviderProjectionManifest
} from "./provider-projections.js";

export function validateProjectionParity(
  contents: Map<string, string>,
  manifest: ProviderProjectionManifest
): string[] {
  const errors: string[] = [];

  for (const projection of manifest.projections) {
    const content = contents.get(projection.entryFile);

    if (!content) {
      errors.push(`Missing provider projection entry file: ${projection.entryFile}`);
      continue;
    }

    const refs = new Set(collectProjectionRefs(projection.entryFile, content));

    for (const requiredDoc of projection.requiredDocs) {
      if (!refs.has(requiredDoc)) {
        errors.push(
          `Projection parity mismatch: ${projection.entryFile} is missing required doc reference ${requiredDoc}`
        );
      }
    }
  }

  const projectionDocSets = manifest.projections.map((projection) =>
    [...projection.requiredDocs].sort().join("|")
  );

  if (new Set(projectionDocSets).size > 1) {
    errors.push("Projection parity mismatch: provider projections do not share the same canonical doc set");
  }

  return [...new Set(errors)].sort();
}
