import { describe, expect, it } from "vite-plus/test";
import { EXPECTED_DOCUMENT_HEADERS } from "../../scripts/smoke/smoke.expected.ts";
import { DOCUMENT_HEADERS } from "./-response-headers.ts";

describe("the document headers", () => {
  it("should hold every header and value a rendered document must carry when the root route answers", () => {
    expect(DOCUMENT_HEADERS).toStrictEqual(EXPECTED_DOCUMENT_HEADERS);
  });
});
