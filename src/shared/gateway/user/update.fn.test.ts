import { Array as Arr, String as Str, pipe } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  MAX_AVATAR_BYTES,
  MAX_AVATAR_MEGABYTES,
} from "@/lib/storage/avatar-validation";
import { AvatarUploadForm, ProfileUpdateForm } from "./update.fn";

const pngFile = (byteLength: number) =>
  new File([new Uint8Array(byteLength)], "a.png", { type: "image/png" });

type ServerFnForm = typeof AvatarUploadForm | typeof ProfileUpdateForm;

// The Standard Schema contract lets `validate` answer with the result or with
// a Promise of it, and this resolves both arms.
const validate = (form: ServerFnForm, input: FormData | URLSearchParams) =>
  globalThis.Promise.resolve(form["~standard"].validate(input));

const issueMessages = (form: ServerFnForm, input: FormData | URLSearchParams) =>
  validate(form, input).then((result) =>
    pipe(
      result.issues ?? [],
      Arr.map(({ message }) => message)
    )
  );

describe("the profile update form", () => {
  it("should reject when the input is not FormData", () => {
    const data = new URLSearchParams({ name: "Updated User" });

    return expect(
      issueMessages(ProfileUpdateForm, data)
    ).resolves.toStrictEqual(["Expected FormData"]);
  });

  it("should return the parsed name when the name is valid", () => {
    const data = new FormData();
    data.set("name", "Updated User");

    return expect(validate(ProfileUpdateForm, data)).resolves.toStrictEqual({
      value: { name: "Updated User" },
    });
  });

  it.each([
    ["empty", "", "Name is required"],
    [
      "over 50 characters",
      Str.repeat(51)("a"),
      "Name must be 50 characters or less",
    ],
  ])("should reject when the name is %s", (_label, name, message) => {
    const data = new FormData();
    data.set("name", name);

    return expect(
      issueMessages(ProfileUpdateForm, data)
    ).resolves.toStrictEqual([message]);
  });
});

describe("the avatar upload form", () => {
  it("should reject when the input is not FormData", () => {
    const data = new URLSearchParams({ name: "Updated User" });

    return expect(issueMessages(AvatarUploadForm, data)).resolves.toStrictEqual(
      ["Expected FormData"]
    );
  });

  it("should reject when the avatar entry is absent", () => {
    const data = new FormData();

    return expect(issueMessages(AvatarUploadForm, data)).resolves.toStrictEqual(
      ["No file selected"]
    );
  });

  it("should reject when the avatar entry is not a File", () => {
    const data = new FormData();
    data.set("avatar", "a.png");

    return expect(issueMessages(AvatarUploadForm, data)).resolves.toStrictEqual(
      ["No file selected"]
    );
  });

  it("should reject when the avatar is empty", () => {
    const data = new FormData();
    data.set("avatar", pngFile(0));

    return expect(issueMessages(AvatarUploadForm, data)).resolves.toStrictEqual(
      ["No file selected"]
    );
  });

  it("should reject when the avatar exceeds the size limit", () => {
    const data = new FormData();
    data.set("avatar", pngFile(MAX_AVATAR_BYTES + 1));

    return expect(issueMessages(AvatarUploadForm, data)).resolves.toStrictEqual(
      [`Avatar must be ${MAX_AVATAR_MEGABYTES}MB or smaller`]
    );
  });

  it("should return the file when the avatar size is acceptable", () => {
    const file = pngFile(1);
    const data = new FormData();
    data.set("avatar", file);

    return expect(validate(AvatarUploadForm, data)).resolves.toStrictEqual({
      value: { avatar: file },
    });
  });
});
