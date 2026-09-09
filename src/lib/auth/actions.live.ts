import { authClient } from "./auth-client.live";

export const signInWithGoogle = async () => {
  await authClient.signIn.social({ callbackURL: "/", provider: "google" });
};

export const signOut = async () => {
  await authClient.signOut();
};
