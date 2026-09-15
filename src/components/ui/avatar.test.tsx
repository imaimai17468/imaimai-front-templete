import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { Avatar, AvatarFallback } from "./avatar";

describe(Avatar, () => {
  it("should render the default size when size is omitted", () => {
    render(
      <Avatar>
        <AvatarFallback>T</AvatarFallback>
      </Avatar>
    );

    const avatar = screen.getByText("T").parentElement;

    expect({
      slot: avatar?.dataset.slot,
      size: avatar?.dataset.size,
      hasDefaultSize: avatar?.classList.contains("size-8"),
    }).toStrictEqual({ slot: "avatar", size: "default", hasDefaultSize: true });
  });

  it("should scale the fallback letter with the box when size is lg", () => {
    render(
      <Avatar size="lg">
        <AvatarFallback>T</AvatarFallback>
      </Avatar>
    );

    const avatar = screen.getByText("T").parentElement;

    expect({
      size: avatar?.dataset.size,
      hasLargeBox: avatar?.classList.contains("size-24"),
      hasLargeText: avatar?.classList.contains("text-2xl"),
    }).toStrictEqual({ size: "lg", hasLargeBox: true, hasLargeText: true });
  });
});
