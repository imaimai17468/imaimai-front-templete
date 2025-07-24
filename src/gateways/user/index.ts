import { revalidatePath } from "next/cache";
import {
	type UpdateUser,
	type UserWithEmail,
	UserWithEmailSchema,
} from "@/entities/user";
import { createClient } from "@/lib/supabase/server";

export const fetchCurrentUser = async (): Promise<UserWithEmail | null> => {
	const supabase = await createClient();

	const {
		data: { user: authUser },
	} = await supabase.auth.getUser();

	if (!authUser) {
		return null;
	}

	const { data: profile, error } = await supabase
		.from("users")
		.select("*")
		.eq("id", authUser.id)
		.single();

	if (error || !profile) {
		return null;
	}

	const rawUser = {
		id: profile.id,
		name: profile.name,
		avatarUrl: profile.avatar_url,
		createdAt: profile.created_at,
		updatedAt: profile.updated_at,
		email: authUser.email,
	};

	return UserWithEmailSchema.parse(rawUser);
};

export const updateUser = async (
	userId: string,
	data: UpdateUser,
): Promise<{ success: boolean; error?: string }> => {
	const supabase = await createClient();

	const { error } = await supabase
		.from("users")
		.update({ name: data.name })
		.eq("id", userId);

	if (error) {
		return { success: false, error: "Failed to update profile" };
	}

	revalidatePath("/profile");
	return { success: true };
};

export const updateUserAvatar = async (
	userId: string,
	file: File,
): Promise<{ success: boolean; error?: string; avatarUrl?: string }> => {
	const supabase = await createClient();

	const fileExt = file.name.split(".").pop();
	const fileName = `${userId}/avatar.${fileExt}`;

	const { error: uploadError } = await supabase.storage
		.from("avatars")
		.upload(fileName, file, {
			upsert: true,
		});

	if (uploadError) {
		return { success: false, error: "Failed to upload avatar" };
	}

	const {
		data: { publicUrl },
	} = supabase.storage.from("avatars").getPublicUrl(fileName);

	const { error: updateError } = await supabase
		.from("users")
		.update({ avatar_url: publicUrl })
		.eq("id", userId);

	if (updateError) {
		return { success: false, error: "Failed to update profile" };
	}

	revalidatePath("/profile");
	return { success: true, avatarUrl: publicUrl };
};
