import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Option } from "effect";
import { Camera, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  avatarSizeRejection,
  MAX_AVATAR_BYTES,
} from "@/lib/storage/avatar-validation";
import type { UpdateUser, UserWithEmail } from "@/shared/entities/user";
import { displayName, UpdateUserSchema } from "@/shared/entities/user";
import { currentUserQueryOptions } from "@/shared/gateway/user/read.fn";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { submitProfile } from "./submit-profile";

const SubmitLabel = ({ isPending }: { readonly isPending: boolean }) => {
  if (isPending) {
    return (
      <>
        <Loader2 className="mr-2 size-4 motion-safe:animate-spin" />
        Updating…
      </>
    );
  }
  return <>Update Profile</>;
};

export const ProfileForm = ({ user }: { readonly user: UserWithEmail }) => {
  const queryClient = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState(() => Option.none<string>());
  const [pendingFile, setPendingFile] = useState(() => Option.none<File>());

  // Object URL(外部リソース)の解放を表示中の previewUrl に同期する。
  useEffect(
    () => () => {
      if (Option.isSome(previewUrl)) {
        URL.revokeObjectURL(previewUrl.value);
      }
    },
    [previewUrl]
  );

  const form = useForm<UpdateUser>({
    defaultValues: {
      name: Option.getOrElse(Option.fromNullOr(user.name), () => ""),
    },
    resolver: standardSchemaResolver(UpdateUserSchema),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    // 選択は pendingFile が持つので、同じファイルを選び直しても change が届く。
    e.target.value = "";

    const rejection = avatarSizeRejection(file.size);
    if (Option.isSome(rejection)) {
      const reason = rejection.value;
      switch (reason) {
        case "empty": {
          toast.error("That file is empty. Please select another one.");
          return;
        }
        case "too-large": {
          toast.error(
            `Please keep file size under ${MAX_AVATAR_BYTES / 1024 / 1024}MB`
          );
          return;
        }
        default: {
          reason satisfies never;
          return;
        }
      }
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setPendingFile(Option.some(file));
    setPreviewUrl(Option.some(nextPreviewUrl));
  };

  const { mutate: saveProfile, isPending } = useMutation({
    mutationFn: (data: UpdateUser) => submitProfile(data, pendingFile),
    onError: () => {
      toast.error("Could not save your profile. Please try again.");
    },
    onSuccess: ({ avatarUploaded, outcome }) => {
      if (avatarUploaded) {
        setPendingFile(Option.none());
      }
      if (outcome.status === "failed") {
        toast.error(outcome.message);
      } else {
        toast.success("Profile updated successfully");
      }
      // A stored avatar followed by a failed name write still changed the row
      // this reads, so the refetch is not conditional on the outcome.
      return queryClient.invalidateQueries(currentUserQueryOptions());
    },
  });

  const onSubmit = (data: UpdateUser) => {
    saveProfile(data);
  };

  const name = displayName(Option.fromNullOr(user.name));
  const avatarUrl = Option.orElse(previewUrl, () =>
    Option.fromNullOr(user.avatarUrl)
  );

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          void form.handleSubmit(onSubmit)(e);
        }}
        className="flex flex-col gap-6"
      >
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar size="lg">
              <AvatarImage src={Option.getOrUndefined(avatarUrl)} alt={name} />
              <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <label className="absolute right-0 bottom-0 cursor-pointer rounded-full border bg-primary p-2 text-primary-foreground transition-transform before:absolute before:-inset-1.5 hover:scale-110 active:scale-100 has-focus-visible:ring-2 has-focus-visible:ring-ring has-disabled:pointer-events-none has-disabled:opacity-50">
              <Camera className="size-4" />
              <span className="sr-only">Change profile image</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileChange}
                disabled={isPending}
              />
            </label>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <div>
              <p className="text-sm font-medium">Profile Image</p>
              <p className="text-sm text-muted-foreground">
                {`Click to change image (max ${MAX_AVATAR_BYTES / 1024 / 1024}MB)`}
              </p>
            </div>
            {Option.isSome(pendingFile) && (
              <p className="text-xs text-muted-foreground">
                New image selected. Click &quot;Update Profile&quot; to save.
              </p>
            )}
          </div>
        </div>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your name"
                  {...field}
                  disabled={isPending}
                />
              </FormControl>
              <FormDescription>
                The name displayed on your profile
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={isPending}
          className="w-full cursor-pointer"
        >
          <SubmitLabel isPending={isPending} />
        </Button>
      </form>
    </Form>
  );
};
