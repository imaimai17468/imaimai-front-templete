import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { httpsUrl } from "./https-url";

// Assembled rather than written out, because the lint forbids the literal.
const SCRIPT_URL = ["javascript", "alert(1)"].join(":");

describe(httpsUrl, () => {
  it.each([
    "https://lh3.googleusercontent.com/a/abc123",
    "https://example.com",
    "HTTPS://example.com/avatar.png",
  ])("should return the value when %j is an https URL", (value) => {
    expect(httpsUrl(value)).toStrictEqual(Option.some(value));
  });

  it.each([
    "http://example.com/avatar.png",
    SCRIPT_URL,
    "data:text/html,<script>alert(1)</script>",
    "//example.com/avatar.png",
    "/api/avatars?key=user-1/avatar.png",
    "not a url",
    "",
  ])("should return a None when %j is not an https URL", (value) => {
    expect(httpsUrl(value)).toStrictEqual(Option.none());
  });
});
