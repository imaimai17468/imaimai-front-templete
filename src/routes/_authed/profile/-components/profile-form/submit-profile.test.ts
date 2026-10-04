import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Option } from "effect";
import type { UpdateUser } from "@/shared/entities/user";
import { createSubmitProfile } from "./submit-profile";
import type { SubmitProfileDeps } from "./submit-profile";

const DATA: UpdateUser = { name: "New Name" };

const AVATAR = new File([new Uint8Array([0x89])], "avatar", {
  type: "image/png",
});

const makeFakes = () => {
  const updateProfile = vi.fn<SubmitProfileDeps["updateProfile"]>();
  const uploadAvatar = vi.fn<SubmitProfileDeps["uploadAvatar"]>();

  updateProfile.mockResolvedValue({ status: "updated" });
  uploadAvatar.mockResolvedValue({
    avatarUrl: "https://example.com/a.png",
    cleanup: "complete",
    status: "uploaded",
  });

  return {
    submitProfile: createSubmitProfile({ updateProfile, uploadAvatar }),
    updateProfile,
    uploadAvatar,
  };
};

describe("submitProfile", () => {
  it.effect(
    "should save the name and leave the avatar alone when no file is pending",
    () =>
      Effect.gen(function* saveTheNameAndLeaveTheAvatarAlone() {
        const { submitProfile, updateProfile, uploadAvatar } = makeFakes();

        const submission = yield* Effect.promise(() =>
          submitProfile(DATA, Option.none())
        );

        expect({
          submission,
          submittedName: updateProfile.mock.calls[0]?.[0].get("name"),
          uploadCalls: uploadAvatar.mock.calls,
        }).toStrictEqual({
          submission: { avatarUploaded: false, outcome: { status: "saved" } },
          submittedName: "New Name",
          uploadCalls: [],
        });
      })
  );

  it.effect(
    "should report the name failure when no file is pending and the write is rejected",
    () =>
      Effect.gen(function* reportTheNameFailure() {
        const { submitProfile, updateProfile } = makeFakes();
        updateProfile.mockResolvedValue({
          message: "Failed to update profile",
          status: "failed",
        });

        const submission = yield* Effect.promise(() =>
          submitProfile(DATA, Option.none())
        );

        expect(submission).toStrictEqual({
          avatarUploaded: false,
          outcome: { message: "Failed to update profile", status: "failed" },
        });
      })
  );

  it.effect(
    "should leave the name unwritten when the pending avatar fails to upload",
    () =>
      Effect.gen(function* leaveTheNameUnwritten() {
        const { submitProfile, updateProfile, uploadAvatar } = makeFakes();
        uploadAvatar.mockResolvedValue({
          message: "Failed to upload avatar",
          status: "failed",
        });

        const submission = yield* Effect.promise(() =>
          submitProfile(DATA, Option.some(AVATAR))
        );

        expect({
          submission,
          updateCalls: updateProfile.mock.calls,
          uploadedFile: uploadAvatar.mock.calls[0]?.[0].get("avatar"),
        }).toStrictEqual({
          submission: {
            avatarUploaded: false,
            outcome: { message: "Failed to upload avatar", status: "failed" },
          },
          updateCalls: [],
          uploadedFile: AVATAR,
        });
      })
  );

  it.effect(
    "should report the avatar as uploaded when both the upload and the name write succeed",
    () =>
      Effect.gen(function* reportTheAvatarAsUploaded() {
        const { submitProfile } = makeFakes();

        const submission = yield* Effect.promise(() =>
          submitProfile(DATA, Option.some(AVATAR))
        );

        expect(submission).toStrictEqual({
          avatarUploaded: true,
          outcome: { status: "saved" },
        });
      })
  );

  it.effect(
    "should report the avatar as uploaded when the upload succeeds and the name write is rejected",
    () =>
      Effect.gen(function* reportTheAvatarAsUploadedDespiteTheNameFailure() {
        const { submitProfile, updateProfile } = makeFakes();
        updateProfile.mockResolvedValue({
          message: "Failed to update profile",
          status: "failed",
        });

        const submission = yield* Effect.promise(() =>
          submitProfile(DATA, Option.some(AVATAR))
        );

        expect(submission).toStrictEqual({
          avatarUploaded: true,
          outcome: { message: "Failed to update profile", status: "failed" },
        });
      })
  );
});
