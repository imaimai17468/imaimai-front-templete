import { describe, expect, it, vi } from "vitest";
import { submitProfile } from "./profile-submit";

type UploadDep = (file: File) => Promise<{ error?: string }>;
type UpdateDep = (name: string) => Promise<{ error?: string }>;

const upload = () => vi.fn<UploadDep>();
const update = () => vi.fn<UpdateDep>();
const anAvatar = () => new File(["x"], "a.png", { type: "image/png" });

describe("submitProfile", () => {
  it("should skip the avatar upload when no file was picked", async () => {
    const uploadAvatar = upload();
    const updateProfile = update().mockResolvedValue({});

    const outcome = await submitProfile(
      { name: "Ada", avatar: null },
      { uploadAvatar, updateProfile }
    );

    expect({ outcome, uploadCalls: uploadAvatar.mock.calls.length }).toEqual({
      outcome: { kind: "succeeded" },
      uploadCalls: 0,
    });
  });

  it("should leave the name untouched when the avatar upload fails", async () => {
    const uploadAvatar = upload().mockResolvedValue({ error: "too big" });
    const updateProfile = update().mockResolvedValue({});

    const outcome = await submitProfile(
      { name: "Ada", avatar: anAvatar() },
      { uploadAvatar, updateProfile }
    );

    expect({ outcome, profileCalls: updateProfile.mock.calls.length }).toEqual({
      outcome: { kind: "failed", message: "too big" },
      profileCalls: 0,
    });
  });

  it("should report the failure when the profile update fails", async () => {
    const uploadAvatar = upload().mockResolvedValue({});
    const updateProfile = update().mockResolvedValue({ error: "nope" });

    const outcome = await submitProfile(
      { name: "Ada", avatar: anAvatar() },
      { uploadAvatar, updateProfile }
    );

    expect(outcome).toEqual({ kind: "failed", message: "nope" });
  });

  it("should succeed when both the avatar and the name are saved", async () => {
    const uploadAvatar = upload().mockResolvedValue({});
    const updateProfile = update().mockResolvedValue({});

    const outcome = await submitProfile(
      { name: "Ada", avatar: anAvatar() },
      { uploadAvatar, updateProfile }
    );

    expect(outcome).toEqual({ kind: "succeeded" });
  });
});
