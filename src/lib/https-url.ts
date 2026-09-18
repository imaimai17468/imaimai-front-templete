import { Option, Schema } from "effect";

const isHttps = Schema.makeFilter<URL>((url) => url.protocol === "https:", {
  message: "an https URL",
});

const decodeHttpsUrl = Schema.decodeUnknownOption(
  Schema.URLFromString.check(isHttps)
);

/**
 * `value` when it parses as an absolute `https` URL, as the string it arrived
 * as. The string survives rather than the parsed `URL`, because the caller
 * hands it to the browser as an attribute value and a re-serialized URL is no
 * longer the value that was stored.
 */
export const httpsUrl = (value: string): Option.Option<string> =>
  Option.map(decodeHttpsUrl(value), () => value);
