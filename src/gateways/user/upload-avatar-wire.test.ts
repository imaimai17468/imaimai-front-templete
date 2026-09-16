import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { UploadAvatarResult } from "./profile-writer";
import { fromWire, toWire } from "./upload-avatar-wire";

const UPLOADED = {
  avatarUrl: "https://example.com/a.png",
  cleanup: "complete",
  status: "uploaded",
} satisfies UploadAvatarResult;

const ORPHANED_KEY = "user-1/avatars/a.png";

// `effect/noNullish` reports a written `null`, so the wire's absent key is
// built from a `None` rather than spelled out.
const ABSENT_KEY = Option.getOrNull(Option.none<string>());

describe(toWire, () => {
  it("should leave the result untouched when the upload succeeded", () => {
    const result = toWire(UPLOADED);

    expect(result).toStrictEqual(UPLOADED);
  });

  it("should send the orphaned key as a bare string when the rollback left an object", () => {
    const result = toWire({
      message: "Failed to upload avatar",
      orphanedKey: Option.some(ORPHANED_KEY),
      status: "failed",
    });

    expect(result).toStrictEqual({
      message: "Failed to upload avatar",
      orphanedKey: ORPHANED_KEY,
      status: "failed",
    });
  });

  it("should send an absent orphaned key as null when nothing was left behind", () => {
    const result = toWire({
      message: "Not authenticated",
      orphanedKey: Option.none(),
      status: "failed",
    });

    expect(result).toStrictEqual({
      message: "Not authenticated",
      orphanedKey: ABSENT_KEY,
      status: "failed",
    });
  });
});

describe(fromWire, () => {
  it("should leave the result untouched when the upload succeeded", () => {
    const result = fromWire(UPLOADED);

    expect(result).toStrictEqual(UPLOADED);
  });

  it("should rebuild the orphaned key as Some when the wire carried one", () => {
    const result = fromWire({
      message: "Failed to upload avatar",
      orphanedKey: ORPHANED_KEY,
      status: "failed",
    });

    expect(result).toStrictEqual({
      message: "Failed to upload avatar",
      orphanedKey: Option.some(ORPHANED_KEY),
      status: "failed",
    });
  });

  it("should rebuild the orphaned key as None when the wire carried none", () => {
    const result = fromWire({
      message: "Not authenticated",
      orphanedKey: ABSENT_KEY,
      status: "failed",
    });

    expect(result).toStrictEqual({
      message: "Not authenticated",
      orphanedKey: Option.none(),
      status: "failed",
    });
  });
});
