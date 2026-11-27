// @vitest-environment node

import { describe, expect, it } from "vite-plus/test";
import {
  chooseStopRequest,
  isNoSuchProcess,
  stopGroup,
  toProcessGroup,
} from "./process-group.ts";
import type { ProcessGroup, StopSignal } from "./process-group.ts";

/**
 * Stops a group whose processes all end `pollsToEnd` checks after it has
 * received `endsOn`, or never where `endsOn` is null, and records what the
 * stop sent and how often it paused.
 */
const stopFakeGroup = async (
  endsOn: StopSignal | null,
  pollsToEnd: number,
  polls: number
) => {
  const sent: StopSignal[] = [];
  const counts = { checksAfterEnd: 0, pauses: 0 };
  const group: ProcessGroup = {
    isAlive: () => {
      if (endsOn === null || !sent.includes(endsOn)) {
        return true;
      }
      counts.checksAfterEnd += 1;
      return counts.checksAfterEnd <= pollsToEnd;
    },
    send: (signal) => {
      sent.push(signal);
    },
  };
  const pause = async () => {
    counts.pauses += 1;
    await Promise.resolve();
  };
  const outcome = await stopGroup(group, pause, polls);
  return { outcome, pauses: counts.pauses, sent };
};

const errorWithCode = (code: string) =>
  Object.assign(new Error(`kill ${code}`), { code });

const killFailingWith = (code: string) => () => {
  throw errorWithCode(code);
};

describe(stopGroup, () => {
  it("should send SIGTERM alone without pausing when the group ends on it at once", async () => {
    await expect(stopFakeGroup("SIGTERM", 0, 3)).resolves.toStrictEqual({
      outcome: "terminated",
      pauses: 0,
      sent: ["SIGTERM"],
    });
  });

  it("should keep polling until the group ends when it ends on SIGTERM within the polls", async () => {
    await expect(stopFakeGroup("SIGTERM", 3, 3)).resolves.toStrictEqual({
      outcome: "terminated",
      pauses: 3,
      sent: ["SIGTERM"],
    });
  });

  it("should send SIGKILL after the polls when the group outlives SIGTERM", async () => {
    await expect(stopFakeGroup("SIGKILL", 0, 3)).resolves.toStrictEqual({
      outcome: "killed",
      pauses: 3,
      sent: ["SIGTERM", "SIGKILL"],
    });
  });

  it("should check the group again only after the pause has ended when the group is still alive", async () => {
    const events: string[] = [];
    const group: ProcessGroup = {
      isAlive: () => {
        events.push("check");
        return events.length < 3;
      },
      send: () => {
        events.push("signal");
      },
    };
    const pause = async () => {
      await Promise.resolve();
      events.push("paused");
    };

    await stopGroup(group, pause, 3);

    expect(events).toStrictEqual(["signal", "check", "paused", "check"]);
  });

  it("should stop polling when the polls run out between whole numbers", async () => {
    await expect(stopFakeGroup(null, 0, 1.5)).resolves.toStrictEqual({
      outcome: "survived",
      pauses: 4,
      sent: ["SIGTERM", "SIGKILL"],
    });
  });

  it("should report the group survived when it outlives SIGKILL too", async () => {
    await expect(stopFakeGroup(null, 0, 2)).resolves.toStrictEqual({
      outcome: "survived",
      pauses: 4,
      sent: ["SIGTERM", "SIGKILL"],
    });
  });
});

describe(toProcessGroup, () => {
  it("should signal every process in the group when it sends a signal", () => {
    const calls: [number, StopSignal | 0][] = [];
    const group = toProcessGroup(42, (pid, signal) => {
      calls.push([pid, signal]);
    });

    group.send("SIGTERM");
    const isAlive = group.isAlive();

    expect({ calls, isAlive }).toStrictEqual({
      calls: [
        [-42, "SIGTERM"],
        [-42, 0],
      ],
      isAlive: true,
    });
  });

  it("should read the group as ended when no process is left to signal", () => {
    const group = toProcessGroup(42, killFailingWith("ESRCH"));

    group.send("SIGKILL");

    expect(group.isAlive()).toBeFalsy();
  });

  it("should throw when the group may not be signalled", () => {
    const group = toProcessGroup(42, killFailingWith("EPERM"));

    expect(() => {
      group.send("SIGTERM");
    }).toThrow("kill EPERM");
  });
});

describe(chooseStopRequest, () => {
  it("should stop the group gracefully when no stop was asked for before", () => {
    expect(chooseStopRequest([])).toBe("graceful");
  });

  it("should kill the group at once when a stop was already asked for", () => {
    expect(chooseStopRequest([2])).toBe("forced");
  });
});

describe(isNoSuchProcess, () => {
  it("should read the group as ended when the signal failed with ESRCH", () => {
    expect(isNoSuchProcess(errorWithCode("ESRCH"))).toBeTruthy();
  });

  it("should not read the group as ended when the signal was refused", () => {
    expect(isNoSuchProcess(errorWithCode("EPERM"))).toBeFalsy();
  });

  it("should not read the group as ended when the error carries no code", () => {
    expect(isNoSuchProcess(new Error("kill"))).toBeFalsy();
  });
});
