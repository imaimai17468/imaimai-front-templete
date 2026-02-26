import { authClient } from "./auth/auth-client";

export const signInWithGoogle = async () => {
  await authClient.signIn.social({ provider: "google", callbackURL: "/" });
};

export const signOut = async () => {
  await authClient.signOut();
};
