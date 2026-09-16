import { Option } from "effect";
import { authClient } from "./auth-client.live";
import { createDevSignIn } from "./dev-sign-in";

export const devSignIn = createDevSignIn({
  signIn: ({ email, password }) =>
    authClient.signIn
      .email({ email, password })
      .then(({ error }) =>
        Option.fromNullOr(error).pipe(
          Option.map((failure) => failure.message ?? "sign-in failed")
        )
      ),
  signUp: ({ email, name, password }) =>
    authClient.signUp
      .email({ email, name, password })
      .then(({ error }) =>
        Option.fromNullOr(error).pipe(
          Option.map((failure) => failure.message ?? "sign-up failed")
        )
      ),
});
