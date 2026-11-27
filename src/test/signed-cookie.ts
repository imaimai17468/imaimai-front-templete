import { Array, Effect, Option, pipe, String } from "effect";
import { Base64 } from "effect/encoding";

const HMAC_SHA256 = {
  hash: "SHA-256",
  name: "HMAC",
} satisfies HmacImportParams;

const encode = (text: string) => new TextEncoder().encode(text);

/** The base64 HMAC-SHA256 of `value` under `secret`. */
const signValue = (value: string, secret: string) =>
  Effect.promise(() =>
    crypto.subtle
      .importKey("raw", encode(secret), HMAC_SHA256, false, ["sign"])
      .then((key) => crypto.subtle.sign(HMAC_SHA256, key, encode(value)))
  ).pipe(Effect.map((signature) => Base64.encode(new Uint8Array(signature))));

/**
 * The cookie `name` in a `Cookie` header, decoded, beside the value it holds
 * before its `.<signature>` suffix.
 */
const findSignedCookie = (cookieHeader: string, name: string) =>
  pipe(
    String.split(cookieHeader, "; "),
    Array.findFirst(String.startsWith(`${name}=`)),
    Option.map((pair) =>
      decodeURIComponent(String.slice(name.length + 1)(pair))
    ),
    Option.flatMap((signed) =>
      pipe(
        String.lastIndexOf(".")(signed),
        Option.map((end) => ({
          signed,
          unsigned: String.slice(0, end)(signed),
        }))
      )
    )
  );

/**
 * Whether the cookie `name` in a `Cookie` header holds a value signed with
 * `secret`, in the `<value>.<base64 HMAC-SHA256>` form a signed cookie takes.
 */
export const isCookieSignedWith = (
  cookieHeader: string,
  name: string,
  secret: string
): Effect.Effect<boolean> =>
  pipe(
    findSignedCookie(cookieHeader, name),
    Option.match({
      onNone: () => Effect.succeed(false),
      onSome: ({ signed, unsigned }) =>
        signValue(unsigned, secret).pipe(
          Effect.map((signature) => signed === `${unsigned}.${signature}`)
        ),
    })
  );
