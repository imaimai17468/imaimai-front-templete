import { authClient } from "./auth-client";

export const signInWithGoogle = async () => {
  await authClient.signIn.social({ callbackURL: "/", provider: "google" });
};

export const signOut = async () => {
  await authClient.signOut();
};
