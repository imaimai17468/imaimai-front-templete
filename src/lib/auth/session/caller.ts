import "@tanstack/react-start/server-only";
import { Option } from "effect";

/** The signed-in caller: the identity fields taken out of a session. */
export interface Caller {
  readonly email: string;
  readonly id: string;
}

export const pickUser = <User>(
  session: Option.Option<{ user: User }>
): Option.Option<NonNullable<User>> =>
  Option.flatMapNullishOr(session, ({ user }) => user);

export const pickCaller = <SessionUser extends Caller>(
  user: Option.Option<SessionUser>
): Option.Option<Caller> =>
  user.pipe(Option.map(({ email, id }) => ({ email, id })));
