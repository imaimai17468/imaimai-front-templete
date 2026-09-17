import {
  createFileRoute,
  redirect,
  useLoaderData,
} from "@tanstack/react-router";
import { Effect, Option } from "effect";
import { ProfilePage } from "@/components/features/profile-page/profile-page";
import { getCurrentUserFn } from "@/gateways/user/read.fn";

const ProfileComponent = () => {
  const { user } = useLoaderData({ from: "/profile" });
  return <ProfilePage user={user} />;
};

export const Route = createFileRoute("/profile")({
  // The redirect rides the error channel because that is the channel that
  // stops the pipeline and hands its value to the caller. `runPromise` rejects
  // with that value unwrapped, and the router's `isRedirect` accepts it, so
  // the success type stays the context this route actually produces.
  beforeLoad: () =>
    Effect.runPromise(
      Effect.gen(function* resolveProfileContext() {
        const user = Option.fromNullOr(
          yield* Effect.promise(() => getCurrentUserFn())
        );
        if (Option.isNone(user)) {
          return yield* Effect.fail(redirect({ to: "/login" }));
        }
        return { user: user.value };
      })
    ),
  loader: ({ context }) => ({ user: context.user }),
  component: ProfileComponent,
});
