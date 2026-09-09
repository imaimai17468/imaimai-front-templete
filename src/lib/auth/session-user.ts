export const pickUser = <User>(
  session: { user: User } | null | undefined
): User | null => session?.user ?? null;
