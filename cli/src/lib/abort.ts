export class TerminalAbortError extends Error {
  constructor() {
    super("Input aborted by user");
    this.name = "TerminalAbortError";
  }
}

export class TerminalClosedError extends Error {
  constructor() {
    super("Input stream was closed");
    this.name = "TerminalClosedError";
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "ABORT_ERR"
  );
}

export function isReadlineClosedError(error: unknown): boolean {
  return error instanceof Error && error.message === "readline was closed";
}

export function rethrowAsTerminalAbort(error: unknown): never {
  if (isAbortError(error)) {
    throw new TerminalAbortError();
  }

  if (isReadlineClosedError(error)) {
    throw new TerminalClosedError();
  }

  throw error;
}
