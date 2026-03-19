import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("package metadata", () => {
  it("exposes the fortheagent bin", async () => {
    const raw = await readFile(path.join(process.cwd(), "package.json"), "utf8");
    const pkg = JSON.parse(raw) as {
      name: string;
      private: boolean;
      bin: Record<string, string>;
      files: string[];
      dependencies?: Record<string, string>;
    };

    expect(pkg.name).toBe("fortheagent");
    expect(pkg.private).toBe(false);
    expect(pkg.bin).toMatchObject({
      fortheagent: "dist/cli.js"
    });
    expect(pkg.files).toContain("dist");
    expect(pkg.dependencies).toMatchObject({
      zod: "^4.1.5"
    });
  });
});
