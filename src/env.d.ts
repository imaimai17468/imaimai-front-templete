/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * `"1"` sends a dev build's sign-in button to Google rather than to the dev
   * user, so the deployed path can be exercised locally.
   */
  readonly VITE_GOOGLE_SIGN_IN?: string;
}

declare module "*.css";
