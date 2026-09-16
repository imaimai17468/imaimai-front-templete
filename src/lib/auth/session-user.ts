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

/**
 * Keeps a session user's identity fields and drops everything else it carries,
 * so the value a consumer receives holds no more than its type admits.
 */
export const pickCaller = (
  user: Option.Option<Caller>
): Option.Option<Caller> =>
  user.pipe(Option.map(({ email, id }) => ({ email, id })));
