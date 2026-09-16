import { Option } from "effect";
import type { UploadAvatarResult } from "./profile-writer";

/**
 * `orphanedKey` leaves the Worker as a nullable and is rebuilt as an `Option` on
 * the client. An `Option` put through `JSON.stringify` arrives as a plain
 * `{_id:"Option"}` object, because `JSON.parse` revives no prototype, so the
 * value would carry none of the module's functions.
 */
export const toWire = (result: UploadAvatarResult) => {
  if (result.status === "uploaded") {
    return result;
  }
  return { ...result, orphanedKey: Option.getOrNull(result.orphanedKey) };
};

export const fromWire = (
  wire: ReturnType<typeof toWire>
): UploadAvatarResult => {
  if (wire.status === "uploaded") {
    return wire;
  }
  return { ...wire, orphanedKey: Option.fromNullOr(wire.orphanedKey) };
};
