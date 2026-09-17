import path from "node:path";

export type ScriptRunner = (
  script: string,
  cwd: string
) => Promise<number | null>;
/** Rejects when the mtime cannot be read, as `stat` does for an absent file. */
type MtimeReader = (file: string) => Promise<number>;

export interface WranglerTypesIo {
  runScript: ScriptRunner;
  readMtime: MtimeReader;
}

export interface DevServerLike {
  config: { root: string; logger: { error: (message: string) => void } };
  watcher: { on: (event: "change", listener: (file: string) => void) => void };
}

const CONFIG_FILE = "wrangler.toml";
const TYPES_FILE = "worker-configuration.d.ts";
const GENERATE_SCRIPT = "cf-typegen";

export const failureMessage = (code: number | null): string =>
  code === null
    ? `\`bun run ${GENERATE_SCRIPT}\` reported no exit code. ${TYPES_FILE} may be out of date.`
    : `\`bun run ${GENERATE_SCRIPT}\` exited with ${code}. ${TYPES_FILE} may be out of date.`;

export const isWranglerConfig = (root: string, file: string): boolean =>
  path.resolve(file) === path.resolve(root, CONFIG_FILE);

export const needsRegenerate = (
  configMtime: number | null,
  typesMtime: number | null
): boolean => {
  if (configMtime === null) {
    return false;
  }
  if (typesMtime === null) {
    return true;
  }
  return configMtime > typesMtime;
};

/** `null` where the mtime could not be read, which is how an absent file arrives. */
const mtimeOrNull = async (
  readMtime: MtimeReader,
  file: string
): Promise<number | null> => {
  try {
    return await readMtime(file);
  } catch {
    return null;
  }
};

export const attachWranglerTypes = async (
  server: DevServerLike,
  io: WranglerTypesIo
): Promise<void> => {
  const { root } = server.config;
  let inFlight: Promise<void> | null = null;
  let queued = false;

  const runGenerate = async (): Promise<void> => {
    const code = await io.runScript(GENERATE_SCRIPT, root).catch(() => null);
    if (code !== 0) {
      server.config.logger.error(failureMessage(code));
    }
    if (queued) {
      queued = false;
      await runGenerate();
      return;
    }
    inFlight = null;
  };

  const regenerate = async (): Promise<void> => {
    if (inFlight !== null) {
      queued = true;
      await inFlight;
      return;
    }
    inFlight = runGenerate();
    await inFlight;
  };

  server.watcher.on("change", (file) => {
    if (!isWranglerConfig(root, file)) {
      return;
    }
    void regenerate();
  });

  const [configMtime, typesMtime] = await Promise.all([
    mtimeOrNull(io.readMtime, path.resolve(root, CONFIG_FILE)),
    mtimeOrNull(io.readMtime, path.resolve(root, TYPES_FILE)),
  ]);
  if (!needsRegenerate(configMtime, typesMtime)) {
    return;
  }
  await regenerate();
};
