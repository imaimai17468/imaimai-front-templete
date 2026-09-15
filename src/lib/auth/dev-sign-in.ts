import type { DevUser } from "./dev-users";

type AuthFailureMessage = string;

export type DevSignInResult =
  | { kind: "signed-in" }
  | { kind: "created" }
  | { kind: "failed"; message: string };

export interface DevSignInDeps {
  signIn: (user: DevUser) => Promise<AuthFailureMessage | null>;
  signUp: (user: DevUser) => Promise<AuthFailureMessage | null>;
}

const RECOVERY =
  "Run bun run db:push:local. If that does not help, reset the local D1.";

export const createDevSignIn =
  ({ signIn, signUp }: DevSignInDeps) =>
  async (user: DevUser): Promise<DevSignInResult> => {
    try {
      const signInFailure = await signIn(user);
      if (signInFailure === null) {
        return { kind: "signed-in" };
      }
      const signUpFailure = await signUp(user);
      if (signUpFailure !== null) {
        return { kind: "failed", message: `${signUpFailure} ${RECOVERY}` };
      }
      return { kind: "created" };
    } catch (error) {
      return {
        kind: "failed",
        message: error instanceof Error ? error.message : RECOVERY,
      };
    }
  };
