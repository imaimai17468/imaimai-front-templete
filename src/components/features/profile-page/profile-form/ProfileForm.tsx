import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Camera, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { UserWithEmail } from "@/entities/user";
import { UpdateUserSchema } from "@/entities/user";
import {
  avatarSizeRejection,
  MAX_AVATAR_BYTES,
} from "@/lib/storage/avatar-validation";
import { updateProfileFn, uploadAvatarFn } from "@/server/fn/profile";
import { submitProfile } from "./profile-submit";

// similarity-ignore: コンポーネント固有の Props 契約。構造が `{ user }` と偶然一致するが責務は別。
type ProfileFormProps = {
  user: UserWithEmail;
};

type FormData = z.infer<typeof UpdateUserSchema>;

export const ProfileForm = ({ user }: ProfileFormProps) => {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Object URL(外部リソース)の解放を表示中の previewUrl に同期する。
  // 差し替え時は古い URL の cleanup が走り、アンマウント時も解放される。
  useEffect(() => {
    if (previewUrl === null) {
      return undefined;
    }
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const form = useForm<FormData>({
    resolver: zodResolver(UpdateUserSchema),
    defaultValues: {
      name: user.name ?? "",
    },
  });

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Same two reasons the server distinguishes, so the message matches what
    // actually went wrong rather than blaming size for an empty file.
    switch (avatarSizeRejection(file.size)) {
      case "empty":
        toast.error("That file is empty. Please select another one.");
        return;
      case "too-large":
        toast.error(
          `Please keep file size under ${MAX_AVATAR_BYTES / 1024 / 1024}MB`
        );
        return;
      case null:
        break;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setPendingFile(file);
    setPreviewUrl(nextPreviewUrl);
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: FormData) =>
      submitProfile(
        { name: data.name, avatar: pendingFile },
        {
          uploadAvatar: async (body) => uploadAvatarFn({ data: body }),
          updateProfile: async (body) => updateProfileFn({ data: body }),
        }
      ),
    onSuccess: async (outcome) => {
      if (outcome.kind === "failed") {
        toast.error(outcome.message);
        return;
      }
      // Refetch before dropping the preview: `user` arrives from the route
      // loader, so without this the form keeps rendering the pre-save value and
      // the object URL stands in for an avatar that is already stored.
      await router.invalidate();
      setPendingFile(null);
      setPreviewUrl(null);
      toast.success("Profile updated successfully");
    },
    // The validators throw rather than returning `{ error }`, so those paths
    // reject the mutation and never reach onSuccess. The thrown message is not
    // vetted for display, so it is not shown.
    onError: () => {
      toast.error("Something went wrong. Please try again.");
    },
  });

  const onSubmit = (data: FormData) => {
    mutate(data);
  };

  const displayName =
    user.name === null || user.name === "" ? "User" : user.name;
  const avatarUrl = previewUrl ?? user.avatarUrl;

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
        className="space-y-6"
      >
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="size-24">
              <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
              <AvatarFallback className="text-2xl">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={handleAvatarClick}
              className="absolute right-0 bottom-0 cursor-pointer rounded-full border bg-primary p-2 text-primary-foreground transition-transform hover:scale-110"
              disabled={isPending}
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
          <div className="flex-1 space-y-2">
            <div>
              <p className="font-medium text-sm">Profile Image</p>
              <p className="text-muted-foreground text-sm">
                {`Click to change image (max ${MAX_AVATAR_BYTES / 1024 / 1024}MB)`}
              </p>
            </div>
            {pendingFile && (
              <p className="text-muted-foreground text-xs">
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
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 motion-safe:animate-spin" />
              Updating…
            </>
          ) : (
            "Update Profile"
          )}
        </Button>
      </form>
    </Form>
  );
};
