import { authClient } from "./auth-client.live";
import { createDevSignIn } from "./dev-sign-in";

export const devSignIn = createDevSignIn({
  signIn: async ({ email, password }) => {
    const { error } = await authClient.signIn.email({ email, password });
    return error === null ? null : (error.message ?? "sign-in failed");
  },
  signUp: async ({ email, name, password }) => {
    const { error } = await authClient.signUp.email({ email, name, password });
    return error === null ? null : (error.message ?? "sign-up failed");
  },
});
