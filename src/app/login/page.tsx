"use client";

import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/auth";

export default function Home() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-8">
      <p>message</p>
      <div className="flex flex-col gap-4">
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          onClick={signInWithGoogle}
        >
          Sign in With Google
        </Button>
      </div>
    </div>
  );
}
