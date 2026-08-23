import { describe, expect, it, vi } from "vitest";
import {
  attachWranglerTypes,
  type DevServerLike,
  failureMessage,
  isWranglerConfig,
  needsRegenerate,
  type ScriptRunner,
  type WranglerTypesIo,
} from "./wrangler-types";

const ROOT = "/repo";
const CONFIG_PATH = "/repo/wrangler.toml";
const TYPES_PATH = "/repo/worker-configuration.d.ts";
const GENERATE_CALL = ["cf-typegen", ROOT];

const createServer = () => {
  let changeListener: ((file: string) => void) | null = null;
  const logError = vi.fn<(message: string) => void>();
  const server: DevServerLike = {
    config: { root: ROOT, logger: { error: logError } },
    watcher: {
      on: (_event, listener) => {
        changeListener = listener;
      },
    },
  };
  return {
    server,
    logError,
    emitChange: (file: string) => {
      changeListener?.(file);
    },
  };
};

const createIo = (
  mtimes: Record<string, number | null>,
  runScript = vi.fn<ScriptRunner>(async () => Promise.resolve(0))
) => {
  const io: WranglerTypesIo = {
    runScript,
    readMtime: async (file) => Promise.resolve(mtimes[file] ?? null),
  };
  return { io, runScript };
};

const createPendingRunner = () => {
  const resolvers: Array<(code: number) => void> = [];
  const runScript = vi.fn<ScriptRunner>(
    async () =>
      new Promise<number>((resolve) => {
        resolvers.push(resolve);
      })
  );
  return {
    runScript,
    finishRun: () => {
      resolvers.shift()?.(0);
    },
  };
};

const flush = async (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

describe("isWranglerConfig", () => {
  it("should be true when the changed file is the wrangler config in the root", () => {
    const result = isWranglerConfig(ROOT, CONFIG_PATH);

    expect(result).toBe(true);
  });

  it("should be false when the changed file is another file in the root", () => {
    const result = isWranglerConfig(ROOT, "/repo/src/router.tsx");

    expect(result).toBe(false);
  });
});

describe("needsRegenerate", () => {
  it("should be false when the config file is absent", () => {
    const result = needsRegenerate(null, 1);

    expect(result).toBe(false);
  });

  it("should be true when the types file is absent", () => {
    const result = needsRegenerate(1, null);

    expect(result).toBe(true);
  });

  it("should be true when the config is newer than the types file", () => {
    const result = needsRegenerate(2, 1);

    expect(result).toBe(true);
  });

  it("should be false when the types file is newer than the config", () => {
    const result = needsRegenerate(1, 2);

    expect(result).toBe(false);
  });
});

describe("failureMessage", () => {
  it("should name the script and the exit code when a run fails", () => {
    const result = failureMessage(3);

    expect(result).toBe(
      "`bun run cf-typegen` exited with 3. worker-configuration.d.ts may be out of date."
    );
  });
});

describe("attachWranglerTypes", () => {
  it("should generate the types on start when the types file is absent", async () => {
    const { server } = createServer();
    const { io, runScript } = createIo({ [CONFIG_PATH]: 1 });

    await attachWranglerTypes(server, io);

    expect(runScript.mock.calls).toEqual([GENERATE_CALL]);
  });

  it("should generate the types on start when the config is newer than the types file", async () => {
    const { server } = createServer();
    const { io, runScript } = createIo({ [CONFIG_PATH]: 2, [TYPES_PATH]: 1 });

    await attachWranglerTypes(server, io);

    expect(runScript.mock.calls).toEqual([GENERATE_CALL]);
  });

  it("should leave the types alone on start when they are newer than the config", async () => {
    const { server } = createServer();
    const { io, runScript } = createIo({ [CONFIG_PATH]: 1, [TYPES_PATH]: 2 });

    await attachWranglerTypes(server, io);

    expect(runScript.mock.calls).toEqual([]);
  });

  it("should generate the types when the wrangler config changes", async () => {
    const { server, emitChange } = createServer();
    const { io, runScript } = createIo({ [CONFIG_PATH]: 1, [TYPES_PATH]: 2 });
    await attachWranglerTypes(server, io);

    emitChange(CONFIG_PATH);

    expect(runScript.mock.calls).toEqual([GENERATE_CALL]);
  });

  it("should leave the types alone when a file other than the wrangler config changes", async () => {
    const { server, emitChange } = createServer();
    const { io, runScript } = createIo({ [CONFIG_PATH]: 1, [TYPES_PATH]: 2 });
    await attachWranglerTypes(server, io);

    emitChange("/repo/src/router.tsx");

    expect(runScript.mock.calls).toEqual([]);
  });

  it("should generate again when the config changes after the previous run finished", async () => {
    const { server, emitChange } = createServer();
    const { io, runScript } = createIo({ [CONFIG_PATH]: 1, [TYPES_PATH]: 2 });
    await attachWranglerTypes(server, io);
    emitChange(CONFIG_PATH);
    await flush();

    emitChange(CONFIG_PATH);

    expect(runScript.mock.calls).toEqual([GENERATE_CALL, GENERATE_CALL]);
  });

  it("should hold a run back when the previous one is still running", async () => {
    const { server, emitChange } = createServer();
    const { runScript } = createPendingRunner();
    const { io } = createIo({ [CONFIG_PATH]: 1, [TYPES_PATH]: 2 }, runScript);
    await attachWranglerTypes(server, io);
    emitChange(CONFIG_PATH);

    emitChange(CONFIG_PATH);
    await flush();

    expect(runScript.mock.calls).toEqual([GENERATE_CALL]);
  });

  it("should generate once more when changes arrive twice while a run is in flight", async () => {
    const { server, emitChange } = createServer();
    const { runScript, finishRun } = createPendingRunner();
    const { io } = createIo({ [CONFIG_PATH]: 1, [TYPES_PATH]: 2 }, runScript);
    await attachWranglerTypes(server, io);
    emitChange(CONFIG_PATH);
    emitChange(CONFIG_PATH);
    emitChange(CONFIG_PATH);

    finishRun();
    await flush();

    expect(runScript.mock.calls).toEqual([GENERATE_CALL, GENERATE_CALL]);
  });

  it("should report the exit code when the generate script fails", async () => {
    const { server, logError } = createServer();
    const failing = vi.fn<ScriptRunner>(async () => Promise.resolve(2));
    const { io } = createIo({ [CONFIG_PATH]: 1 }, failing);

    await attachWranglerTypes(server, io);

    expect(logError.mock.calls).toEqual([[failureMessage(2)]]);
  });

  it("should report a failure when the generate script rejects", async () => {
    const { server, logError } = createServer();
    const rejecting = vi.fn<ScriptRunner>(async () =>
      Promise.reject(new Error("bun not found"))
    );
    const { io } = createIo({ [CONFIG_PATH]: 1 }, rejecting);

    await attachWranglerTypes(server, io);

    expect(logError.mock.calls).toEqual([[failureMessage(1)]]);
  });
});
