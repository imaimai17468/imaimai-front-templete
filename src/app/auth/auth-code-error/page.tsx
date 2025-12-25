import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AuthCodeErrorPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h1 className="font-semibold text-2xl">Authentication Error</h1>
        <p className="max-w-md text-center text-muted-foreground">
          An error occurred during authentication.
          <br />
          Please try again.
        </p>
      </div>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/login">Go to Login</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Return to Home</Link>
        </Button>
      </div>
    </div>
  );
}
