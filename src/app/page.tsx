import { Button } from "@/components/ui/button";

export default function Home() {
	return (
		<div className="flex h-screen flex-col items-center justify-center">
			<h1 className="font-bold text-4xl">Hello World</h1>
			<p className="text-lg">This is a test</p>
			<Button>Click me</Button>
		</div>
	);
}
