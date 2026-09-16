import { Option, Schema } from "effect";

// The pattern the HTML Standard gives for a valid e-mail address, which is
// what `input type=email` accepts. Every class in it is ASCII, so the `u` flag
// changes nothing about which strings match.
// https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address
const isEmailAddress = Schema.isPattern(
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/u,
  { expected: "an email address" }
);

/**
 * A template export, for a derived project that validates a `User` on its own.
 *
 * @public
 */
export const UserSchema = Schema.Struct({
  avatarUrl: Schema.OptionFromNullOr(Schema.String),
  createdAt: Schema.DateTimeUtcFromString,
  id: Schema.String,
  name: Schema.OptionFromNullOr(Schema.String),
  updatedAt: Schema.DateTimeUtcFromString,
});

/**
 * A template export, kept beside `UserSchema`.
 *
 * @public
 */
export type User = typeof UserSchema.Encoded;

export const UserWithEmailSchema = Schema.Struct({
  ...UserSchema.fields,
  email: Schema.String.check(isEmailAddress),
});

export type UserWithEmail = typeof UserWithEmailSchema.Encoded;

export const UpdateUserSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    name: Schema.String.check(
      Schema.isMinLength(1, { message: "Name is required" }),
      Schema.isMaxLength(50, { message: "Name must be 50 characters or less" })
    ),
  })
);

export type UpdateUser = typeof UpdateUserSchema.Type;

/**
 * A template export, for a derived project that updates an avatar URL.
 *
 * @public
 */
export const UpdateAvatarSchema = Schema.Struct({
  avatarUrl: Schema.URLFromString,
});

/**
 * A template export, kept beside `UpdateAvatarSchema`.
 *
 * @public
 */
export type UpdateAvatar = typeof UpdateAvatarSchema.Encoded;

/**
 * The name to show for a user.
 *
 * A row carries no name before the first profile save, and the form accepts a
 * blank submission as a clear, so both reach here and both fall back.
 */
export const displayName = (name: Option.Option<string>): string =>
  name.pipe(
    Option.filter((value) => value !== ""),
    Option.getOrElse(() => "User")
  );
