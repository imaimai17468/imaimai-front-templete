import {
  createFileRoute,
  redirect,
  useLoaderData,
} from "@tanstack/react-router";
import { Effect } from "effect";
import { ProfilePage } from "@/components/features/profile-page/profile-page";
import { getCurrentUserFn } from "@/gateways/user/user.live";

const ProfileComponent = () => {
  const { user } = useLoaderData({ from: "/profile" });
  return <ProfilePage user={user} />;
};

export const Route = createFileRoute("/profile")({
  // The redirect rides the error channel because that is the channel that
  // stops the pipeline and hands its value to the caller. `runPromise` rejects
  // with that value unwrapped, and the router's `isRedirect` accepts it, so
  // the success type stays the context this route actually produces.
  beforeLoad: async () =>
    await Effect.runPromise(
      Effect.gen(function* resolveProfileContext() {
        const user = yield* Effect.promise(
          async () => await getCurrentUserFn()
        );
        if (user === null) {
          return yield* Effect.fail(redirect({ to: "/login" }));
        }
        return { user };
      })
    ),
  loader: ({ context }) => ({ user: context.user }),
  component: ProfileComponent,
});
