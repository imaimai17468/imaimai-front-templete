import { Option } from "effect";

export const pickUser = <User>(
  session: Option.Option<{ user: User }>
): Option.Option<NonNullable<User>> =>
  Option.flatMapNullishOr(session, ({ user }) => user);
