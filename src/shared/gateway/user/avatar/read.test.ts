import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { CurrentSession } from "@/lib/auth/session";
import { DriverFailed } from "@/test/defect";
import { capturedReports } from "@/test/error-reports";
import { AvatarBucket, AvatarObject } from ".";
import { UserPersistenceError } from "..";
import {
  AvatarInvalidKey,
  AvatarNotFound,
  AvatarReadFailed,
  AvatarReader,
  AvatarUnauthorized,
  getAvatarResponse,
} from "./read";

const makeFakes = (read: CurrentSession["Service"]["read"]) => {
  const fetchAvatar = vi.fn<AvatarBucket["Service"]["get"]>();
  const layer = AvatarReader.layerNoDeps.pipe(
    Layer.provide(
      Layer.merge(
        Layer.succeed(
          AvatarBucket,
          AvatarBucket.of({
            get: fetchAvatar,
            put: vi.fn<AvatarBucket["Service"]["put"]>(),
            remove: vi.fn<AvatarBucket["Service"]["remove"]>(),
          })
        ),
        Layer.succeed(CurrentSession, CurrentSession.of({ read }))
      )
    )
  );
  return {
    fetchAvatar,
    readAvatarOrFailure: (key: Option.Option<string>) =>
      Effect.gen(function* callRead() {
        const reader = yield* AvatarReader;
        return yield* reader.read(key);
      }).pipe(
        Effect.provide(layer),
        Effect.catch((error) => Effect.succeed(error))
      ),
  };
};

const signedInAs = (userId: string) =>
  Option.some({ email: `${userId}@example.com`, id: userId });

const ownKey = Option.some("user-1/avatar.png");

const rejectedKeyCases = [
  ["the key is missing", Option.none()],
  ["the key belongs to another user", Option.some("user-2/avatar.png")],
  ["the key is malformed", Option.some("../user-1/avatar.png")],
] satisfies [string, Option.Option<string>][];

describe("AvatarReader.read", () => {
  it.effect(
    "should reject without reading persistence when the request is anonymous",
    () =>
      Effect.gen(function* rejectAnAnonymousRequest() {
        const { fetchAvatar, readAvatarOrFailure } = makeFakes(
          Effect.succeed(Option.none())
        );

        const result = yield* readAvatarOrFailure(ownKey);

        expect({ fetchCalls: fetchAvatar.mock.calls, result }).toStrictEqual({
          fetchCalls: [],
          result: new AvatarUnauthorized(),
        });
      })
  );

  it.effect.each(rejectedKeyCases)(
    "should reject without reading persistence when %s",
    ([_label, key]) =>
      Effect.gen(function* rejectAnInvalidKey() {
        const { fetchAvatar, readAvatarOrFailure } = makeFakes(
          Effect.succeed(signedInAs("user-1"))
        );

        const result = yield* readAvatarOrFailure(key);

        expect({ fetchCalls: fetchAvatar.mock.calls, result }).toStrictEqual({
          fetchCalls: [],
          result: new AvatarInvalidKey(),
        });
      })
  );

  it.effect("should fail with not-found when the owned object is absent", () =>
    Effect.gen(function* failWithNotFound() {
      const { fetchAvatar, readAvatarOrFailure } = makeFakes(
        Effect.succeed(signedInAs("user-1"))
      );
      fetchAvatar.mockReturnValue(Effect.succeed(Option.none()));

      const result = yield* readAvatarOrFailure(ownKey);

      expect({ fetchCalls: fetchAvatar.mock.calls, result }).toStrictEqual({
        fetchCalls: [["user-1/avatar.png"]],
        result: new AvatarNotFound(),
      });
    })
  );

  it.effect(
    "should return the gateway object when the owned object exists",
    () =>
      Effect.gen(function* returnTheGatewayObject() {
        const { fetchAvatar, readAvatarOrFailure } = makeFakes(
          Effect.succeed(signedInAs("user-1"))
        );
        const avatar = new AvatarObject(new ReadableStream(), "image/png");
        fetchAvatar.mockReturnValue(Effect.succeed(Option.some(avatar)));

        const result = yield* readAvatarOrFailure(ownKey);

        expect({
          fetchCalls: fetchAvatar.mock.calls,
          sameObject: result === avatar,
        }).toStrictEqual({
          fetchCalls: [["user-1/avatar.png"]],
          sameObject: true,
        });
      })
  );

  it.effect("should propagate the defect when session resolution fails", () =>
    Effect.gen(function* propagateTheSessionDefect() {
      const sessionFailure = new DriverFailed({ message: "session failed" });
      const { readAvatarOrFailure } = makeFakes(Effect.die(sessionFailure));

      const defect = yield* readAvatarOrFailure(ownKey).pipe(
        Effect.catchDefect(Effect.succeed)
      );

      expect(defect).toBe(sessionFailure);
    })
  );

  it.effect(
    "should fail with read-failed and report the cause when persistence fails",
    () =>
      Effect.gen(function* failWithReadFailed() {
        const { fetchAvatar, readAvatarOrFailure } = makeFakes(
          Effect.succeed(signedInAs("user-1"))
        );
        fetchAvatar.mockReturnValue(
          Effect.fail(
            new UserPersistenceError({
              cause: new DriverFailed({ message: "R2 failed" }),
            })
          )
        );

        const result = yield* readAvatarOrFailure(ownKey);
        const reported = yield* capturedReports;

        expect({ reported, result }).toStrictEqual({
          reported: [
            {
              event: "user.readAvatar",
              message: "R2 failed",
              name: "DriverFailed",
            },
          ],
          result: new AvatarReadFailed(),
        });
      })
  );
});

