import { authClient } from "./auth-client.live";

export const signInWithGoogle = () =>
  authClient.signIn.social({ callbackURL: "/", provider: "google" });

export const signOut = () => authClient.signOut();
