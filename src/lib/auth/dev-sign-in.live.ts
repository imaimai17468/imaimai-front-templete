import { Option } from "effect";
import { authClient } from "./auth-client.live";
import { createDevSignIn } from "./dev-sign-in";

export const devSignIn = createDevSignIn({
  signIn: async ({ email, password }) => {
    const { error } = await authClient.signIn.email({ email, password });
    return Option.fromNullOr(error).pipe(
      Option.map((failure) => failure.message ?? "sign-in failed"),
      Option.getOrNull
    );
  },
  signUp: async ({ email, name, password }) => {
    const { error } = await authClient.signUp.email({ email, name, password });
    return Option.fromNullOr(error).pipe(
      Option.map((failure) => failure.message ?? "sign-up failed"),
      Option.getOrNull
    );
  },
});
