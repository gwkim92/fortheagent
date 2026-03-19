import type { Writable } from "node:stream";
import { brandIdentity } from "./brand.js";

const ansi = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  accent: "\u001b[38;5;215m",
  muted: "\u001b[38;5;245m",
  codex: "\u001b[38;5;149m",
  claude: "\u001b[38;5;216m",
  gemini: "\u001b[38;5;117m",
  success: "\u001b[38;5;114m",
  warning: "\u001b[38;5;221m",
  error: "\u001b[38;5;203m"
} as const;

function supportsColor(output: Pick<Writable, "write"> & { isTTY?: boolean }): boolean {
  return Boolean(output.isTTY);
}

function style(
  output: Pick<Writable, "write"> & { isTTY?: boolean },
  text: string,
  ...codes: string[]
): string {
  if (!supportsColor(output) || codes.length === 0) {
    return text;
  }

  return `${codes.join("")}${text}${ansi.reset}`;
}

function writeLine(output: Pick<Writable, "write">, line = ""): void {
  output.write(`${line}\n`);
}

function brandTargetsLine(output: Pick<Writable, "write"> & { isTTY?: boolean }): string {
  return [
    style(output, "targets ", ansi.muted),
    style(output, brandIdentity.targets[0], ansi.codex, ansi.bold),
    style(output, " · ", ansi.muted),
    style(output, brandIdentity.targets[1], ansi.claude, ansi.bold),
    style(output, " · ", ansi.muted),
    style(output, brandIdentity.targets[2], ansi.gemini, ansi.bold)
  ].join("");
}

export function writeBrandLead(
  output: Pick<Writable, "write"> & { isTTY?: boolean },
  suffix?: string,
  subtitle?: string
): void {
  writeLine(
    output,
    [
      style(output, `${brandIdentity.glyph} ${brandIdentity.name}`, ansi.accent, ansi.bold),
      style(output, ` // ${suffix ?? brandIdentity.tagline}`, ansi.muted)
    ].join("")
  );
  writeLine(output, brandTargetsLine(output));
  if (subtitle) {
    writeLine(output, style(output, subtitle, ansi.dim));
  }
}

export function writeBrandBanner(
  output: Pick<Writable, "write"> & { isTTY?: boolean },
  title: string,
  details: string[] = []
): void {
  const line = "═".repeat(72);
  writeLine(output);
  writeLine(output, style(output, line, ansi.accent));
  writeBrandLead(output, title);
  for (const detail of details) {
    writeLine(output, style(output, detail, ansi.dim));
  }
  writeLine(output, style(output, line, ansi.accent));
}

export function writeStatusBlock(
  output: Pick<Writable, "write"> & { isTTY?: boolean },
  tone: "success" | "warning" | "error" | "info",
  text: string
): void {
  const color =
    tone === "success"
      ? ansi.success
      : tone === "warning"
        ? ansi.warning
        : tone === "error"
          ? ansi.error
          : ansi.accent;
  const badge =
    tone === "success"
      ? "OK"
      : tone === "warning"
        ? "WARN"
        : tone === "error"
          ? "ERROR"
          : "INFO";
  writeLine(output, `${style(output, badge, color, ansi.bold)} ${text}`);
}
