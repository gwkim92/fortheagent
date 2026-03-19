import { execFile } from "node:child_process";
import { promisify } from "node:util";

type CommandRunner = (file: string, args: string[]) => Promise<void>;

const execFileAsync = promisify(execFile);

let commandRunner: CommandRunner = async (file, args) => {
  await execFileAsync(file, args);
};

export function resolveOpenUrlCommand(
  url: string,
  platform = process.platform
): { file: string; args: string[] } {
  switch (platform) {
    case "darwin":
      return {
        file: "open",
        args: [url]
      };
    case "win32":
      return {
        file: "cmd.exe",
        args: ["/c", "start", "", url]
      };
    default:
      return {
        file: "xdg-open",
        args: [url]
      };
  }
}

export async function openUrl(url: string): Promise<void> {
  const command = resolveOpenUrlCommand(url);
  await commandRunner(command.file, command.args);
}

export function configureOpenUrlForTests(options: {
  commandRunner?: CommandRunner;
}): void {
  commandRunner = options.commandRunner ?? commandRunner;
}

export function resetOpenUrlForTests(): void {
  commandRunner = async (file, args) => {
    await execFileAsync(file, args);
  };
}
