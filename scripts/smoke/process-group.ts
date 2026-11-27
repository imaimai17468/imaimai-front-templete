/**
 * Stopping a process group: SIGTERM to every process in it, SIGKILL to what
 * outlives that, and SIGKILL at once where the stop is asked for again.
 */

import { Schema } from "effect";

export type StopSignal = "SIGKILL" | "SIGTERM";

/** A process group, seen through what stopping it needs. */
export interface ProcessGroup {
  /** Whether any process is left in the group. */
  readonly isAlive: () => boolean;
  readonly send: (signal: StopSignal) => void;
}

/** `process.kill`, the call a `ProcessGroup` signals its processes through. */
export type Kill = (pid: number, signal: StopSignal | 0) => void;

/**
 * How the group ended: on SIGTERM, on the SIGKILL that followed it, or not
 * within the polls either was given.
 */
export type GroupStop = "killed" | "survived" | "terminated";

/**
 * How to answer a request to stop: the first one stops the group and waits
 * for it, and one that repeats it kills the group without waiting.
 */
export type StopRequest = "graceful" | "forced";

/**
 * Whether the error `process.kill` threw says no process is left to signal,
 * rather than that the group may not be signalled.
 */
export const isNoSuchProcess: (error: unknown) => boolean = Schema.is(
  Schema.Struct({ code: Schema.Literal("ESRCH") })
);

/**
 * The process group `leader` heads, signalled as a whole through `kill`. A
 * signal to a group with no process left reads as the group having ended,
 * and any other failure is thrown.
 */
export const toProcessGroup = (leader: number, kill: Kill): ProcessGroup => {
  const signal = (signalName: StopSignal | 0): boolean => {
    try {
      kill(-leader, signalName);
      return true;
    } catch (error) {
      if (isNoSuchProcess(error)) {
        return false;
      }
      throw error;
    }
  };
  return {
    isAlive: () => signal(0),
    send: (signalName) => {
      signal(signalName);
    },
  };
};

/** The answer to a request to stop that arrives after `earlierRequests`. */
export const chooseStopRequest = (
  earlierRequests: readonly number[]
): StopRequest => {
  const [first] = earlierRequests;
  return first === undefined ? "graceful" : "forced";
};

/**
 * Whether the group has no process left within `polls` more checks, each
 * `pause` apart.
 */
const waitForGroupEnd = async (
  group: ProcessGroup,
  pause: () => Promise<void>,
  polls: number
): Promise<boolean> => {
  if (!group.isAlive()) {
    return true;
  }
  if (polls <= 0) {
    return false;
  }
  await pause();
  return await waitForGroupEnd(group, pause, polls - 1);
};

/**
 * Sends the whole group SIGTERM, and SIGKILL where a process is still left
 * after `polls` checks `pause` apart. Signalling the group rather than its
 * leader also reaches the processes the leader started, which can outlive it.
 */
export const stopGroup = async (
  group: ProcessGroup,
  pause: () => Promise<void>,
  polls: number
): Promise<GroupStop> => {
  group.send("SIGTERM");
  if (await waitForGroupEnd(group, pause, polls)) {
    return "terminated";
  }
  group.send("SIGKILL");
  return (await waitForGroupEnd(group, pause, polls)) ? "killed" : "survived";
};
