import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { Array, pipe, String } from "effect";
import type { AuthSecrets } from "@/lib/auth/options";
import { authOptions } from "@/lib/auth/options";

export const AUTH_SERVER_SECRETS: AuthSecrets = {
  authSecret: "auth-server-secret-0123456789abcdef0123456789",
  googleClientId: "auth-server-google-client-id",
  googleClientSecret: "auth-server-google-client-secret",
};

/**
 * Better Auth configured as the app configures it, over an in-memory database
 * of its own, so each call starts from no accounts.
 */
export const buildMemoryAuth = (isDevBuild: boolean) =>
  betterAuth(
    authOptions({
      database: memoryAdapter({
        account: [],
        rateLimit: [],
        session: [],
        user: [],
        verification: [],
      }),
      isDevBuild,
      secrets: AUTH_SERVER_SECRETS,
    })
  );

export type MemoryAuth = ReturnType<typeof buildMemoryAuth>;

type SentRequest = ReturnType<Request["clone"]>;

const isExpiring = (setCookie: string) =>
  String.includes("max-age=0")(String.toLowerCase(setCookie));

/** The cookies a browser holds after it receives `setCookie`, keyed by name. */
const applySetCookie = (
  jar: ReadonlyMap<string, string>,
  setCookie: string
): Map<string, string> => {
  const [pair] = String.split(setCookie, ";");
  const [name] = String.split(pair, "=");
  const next = new Map(jar);
  if (isExpiring(setCookie)) {
    next.delete(name);
  } else {
    next.set(name, pair);
  }
  return next;
};

/**
 * A `fetch` that `auth`'s handler answers as a browser on the same origin
 * would see it: each request carries the page's origin and the cookies the
 * earlier responses set. `cookie` answers the `Cookie` header the browser
 * holds now, and `sent` the requests sent so far, in order.
 */
export const connectBrowserTo = (auth: MemoryAuth) => {
  const sent: SentRequest[] = [];
  const browser = { jar: new Map<string, string>() };
  const cookie = () => pipe([...browser.jar.values()], Array.join("; "));
  const fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const headers = new Headers(request.headers);
    headers.set("origin", new URL(request.url).origin);
    headers.set("cookie", cookie());
    sent.push(request.clone());
    return auth.handler(new Request(request, { headers })).then((response) => {
      browser.jar = Array.reduce(
        response.headers.getSetCookie(),
        browser.jar,
        applySetCookie
      );
      return response;
    });
  };
  return { cookie, fetch, sent: (): readonly SentRequest[] => [...sent] };
};
