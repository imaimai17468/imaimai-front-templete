import { Option } from "effect";
import { getCloudflareEnv } from "@/lib/cloudflare/env";
import { requireAuthSecret } from "./required-secret";
import type { AuthSecretName } from "./required-secret";

export const readAuthSecret = (name: AuthSecretName): string =>
  requireAuthSecret(name, Option.fromUndefinedOr(getCloudflareEnv()[name]));
