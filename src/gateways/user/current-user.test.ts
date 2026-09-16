import { Effect, Layer, Option } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { CurrentSession } from "@/lib/auth/current-session.live";
import { DriverFailed } from "@/test/defect";
import { UserGateway, UserPersistenceError } from ".";
import { CurrentUserReader, readCurrentUser } from "./current-user";

// similarity-ignore: avatar/reader.test.ts の makeFakes とは別のサービス（AvatarReader vs
// CurrentUserReader）の Layer を組む。CurrentSession を差し替える形が一致しているだけで、
// 共通化すると片方のサービスの依存が変わるたびにもう片方のテストが動く。
const makeFakes = (read: CurrentSession["Service"]["read"]) => {
  const fetchCurrentUser = vi.fn<UserGateway["Service"]["fetchCurrentUser"]>();
  const layer = CurrentUserReader.layerNoDeps.pipe(
    Layer.provide(
      Layer.merge(
        Layer.succeed(CurrentSession, CurrentSession.of({ read })),
        Layer.succeed(
          UserGateway,
          UserGateway.of({
            fetchCurrentUser,
            updateUser: vi.fn<UserGateway["Service"]["updateUser"]>(),
            updateUserAvatar:
              vi.fn<UserGateway["Service"]["updateUserAvatar"]>(),
          })
        )
      )
    )
  );

  return {
    fetchCurrentUser,
    readCurrentUser: () =>
      Effect.runPromise(readCurrentUser.pipe(Effect.provide(layer))),
  };
};

const authenticatedCaller = Option.some({
  email: "user-1@example.com",
  id: "user-1",
});

describe("CurrentUserReader.read", () => {
  it("should return null without reading the gateway when the request is anonymous", () => {
    const { fetchCurrentUser, readCurrentUser: read } = makeFakes(
      Effect.succeed(Option.none())
    );

    return read().then((result) => {
      expect({ fetchCalls: fetchCurrentUser.mock.calls, result }).toStrictEqual(
        {
          fetchCalls: [],
          result: null,
        }
      );
    });
  });

  it("should pass the server-derived identity when the request is authenticated", () => {
    const { fetchCurrentUser, readCurrentUser: read } = makeFakes(
      Effect.succeed(authenticatedCaller)
    );
    fetchCurrentUser.mockReturnValue(Effect.succeed(null));

    return read().then((result) => {
      expect({ fetchCalls: fetchCurrentUser.mock.calls, result }).toStrictEqual(
        {
          fetchCalls: [["user-1", "user-1@example.com"]],
          result: null,
        }
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

  it("should propagate the cause as a defect when the gateway read fails", () => {
    const { fetchCurrentUser, readCurrentUser: read } = makeFakes(
      Effect.succeed(authenticatedCaller)
    );
    fetchCurrentUser.mockReturnValue(
      Effect.fail(
        new UserPersistenceError({
          cause: new DriverFailed({ message: "D1 failed" }),
        })
      )
    );

    const result = read();

    return expect(result).rejects.toThrow("D1 failed");
  });
});
