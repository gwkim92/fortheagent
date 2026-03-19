import { constants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";

async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function findExecutable(
  command: string,
  pathValue = process.env.PATH ?? ""
): Promise<string | null> {
  if (!command) {
    return null;
  }

  if (command.includes(path.sep)) {
    return (await isExecutable(command)) ? command : null;
  }

  for (const directory of pathValue.split(path.delimiter)) {
    if (!directory) {
      continue;
    }

    const candidate = path.join(directory, command);
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }

  return null;
}
