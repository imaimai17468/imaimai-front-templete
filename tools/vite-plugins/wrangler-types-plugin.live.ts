import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import type { Plugin } from "vite";
import { attachWranglerTypes } from "./wrangler-types";
import type { WranglerTypesIo } from "./wrangler-types";

const nodeIo: WranglerTypesIo = {
  readMtime: async (file) => {
    try {
      const stats = await stat(file);
      return stats.mtimeMs;
    } catch {
      return null;
    }
  },
  runScript: async (script, cwd) => {
    const { promise, resolve } = Promise.withResolvers<number>();
    const child = spawn("bun", ["run", script], { cwd, stdio: "inherit" });
    child.on("close", (code) => {
      resolve(code ?? 1);
    });
    child.on("error", () => {
      resolve(1);
    });
    return await promise;
  },
};

export const wranglerTypes = (): Plugin => ({
  apply: "serve",
  configureServer(server) {
    void attachWranglerTypes(server, nodeIo);
  },
  name: "wrangler-types",
});
