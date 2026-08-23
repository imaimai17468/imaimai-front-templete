import path from "node:path";

export type ScriptRunner = (script: string, cwd: string) => Promise<number>;
type MtimeReader = (file: string) => Promise<number | null>;

export type WranglerTypesIo = {
  runScript: ScriptRunner;
  readMtime: MtimeReader;
};

export type DevServerLike = {
  config: { root: string; logger: { error: (message: string) => void } };
  watcher: { on: (event: "change", listener: (file: string) => void) => void };
};

const CONFIG_FILE = "wrangler.toml";
const TYPES_FILE = "worker-configuration.d.ts";
const GENERATE_SCRIPT = "cf-typegen";

export const failureMessage = (code: number): string =>
  `\`bun run ${GENERATE_SCRIPT}\` exited with ${code}. ${TYPES_FILE} may be out of date.`;

export const isWranglerConfig = (root: string, file: string): boolean =>
  path.resolve(file) === path.resolve(root, CONFIG_FILE);

export const needsRegenerate = (
  configMtime: number | null,
  typesMtime: number | null
): boolean => {
  if (configMtime === null) return false;
  if (typesMtime === null) return true;
  return configMtime > typesMtime;
};

export const attachWranglerTypes = async (
  server: DevServerLike,
  io: WranglerTypesIo
): Promise<void> => {
  const root = server.config.root;
  let inFlight: Promise<void> | null = null;
  let queued = false;

  const runGenerate = async (): Promise<void> => {
    const code = await io.runScript(GENERATE_SCRIPT, root).catch(() => 1);
    if (code !== 0) server.config.logger.error(failureMessage(code));
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
    if (!isWranglerConfig(root, file)) return;
    void regenerate();
  });

  const [configMtime, typesMtime] = await Promise.all([
    io.readMtime(path.resolve(root, CONFIG_FILE)),
    io.readMtime(path.resolve(root, TYPES_FILE)),
  ]);
  if (!needsRegenerate(configMtime, typesMtime)) return;
  await regenerate();
};
