import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Option } from "effect";
import { Camera, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

// similarity-ignore: コンポーネント固有の Props 契約。構造が `{ user }` と偶然一致するが責務は別。
interface ProfileFormProps {
  user: UserWithEmail;
}

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

export const ProfileForm = ({ user }: ProfileFormProps) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState(() => Option.none<string>());
  const [pendingFile, setPendingFile] = useState(() => Option.none<File>());

  // Object URL(外部リソース)の解放を表示中の previewUrl に同期する。
  // 差し替え時は古い URL の cleanup が走り、アンマウント時も解放される。
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

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    // Same two reasons the server distinguishes, so the message matches what
    // actually went wrong rather than blaming size for an empty file.
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
    // `submitProfile` folds a rejection the server shaped into `outcome`, so
    // what reaches here is the call never completing.
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
            <button
              type="button"
              onClick={handleAvatarClick}
              className="absolute right-0 bottom-0 cursor-pointer rounded-full border bg-primary p-2 text-primary-foreground transition-transform hover:scale-110"
              disabled={isPending}
              aria-label="Change profile image"
            >
              <Camera className="size-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={isPending}
            />
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
