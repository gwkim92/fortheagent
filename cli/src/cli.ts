#!/usr/bin/env node

import { runCli } from "./run-cli.js";

void main().catch((error) => {
  setImmediate(() => {
    throw error;
  });
});

async function main(): Promise<void> {
  process.exitCode = await runCli({
    argv: process.argv.slice(2),
    streams: {
      input: process.stdin,
      output: process.stdout
    }
  });
}
