import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Camera, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
import type { UpdateUser, UserWithEmail } from "@/entities/user";
import { UpdateUserSchema } from "@/entities/user";
import {
  avatarSizeRejection,
  MAX_AVATAR_BYTES,
} from "@/lib/storage/avatar-validation";
import { updateProfileFn, uploadAvatarFn } from "@/server/fn/profile";

// similarity-ignore: コンポーネント固有の Props 契約。構造が `{ user }` と偶然一致するが責務は別。
interface ProfileFormProps {
  user: UserWithEmail;
}

export const ProfileForm = ({ user }: ProfileFormProps) => {
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Object URL(外部リソース)の解放を表示中の previewUrl に同期する。
  // 差し替え時は古い URL の cleanup が走り、アンマウント時も解放される。
  useEffect(
    () => () => {
      if (previewUrl !== null) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl]
  );

  const form = useForm<UpdateUser>({
    defaultValues: {
      name: user.name ?? "",
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
    switch (rejection) {
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
      case null: {
        break;
      }
      // A new rejection reason fails to compile here rather than passing
      // silently, because it has no `never` to widen into.
      default: {
        const unhandled: never = rejection;
        throw new Error(`Unhandled avatar rejection: ${String(unhandled)}`);
      }
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setPendingFile(file);
    setPreviewUrl(nextPreviewUrl);
  };

  const onSubmit = (data: UpdateUser) => {
    startTransition(async () => {
      if (pendingFile) {
        const avatarData = new globalThis.FormData();
        avatarData.append("avatar", pendingFile);
        const avatarResult = await uploadAvatarFn({ data: avatarData });
        if (avatarResult.status === "failed") {
          toast.error(avatarResult.message);
          return;
        }
        setPendingFile(null);
      }

      const formData = new globalThis.FormData();
      formData.append("name", data.name);

      const result = await updateProfileFn({ data: formData });
      if (result.status === "failed") {
        toast.error(result.message);
      } else {
        toast.success("Profile updated successfully");
      }
    });
  };

  const displayName =
    user.name === null || user.name === "" ? "User" : user.name;
  const avatarUrl = previewUrl ?? user.avatarUrl;

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
              <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
              <AvatarFallback>
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
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
            {pendingFile && (
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
