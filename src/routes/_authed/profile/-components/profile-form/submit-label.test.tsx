import { describe, expect, it } from "vite-plus/test";
import { render } from "@/test/render";
import { SubmitLabel } from "./submit-label";

const rendered = (isPending: boolean) => {
  const { container } = render(<SubmitLabel isPending={isPending} />);
  return {
    spinnerCount: container.querySelectorAll("svg.motion-safe\\:animate-spin")
      .length,
    text: container.textContent,
  };
};

describe(SubmitLabel, () => {
  it("should show a spinner beside the progress text when isPending is true", () => {
    expect(rendered(true)).toStrictEqual({
      spinnerCount: 1,
      text: "Updating…",
    });
  });

  it("should show the action label alone when isPending is false", () => {
    expect(rendered(false)).toStrictEqual({
      spinnerCount: 0,
      text: "Update Profile",
    });
  });
});
