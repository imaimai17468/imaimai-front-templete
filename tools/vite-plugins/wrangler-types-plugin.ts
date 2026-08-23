import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import type { Plugin } from "vite";
import { attachWranglerTypes, type WranglerTypesIo } from "./wrangler-types";

const nodeIo: WranglerTypesIo = {
  runScript: async (script, cwd) =>
    new Promise<number>((resolve) => {
      const child = spawn("bun", ["run", script], { cwd, stdio: "inherit" });
      child.on("close", (code) => {
        resolve(code ?? 1);
      });
      child.on("error", () => {
        resolve(1);
      });
    }),
  readMtime: async (file) => {
    try {
      const stats = await stat(file);
      return stats.mtimeMs;
    } catch {
      return null;
    }
  },
};

export const wranglerTypes = (): Plugin => ({
  name: "wrangler-types",
  apply: "serve",
  configureServer(server) {
    void attachWranglerTypes(server, nodeIo);
  },
});
