import { spawn } from "node:child_process";
import { once } from "node:events";
import { text } from "node:stream/consumers";
import { z } from "zod";

/** node emits `close` with the exit code and the signal that ended the child. */
const CloseArgs = z.tuple([z.number().nullable(), z.string().nullable()]);

/** Where one bash run happens, what it inherits, and what it reads on stdin. */
export interface BashRunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input: string;
}

/** What one bash run produced. */
export interface BashRun {
  status: number | null;
  stderr: string;
  stdout: string;
}

/**
 * One run of a bash script, awaited rather than blocking the thread, so a file
 * whose cases each fork a hook runs those forks at once instead of one at a
 * time.
 *
 * Both pipes get a reader before the exit is awaited, because `close` fires
 * only once they drain: a script writing more than a pipe buffer would block
 * on a reader that arrives after the await that never returns. Neither pipe
 * has a size cap, which `spawnSync`'s `maxBuffer` would have imposed.
 */
export const runBash = async (
  script: string,
  options: BashRunOptions
): Promise<BashRun> => {
  const child = spawn("bash", [script], {
    cwd: options.cwd,
    env: options.env,
  });
  const stdout = text(child.stdout);
  const stderr = text(child.stderr);
  child.stdin.end(options.input);
  const closed: unknown = await once(child, "close");
  const [status] = CloseArgs.parse(closed);
  return { status, stderr: await stderr, stdout: await stdout };
};
