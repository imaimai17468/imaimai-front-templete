// @vitest-environment node

import { describe, expect, it } from "vite-plus/test";
import { selectShardFiles } from "./shard-plan";
import type { ShardCandidate } from "./shard-plan";

const file = (id: string, duration?: number): ShardCandidate => ({
  id,
  recorded: duration === undefined ? undefined : { duration },
});

const shardsOf = (candidates: readonly ShardCandidate[], count: number) =>
  Array.from({ length: count }, (_, position) =>
    selectShardFiles(candidates, { count, index: position + 1 }).map(
      ({ id }) => id
    )
  );

describe(selectShardFiles, () => {
  it("should return every file when no shard is given", () => {
    const candidates = [file("a", 1), file("b")];
    expect(selectShardFiles(candidates)).toStrictEqual(candidates);
  });

  it("should give the longest file a shard of its own when it outweighs the rest", () => {
    const candidates = [
      file("long", 90),
      file("a", 10),
      file("b", 10),
      file("c", 10),
    ];
    expect(shardsOf(candidates, 2)).toStrictEqual([["long"], ["a", "b", "c"]]);
  });

  it("should place every file in exactly one shard when the shards are combined", () => {
    const candidates = [
      file("a", 5),
      file("b", 3),
      file("c", 8),
      file("d", 1),
      file("e"),
    ];
    expect(shardsOf(candidates, 3).flat().toSorted()).toStrictEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  it("should weigh an unrecorded file as the mean of the recorded ones when some are recorded", () => {
    const candidates = [file("a", 10), file("b", 30), file("new")];
    expect(shardsOf(candidates, 2)).toStrictEqual([["b"], ["new", "a"]]);
  });

  it("should split by id when no file has a recorded duration", () => {
    const candidates = [file("d"), file("b"), file("a"), file("c")];
    expect(shardsOf(candidates, 2)).toStrictEqual([
      ["a", "c"],
      ["b", "d"],
    ]);
  });
});
