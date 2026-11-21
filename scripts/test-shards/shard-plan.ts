/**
 * Splits test files across shards by how long each took on its last recorded
 * run, so every shard finishes near the same time. Each shard computes the
 * whole plan from the same recorded durations and keeps its own part, which
 * is why the order is fixed by duration and then by id.
 */

export interface ShardCandidate {
  readonly id: string;
  readonly recorded: { readonly duration: number } | undefined;
}

/** `index` counts from 1, as `--shard=<index>/<count>` does. */
export interface ShardSlot {
  readonly count: number;
  readonly index: number;
}

const UNRECORDED_WEIGHT = 1;

/**
 * A file with no recorded run weighs the mean of the recorded ones, which is
 * the guess that least distorts the plan the recorded files settle.
 */
const weighUnrecordedFile = (candidates: readonly ShardCandidate[]): number => {
  const recorded = candidates.flatMap((candidate) =>
    candidate.recorded === undefined ? [] : [candidate.recorded.duration]
  );
  return recorded.length === 0
    ? UNRECORDED_WEIGHT
    : recorded.reduce((sum, duration) => sum + duration, 0) / recorded.length;
};

/**
 * Hands each file, longest first, to the shard with the least work so far,
 * and returns the files the given slot received. Without a slot every file
 * runs in the one process.
 */
export const selectShardFiles = <T extends ShardCandidate>(
  candidates: readonly T[],
  slot?: ShardSlot
): T[] => {
  if (slot === undefined) {
    return [...candidates];
  }
  const fallback = weighUnrecordedFile(candidates);
  const weighted = candidates
    .map((candidate) => ({
      candidate,
      weight: candidate.recorded?.duration ?? fallback,
    }))
    .toSorted(
      (a, b) =>
        b.weight - a.weight || a.candidate.id.localeCompare(b.candidate.id)
    );
  const loads = Array.from({ length: slot.count }, () => 0);
  const shardIndexes = weighted.map(({ weight }) => {
    const least = Math.min(...loads);
    const lightest = loads.indexOf(least);
    loads[lightest] = least + weight;
    return lightest;
  });
  return weighted
    .filter((_, position) => shardIndexes[position] === slot.index - 1)
    .map(({ candidate }) => candidate);
};
