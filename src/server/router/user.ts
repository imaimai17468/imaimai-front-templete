import { os } from "@orpc/server";
import { withUser } from "./middleware";

export const current = os.use(withUser).handler(({ context }) => context.user);
