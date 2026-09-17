import { describe, expect, it } from "vite-plus/test";
import { MAX_AVATAR_BYTES } from "@/lib/storage/avatar-validation";
import { parseAvatarUpload, parseProfileUpdate } from "./update.fn";

const pngFile = (byteLength: number) =>
  new File([new Uint8Array(byteLength)], "a.png", { type: "image/png" });

describe(parseProfileUpdate, () => {
  it("should reject when the input is not FormData", () => {
    const data = {};

    const parse = () => parseProfileUpdate(data);

    expect(parse).toThrow("Expected FormData");
  });

  it("should return the parsed name when the name is valid", () => {
    const data = new FormData();
    data.set("name", "Updated User");

    const result = parseProfileUpdate(data);

    expect(result).toStrictEqual({ name: "Updated User" });
  });

  it.each([
    ["empty", "", "Name is required"],
    [
      "over 50 characters",
      "a".repeat(51),
      "Name must be 50 characters or less",
    ],
  ])("should reject when the name is %s", (_label, name, message) => {
    const data = new FormData();
    data.set("name", name);

    const parse = () => parseProfileUpdate(data);

    expect(parse).toThrow(message);
  });
});

describe(parseAvatarUpload, () => {
  it("should reject when the input is not FormData", () => {
    const data = {};

    const parse = () => parseAvatarUpload(data);

    expect(parse).toThrow("Expected FormData");
  });

  it("should reject when the avatar entry is absent", () => {
    const data = new FormData();

    const parse = () => parseAvatarUpload(data);

    expect(parse).toThrow("No file selected");
  });

  it("should reject when the avatar entry is not a File", () => {
    const data = new FormData();
    data.set("avatar", "a.png");

    const parse = () => parseAvatarUpload(data);

    expect(parse).toThrow("No file selected");
  });

  it("should reject when the avatar is empty", () => {
    const data = new FormData();
    data.set("avatar", pngFile(0));

    const parse = () => parseAvatarUpload(data);

    expect(parse).toThrow("No file selected");
  });

  it("should reject when the avatar exceeds the size limit", () => {
    const data = new FormData();
    data.set("avatar", pngFile(MAX_AVATAR_BYTES + 1));

    const parse = () => parseAvatarUpload(data);

    expect(parse).toThrow(
      `Avatar must be ${MAX_AVATAR_BYTES / 1024 / 1024}MB or smaller`
    );
  });

  it("should return the file when the avatar size is acceptable", () => {
    const file = pngFile(1);
    const data = new FormData();
    data.set("avatar", file);

    const result = parseAvatarUpload(data);

    expect(result).toStrictEqual({ file });
  });
});
