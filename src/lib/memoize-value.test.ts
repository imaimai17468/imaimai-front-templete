import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { DriverFailed } from "@/test/defect";
import { memoizeValue } from "./memoize-value";

describe(memoizeValue, () => {
  it("should return what build produced when the reader is called the first time", () => {
    const read = memoizeValue(() => ({ id: "fresh" }));

    const value = read();

    expect(value).toStrictEqual({ id: "fresh" });
  });

  it("should return the first value without building again when the reader is called twice", () => {
    const built: { serial: number }[] = [];
    const read = memoizeValue(() => {
      const value = { serial: built.length };
      built.push(value);
      return value;
    });

    const readings = [read(), read()];

    expect({
      buildCount: built.length,
      isSameReference: readings[0] === readings[1],
    }).toStrictEqual({ buildCount: 1, isSameReference: true });
  });

  it("should run build again when the earlier call's build threw", () => {
    const attempts: number[] = [];
    const read = memoizeValue(() => {
      attempts.push(attempts.length);
      return Option.getOrThrowWith(
        Option.none<{ id: string }>(),
        () => new DriverFailed({ message: "build failed" })
      );
    });
    const readOption = Option.liftThrowable(read);

    readOption();
    readOption();

    expect(attempts).toStrictEqual([0, 1]);
  });
});
