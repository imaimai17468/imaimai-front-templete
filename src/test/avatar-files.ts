/** The eight bytes a PNG opens with, which the avatar upload checks for. */
export const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A file the avatar upload accepts as a PNG. */
export const pngAvatarFile = (): File =>
  new File([new Uint8Array(PNG_BYTES)], "avatar.png", { type: "image/png" });
