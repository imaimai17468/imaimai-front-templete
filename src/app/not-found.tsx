import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
	return (
		<div className="flex h-screen flex-col items-center justify-center gap-6">
			<div className="flex flex-col items-center gap-4">
				<FileQuestion className="h-16 w-16 text-muted-foreground" />
				<h1 className="font-bold text-6xl">404</h1>
				<h2 className="font-semibold text-2xl">ページが見つかりません</h2>
				<p className="max-w-md text-center text-muted-foreground">
					お探しのページは存在しないか、移動した可能性があります。
				</p>
			</div>
			<Button asChild>
				<Link href="/">ホームへ戻る</Link>
			</Button>
		</div>
	);
}
