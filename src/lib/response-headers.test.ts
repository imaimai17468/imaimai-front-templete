import { describe, expect, it } from "vite-plus/test";
import { DOCUMENT_HEADERS } from "./response-headers";

describe("the document response headers", () => {
  it("should carry every header the document relies on when the root route sets it", () => {
    expect(DOCUMENT_HEADERS).toStrictEqual({
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "frame-ancestors 'none'",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=31536000",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
  });
});
