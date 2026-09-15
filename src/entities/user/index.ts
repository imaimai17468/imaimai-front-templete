import { Schema } from "effect";

// The pattern the HTML Standard gives for a valid e-mail address, which is
// what `input type=email` accepts. Every class in it is ASCII, so the `u` flag
// changes nothing about which strings match.
// https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address
const isEmailAddress = Schema.isPattern(
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/u,
  { expected: "an email address" }
);

/**
 * テンプレートの User エンティティ。現在のページでは派生型 UserWithEmail のみ使用しているが、
 * 派生プロジェクトで単体 User バリデーションが必要になる想定で export を維持する。
 *
 * @public
 */
export const UserSchema = Schema.Struct({
  avatarUrl: Schema.NullOr(Schema.String),
  createdAt: Schema.DateTimeUtcFromString,
  id: Schema.String,
  name: Schema.NullOr(Schema.String),
  updatedAt: Schema.DateTimeUtcFromString,
});

/**
 * テンプレート用途で公開。UserSchema と対になる型。
 *
 * @public
 */
export type User = typeof UserSchema.Encoded;

export const UserWithEmailSchema = Schema.Struct({
  ...UserSchema.fields,
  email: Schema.String.check(isEmailAddress),
});

/**
 * `UserWithEmailSchema`'s encoded side, where the two instants are ISO-8601
 * strings and the whole value survives JSON. Decoding turns them into
 * `DateTime.Utc`.
 */
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
 * アバター URL 更新用スキーマ。テンプレ用途で公開、派生実装で使う想定。
 *
 * @public
 */
export const UpdateAvatarSchema = Schema.Struct({
  avatarUrl: Schema.URLFromString,
});

/**
 * UpdateAvatarSchema と対になる型。
 *
 * @public
 */
export type UpdateAvatar = typeof UpdateAvatarSchema.Encoded;
