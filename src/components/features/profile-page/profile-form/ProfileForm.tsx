"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Loader2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { updateProfile, uploadAvatar } from "@/actions/profile";
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

type ProfileFormProps = {
  user: UserWithEmail;
};

type FormData = z.infer<typeof UpdateUserSchema>;

export const ProfileForm = ({ user }: ProfileFormProps) => {
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(UpdateUserSchema),
    defaultValues: {
      name: user.name || "",
    },
  });

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Please keep file size under 5MB");
      return;
    }

    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const onSubmit = async (data: FormData) => {
    startTransition(async () => {
      if (pendingFile) {
        const avatarData = new globalThis.FormData();
        avatarData.append("avatar", pendingFile);
        const avatarResult = await uploadAvatar(avatarData);
        if (avatarResult.error) {
          toast.error(avatarResult.error);
          return;
        }
        setPendingFile(null);
      }

      const formData = new globalThis.FormData();
      formData.append("name", data.name);

      const result = await updateProfile(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Profile updated successfully");
      }
    });
  };

  const displayName = user.name || "User";
  const avatarUrl = previewUrl || user.avatarUrl;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarUrl || undefined} alt={displayName} />
              <AvatarFallback className="text-2xl">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={handleAvatarClick}
              className="absolute right-0 bottom-0 cursor-pointer rounded-full bg-primary p-2 text-primary-foreground shadow-lg transition-transform hover:scale-110"
              disabled={isPending}
            >
              <Camera className="h-4 w-4" />
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
                Click to change image (max 5MB)
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
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating...
            </>
          ) : (
            "Update Profile"
          )}
        </Button>
      </form>
    </Form>
  );
};
