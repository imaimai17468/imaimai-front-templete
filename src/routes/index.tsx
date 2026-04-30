import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ClockContainer } from "./-components/Clock/Clock.container";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <div className="space-y-16">
      <h1 className="font-bold text-4xl">Hello World</h1>
      <p className="text-lg">This is a test</p>
      <ClockContainer />
      <Button>Click me</Button>
    </div>
  );
}
