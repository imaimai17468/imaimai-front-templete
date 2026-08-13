import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateUserAvatar } from ".";

const AVATAR_UUID = "123e4567-e89b-42d3-a456-426614174000";
const NEW_KEY = `user-1/avatars/${AVATAR_UUID}.png`;
const NEW_URL = `/api/avatars?key=${encodeURIComponent(NEW_KEY)}`;
const OLD_KEY = "user-1/avatar.jpg";
const OLD_URL = `/api/avatars?key=${encodeURIComponent(OLD_KEY)}`;

type UpdateReturning = () => Promise<Array<{ id: string }>>;
type UpdateSet = (values: unknown) => {
  where: () => { returning: UpdateReturning };
};

const { deleteFromR2, selectLimit, updateReturning, updateSet, uploadToR2 } =
  vi.hoisted(() => ({
    deleteFromR2: vi.fn<(key: string) => Promise<void>>(),
    selectLimit: vi.fn<() => Promise<Array<{ avatarUrl: string | null }>>>(),
    updateReturning: vi.fn<UpdateReturning>(),
    updateSet: vi.fn<UpdateSet>(),
    uploadToR2:
      vi.fn<
        (
          key: string,
          file: File | ArrayBuffer,
          contentType: string
        ) => Promise<string>
      >(),
  }));

vi.mock("@/lib/drizzle/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: selectLimit,
        }),
      }),
    }),
    update: () => ({
      set: updateSet,
    }),
  }),
}));

vi.mock("@/lib/storage/r2", () => ({
  uploadToR2,
  deleteFromR2,
}));

const imageFile = (mimeType: string, bytes: number[]) =>
  new File([new Uint8Array(bytes)], "avatar", { type: mimeType });

const validPng = () =>
  imageFile("image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("updateUserAvatar", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(AVATAR_UUID);
    updateSet.mockReturnValue({
      where: () => ({ returning: updateReturning }),
    });
    uploadToR2.mockResolvedValue(NEW_URL);
    deleteFromR2.mockResolvedValue();
  });

  it.each([
    ["the MIME type is unsupported", imageFile("image/svg+xml", [0x3c])],
    [
      "the bytes do not match the MIME type",
      imageFile("image/png", [0xff, 0xd8, 0xff]),
    ],
  ])("should avoid every mutation when %s", async (_label, file) => {
    const result = await updateUserAvatar("user-1", file);

    expect({
      result,
      uploadCalls: uploadToR2.mock.calls,
      updateCalls: updateReturning.mock.calls,
      deleteCalls: deleteFromR2.mock.calls,
    }).toEqual({
      result: { success: false, error: "Unsupported image type" },
      uploadCalls: [],
      updateCalls: [],
      deleteCalls: [],
    });
  });

  it("should persist a unique key and remove the prior object when every step succeeds", async () => {
    selectLimit.mockResolvedValue([{ avatarUrl: OLD_URL }]);
    updateReturning.mockResolvedValue([{ id: "user-1" }]);

    const result = await updateUserAvatar("user-1", validPng());

    expect({
      result,
      uploadKey: uploadToR2.mock.calls[0]?.[0],
      updateCalls: updateReturning.mock.calls.length,
      deleteCalls: deleteFromR2.mock.calls,
    }).toEqual({
      result: {
        success: true,
        avatarUrl: NEW_URL,
        cleanup: "complete",
      },
      uploadKey: NEW_KEY,
      updateCalls: 1,
      deleteCalls: [[OLD_KEY]],
    });
  });

  it("should remove the new object and preserve the old one when D1 rejects the update", async () => {
    selectLimit.mockResolvedValue([{ avatarUrl: OLD_URL }]);
    updateReturning.mockRejectedValue(new Error("D1 failed"));

    const result = await updateUserAvatar("user-1", validPng());

    expect({
      result,
      deleteCalls: deleteFromR2.mock.calls,
    }).toEqual({
      result: { success: false, error: "Failed to upload avatar" },
      deleteCalls: [[NEW_KEY]],
    });
  });

  it("should roll back the new object when D1 updates zero rows", async () => {
    selectLimit.mockResolvedValue([{ avatarUrl: OLD_URL }]);
    updateReturning.mockResolvedValue([]);

    const result = await updateUserAvatar("user-1", validPng());

    expect({
      result,
      deleteCalls: deleteFromR2.mock.calls,
    }).toEqual({
      result: { success: false, error: "Failed to upload avatar" },
      deleteCalls: [[NEW_KEY]],
    });
  });

  it("should report the orphaned key when rollback deletion fails", async () => {
    selectLimit.mockResolvedValue([{ avatarUrl: OLD_URL }]);
    updateReturning.mockRejectedValue(new Error("D1 failed"));
    deleteFromR2.mockRejectedValue(new Error("R2 delete failed"));

    const result = await updateUserAvatar("user-1", validPng());

    expect(result).toEqual({
      success: false,
      error: "Failed to upload avatar",
      orphanedKey: NEW_KEY,
    });
  });

  it("should return pending cleanup without failing the new avatar when old deletion fails", async () => {
    selectLimit.mockResolvedValue([{ avatarUrl: OLD_URL }]);
    updateReturning.mockResolvedValue([{ id: "user-1" }]);
    deleteFromR2.mockRejectedValue(new Error("R2 delete failed"));

    const result = await updateUserAvatar("user-1", validPng());

    expect(result).toEqual({
      success: true,
      avatarUrl: NEW_URL,
      cleanup: "pending",
    });
  });

  it("should skip cleanup when the prior image is external", async () => {
    selectLimit.mockResolvedValue([
      { avatarUrl: "https://images.example.com/avatar.png" },
    ]);
    updateReturning.mockResolvedValue([{ id: "user-1" }]);

    const result = await updateUserAvatar("user-1", validPng());

    expect({
      result,
      deleteCalls: deleteFromR2.mock.calls,
    }).toEqual({
      result: {
        success: true,
        avatarUrl: NEW_URL,
        cleanup: "complete",
      },
      deleteCalls: [],
    });
  });
});
