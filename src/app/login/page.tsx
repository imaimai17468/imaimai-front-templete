"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { signInWithGithub, signInWithGoogle } from "@/lib/auth";

export default function Home() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-8">
      <p>message</p>
      <div className="flex flex-col gap-4">
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          onClick={signInWithGithub}
        >
          <Image
            src="/github-mark-white.svg"
            alt="Github"
            width={20}
            height={20}
          />
          Sign in With Github
        </Button>
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