const respondThrough =
  (read: AvatarReader["Service"]["read"]) => (request: Request) =>
    getAvatarResponse(request).pipe(
      Effect.provide(Layer.succeed(AvatarReader, AvatarReader.of({ read })))
    );

const avatarRequest = () =>
  new Request("https://example.com/api/avatars?key=user-1%2Favatar.png");

const avatarBody = () =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("avatar-body"));
      controller.close();
    },
  });

const errorCases = [
  { error: "Unauthorized", failure: new AvatarUnauthorized(), status: 401 },
  { error: "Invalid key", failure: new AvatarInvalidKey(), status: 400 },
  { error: "Not found", failure: new AvatarNotFound(), status: 404 },
  {
    error: "Failed to read avatar",
    failure: new AvatarReadFailed(),
    status: 500,
  },
] satisfies {
  error: string;
  failure: Effect.Error<ReturnType<AvatarReader["Service"]["read"]>>;
  status: number;
}[];

describe(getAvatarResponse, () => {
  it.effect.each(errorCases)(
    "should answer $status with $error when the authorization boundary fails with $failure._tag",
    ({ error, failure, status }) =>
      Effect.gen(function* answerTheRejection() {
        const respond = respondThrough(() => Effect.fail(failure));

        const response = yield* respond(avatarRequest());
        const body = yield* Effect.promise(() => response.json());

        expect({ body, status: response.status }).toStrictEqual({
          body: { error },
          status,
        });
      })
  );

  it.effect(
    "should return the object's own response when the authorization boundary returns an avatar",
    () =>
      Effect.gen(function* serveTheObject() {
        const respond = respondThrough(() =>
          Effect.succeed(new AvatarObject(avatarBody(), "image/webp"))
        );

        const response = yield* respond(avatarRequest());
        const body = yield* Effect.promise(() => response.text());

        expect({
          body,
          headers: Object.fromEntries(response.headers),
          status: response.status,
        }).toStrictEqual({
          body: "avatar-body",
          headers: {
            "cache-control": "private, max-age=31536000, immutable",
            "content-security-policy": "default-src 'none'",
            "content-type": "image/webp",
            "x-content-type-options": "nosniff",
          },
          status: 200,
        });
      })
  );

  it.effect(
    "should pass the query string's key to the authorization boundary when the request carries one",
    () =>
      Effect.gen(function* passTheQueryKey() {
        const read = vi.fn<AvatarReader["Service"]["read"]>();
        read.mockReturnValue(Effect.fail(new AvatarNotFound()));

        yield* respondThrough(read)(avatarRequest());

        expect(read.mock.calls).toStrictEqual([
          [Option.some("user-1/avatar.png")],
        ]);
      })
  );

  it.effect(
    "should pass an absent key to the authorization boundary when the request carries no key",
    () =>
      Effect.gen(function* passAnAbsentKey() {
        const read = vi.fn<AvatarReader["Service"]["read"]>();
        read.mockReturnValue(Effect.fail(new AvatarInvalidKey()));

        yield* respondThrough(read)(
          new Request("https://example.com/api/avatars")
        );

        expect(read.mock.calls).toStrictEqual([[Option.none()]]);
      })
  );

  it.effect(
    "should propagate the defect when the authorization boundary dies",
    () =>
      Effect.gen(function* propagateTheDefect() {
        const readFailure = new DriverFailed({ message: "avatar read failed" });
        const respond = respondThrough(() => Effect.die(readFailure));

        const defect = yield* respond(avatarRequest()).pipe(
          Effect.catchDefect(Effect.succeed)
        );

        expect(defect).toBe(readFailure);
      })
  );
});
