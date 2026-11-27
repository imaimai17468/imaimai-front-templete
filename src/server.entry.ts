import startEntry, {
  createServerEntry,
} from "@tanstack/react-start/server-entry";
import { serveAvatar } from "@/shared/gateway/user/avatar/read";
import { dispatchToTarget } from "./server-dispatch.ts";

export default createServerEntry({
  fetch: dispatchToTarget({ avatar: serveAvatar, start: startEntry.fetch }),
});
