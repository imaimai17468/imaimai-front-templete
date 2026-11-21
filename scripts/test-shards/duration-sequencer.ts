import { BaseSequencer } from "vite-plus/test/node";
import type {
  TestSequencer,
  TestSpecification,
  Vitest,
} from "vite-plus/test/node";
import { selectShardFiles } from "./shard-plan";

/**
 * Replaces Vitest's split, which gives each shard the same number of files,
 * with one that balances the durations Vitest recorded for each file. The
 * order within a shard stays Vitest's own.
 */
export class DurationSequencer implements TestSequencer {
  readonly #ctx: Vitest;
  readonly #sortLikeVitest: BaseSequencer["sort"];

  constructor(ctx: Vitest) {
    this.#ctx = ctx;
    this.#sortLikeVitest = BaseSequencer.prototype.sort.bind(
      new BaseSequencer(ctx)
    );
  }

  shard(files: TestSpecification[]): TestSpecification[] {
    const candidates = files.map((spec) => ({
      id: spec.moduleId,
      recorded: this.#ctx.cache.getTestSpecificationResult(spec),
      spec,
    }));
    return selectShardFiles(candidates, this.#ctx.config.shard).map(
      ({ spec }) => spec
    );
  }

  async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const sorted = await this.#sortLikeVitest(files);
    return sorted;
  }
}
