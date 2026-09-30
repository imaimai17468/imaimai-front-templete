import { DrizzleQueryError } from "drizzle-orm/errors";
import { DateTime, Effect, Layer, Option } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { CurrentSession } from "@/lib/auth/session";
import { avatarUrlForKey } from "@/lib/avatar-url";
import { ABSENT_FIELD } from "@/test/absent-field";
import { UserPersistenceError } from ".";
import { makeRunHandler } from "../runtime";
import { CurrentUserReader, readCurrentUser, UserProfiles } from "./read";
import type { ProfileRow } from "./read";

const AVATAR_KEY = "user-1/avatar.jpg";
const PROVIDER_IMAGE = "https://images.example.com/from-google.png";
const PROFILE_QUERY =
  'select "id", "name" from "users" where "users"."id" = ? limit ?';

// このファイルがテストする CurrentUserReader の Layer を、依存の CurrentSession と
// UserProfiles を差し替えて組む。共通化すると、ここが差し替えていない依存が変わった
// ときにもこのテストを書き換えることになる。
const makeFakes = (read: CurrentSession["Service"]["read"]) => {
  const findProfile = vi.fn<UserProfiles["Service"]["findProfile"]>();
  const layer = CurrentUserReader.layerNoDeps.pipe(
    Layer.provide(
      Layer.merge(
        Layer.succeed(CurrentSession, CurrentSession.of({ read })),
        Layer.succeed(UserProfiles, UserProfiles.of({ findProfile }))
      )
    )
  );

  return {
    answer: () => makeRunHandler(layer)(readCurrentUser),
    findProfile,
    readCurrentUser: () =>
      Effect.runPromise(readCurrentUser.pipe(Effect.provide(layer))),
  };
};

const authenticatedCaller = Option.some({
  email: "user-1@example.com",
  id: "user-1",
});

// A read whose Drizzle error carries a parameter only this fixture holds, so
// a record or an answer that still quotes it fails the assertion.
const failingProfileRead = () => {
  const fakes = makeFakes(Effect.succeed(authenticatedCaller));
  fakes.findProfile.mockReturnValue(
    Effect.fail(
      new UserPersistenceError({
        cause: new DrizzleQueryError(PROFILE_QUERY, ["user-1-marker"]),
      })
    )
  );
  return fakes;
};

const profileRow = (overrides: Partial<ProfileRow> = {}): ProfileRow => ({
  avatarKey: Option.none(),
  createdAt: DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"),
  id: "user-1",
  image: Option.none(),
  name: Option.some("Name"),
  updatedAt: DateTime.makeUnsafe("2026-01-02T00:00:00.000Z"),
  ...overrides,
});

const encodedRow = {
  avatarUrl: ABSENT_FIELD,
  createdAt: "2026-01-01T00:00:00.000Z",
  email: "user-1@example.com",
  id: "user-1",
  name: "Name",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("CurrentUserReader.read", () => {
  it("should return None without reading the profile when the request is anonymous", () => {
    const { findProfile, readCurrentUser: read } = makeFakes(
      Effect.succeed(Option.none())
    );

    return read().then((result) => {
      expect({ findCalls: findProfile.mock.calls, result }).toStrictEqual({
        findCalls: [],
        result: Option.none(),
      });
    });
  });

  it("should look the row up by the server-derived identity when the request is authenticated", () => {
    const { findProfile, readCurrentUser: read } = makeFakes(
      Effect.succeed(authenticatedCaller)
    );
    findProfile.mockReturnValue(Effect.succeed(Option.some(profileRow())));

    return read().then(() => {
      expect(findProfile.mock.calls).toStrictEqual([["user-1"]]);
    });
  });

  it("should return None when the caller has no profile row", () => {
    const { findProfile, readCurrentUser: read } = makeFakes(
      Effect.succeed(authenticatedCaller)
    );
    findProfile.mockReturnValue(Effect.succeed(Option.none()));

    return read().then((result) => {
      expect(result).toStrictEqual(Option.none());
    });
  });

  it("should encode the row with the session's email when a profile row exists", () => {
    const { findProfile, readCurrentUser: read } = makeFakes(
      Effect.succeed(authenticatedCaller)
    );
    findProfile.mockReturnValue(Effect.succeed(Option.some(profileRow())));

    return read().then((result) => {
      expect(result).toStrictEqual(Option.some(encodedRow));
    });
  });

  it("should encode an absent name as null when the row holds none", () => {
    const { findProfile, readCurrentUser: read } = makeFakes(
      Effect.succeed(authenticatedCaller)
    );
    findProfile.mockReturnValue(
      Effect.succeed(Option.some(profileRow({ name: Option.none() })))
    );

    return read().then((result) => {
      expect(result).toStrictEqual(
        Option.some({ ...encodedRow, name: ABSENT_FIELD })
      );
    });
  });

  it("should serve the uploaded avatar when the row holds a key alongside a provider image", () => {
    const { findProfile, readCurrentUser: read } = makeFakes(
      Effect.succeed(authenticatedCaller)
    );
    findProfile.mockReturnValue(
      Effect.succeed(
        Option.some(
          profileRow({
            avatarKey: Option.some(AVATAR_KEY),
            image: Option.some(PROVIDER_IMAGE),
          })
        )
      )
    );

    return read().then((result) => {
      expect(result).toStrictEqual(
        Option.some({ ...encodedRow, avatarUrl: avatarUrlForKey(AVATAR_KEY) })
      );
    });
  });

  it("should fall back to the provider's image when the row holds no key", () => {
    const { findProfile, readCurrentUser: read } = makeFakes(
      Effect.succeed(authenticatedCaller)
    );
    findProfile.mockReturnValue(
      Effect.succeed(
        Option.some(profileRow({ image: Option.some(PROVIDER_IMAGE) }))
      )
    );

    return read().then((result) => {
      expect(result).toStrictEqual(
        Option.some({ ...encodedRow, avatarUrl: PROVIDER_IMAGE })
      );
    });
  });

  it("should propagate the defect when session resolution fails", () => {
    const { readCurrentUser: read } = makeFakes(
      Effect.die(new Error("session failed"))
    );

    const result = read();

    return expect(result).rejects.toThrow("session failed");
  });

  it("should answer with the fixed message rather than the query when the profile read fails", () => {
    vi.spyOn(console, "error").mockImplementation((): void => {});
    const { answer } = failingProfileRead();

    const result = answer();

    return expect(result).rejects.toThrow(
      /^The request could not be completed$/u
    );
  });

  it("should log the query without its parameters when the profile read fails", () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation((): void => {});
    const { answer } = failingProfileRead();

    return answer()
      .catch((): void => {})
      .then(() => {
        expect(errorSpy.mock.calls).toStrictEqual([
          [
            {
              event: "gateway.handlerDefect",
              message: `Failed query: ${PROFILE_QUERY}`,
              name: "DrizzleQueryError",
              stack: ABSENT_FIELD,
            },
          ],
        ]);
      });
  });
});
