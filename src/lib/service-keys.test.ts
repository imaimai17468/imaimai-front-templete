import { Array, Context, pipe, Predicate, Record, String } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { name as packageName } from "../../package.json";

/**
 * Every `.ts` module under `src/`, loaded so their service classes can be
 * read. A component file exports its component alone, so it declares no
 * service, and loading one starts the dev tools its tree mounts. Test files,
 * generated files and the test setup declare none either.
 */
const MODULES = import.meta.glob<Record<string, unknown>>(
  [
    "/src/**/*.ts",
    "!/src/**/*.test.ts",
    "!/src/**/*.d.ts",
    "!/src/**/*.gen.ts",
    "!/src/**/*.entry.ts",
    "!/src/test/setup.ts",
  ],
  { eager: true }
);

interface DeclaredService {
  readonly className: string;
  readonly key: string;
  readonly module: string;
}

const declaredServices: readonly DeclaredService[] = pipe(
  Record.toEntries(MODULES),
  Array.flatMap(([module, exports]) =>
    pipe(
      Record.values(exports),
      Array.filter(Predicate.and(Predicate.isFunction, Context.isKey)),
      Array.map((service) => ({
        className: service.name,
        key: service.key,
        module,
      }))
    )
  )
);

/**
 * The key Effect's deterministicKeys rule expects of a service class: the
 * package name, the module's path under `src/`, and the class name where it
 * differs from the file's.
 */
const deterministicKey = ({ className, module }: DeclaredService): string => {
  const path = pipe(
    module,
    String.replace(/^\/src\//u, ""),
    String.replace(/\.ts$/u, "")
  );
  const fileName = Array.lastNonEmpty(String.split(path, "/"));
  const ownName = Array.filter(
    [className],
    (own) => String.toLowerCase(own) !== String.toLowerCase(fileName)
  );
  return Array.join([packageName, path, ...ownName], "/");
};

describe("service keys", () => {
  it("should read a gateway's services when the modules load", () => {
    expect(
      pipe(
        declaredServices,
        Array.map(({ className }) => className)
      )
    ).toContain("UserProfiles");
  });

  it("should key every service by the package name, its module path and its class when Effect looks the service up", () => {
    expect(
      pipe(
        declaredServices,
        Array.map((service) => ({
          key: service.key,
          module: service.module,
        }))
      )
    ).toStrictEqual(
      pipe(
        declaredServices,
        Array.map((service) => ({
          key: deterministicKey(service),
          module: service.module,
        }))
      )
    );
  });

  it("should give no two services the same key when the application provides them", () => {
    const keys = pipe(
      declaredServices,
      Array.map(({ key }) => key)
    );

    expect(Array.dedupe(keys)).toStrictEqual(keys);
  });
});
