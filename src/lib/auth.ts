import { createClient } from "./supabase/client";

export const signInWithGithub = async () => {
	const supabase = createClient();

	const { error } = await supabase.auth.signInWithOAuth({
		provider: "github",
		options: {
			redirectTo: `${window.location.origin}/auth/callback`,
		},
	});

	if (error) {
		console.error("Error signing in with GitHub:", error);
	}
};

export const signOut = async () => {
	const supabase = createClient();

	supabase.auth.signOut();
};
