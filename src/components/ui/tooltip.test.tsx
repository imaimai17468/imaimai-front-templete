import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

type ProviderOptions = {
  delayDuration?: number;
};

const renderTooltip = (provider: ProviderOptions = {}, className?: string) =>
  render(
    <TooltipProvider {...provider}>
      <Tooltip>
        <TooltipTrigger>保存</TooltipTrigger>
        <TooltipContent className={className}>下書きを保存する</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

const hoverTriggerAndAdvance = (ms: number) => {
  act(() => {
    fireEvent.pointerMove(screen.getByRole("button", { name: "保存" }), {
      pointerType: "mouse",
    });
    vi.advanceTimersByTime(ms);
  });
};

describe(Tooltip, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render the trigger alone when the pointer has not entered it", () => {
    renderTooltip();

    const trigger = screen.getByRole("button", { name: "保存" });

    expect({
      slot: trigger.dataset.slot,
      state: trigger.dataset.state,
      content: screen.queryByRole("tooltip"),
    }).toStrictEqual({
      slot: "tooltip-trigger",
      state: "closed",
      content: null,
    });
  });

  it("should open the content on the tick the pointer enters when delayDuration is omitted", () => {
    vi.useFakeTimers();
    renderTooltip();

    hoverTriggerAndAdvance(0);

    const content = screen.getByRole("tooltip");

    expect({
      slot: content.dataset.slot,
      text: content.textContent,
    }).toStrictEqual({ slot: "tooltip-content", text: "下書きを保存する" });
  });

  it("should leave the content closed when less than the provider's delayDuration has elapsed", () => {
    vi.useFakeTimers();
    renderTooltip({ delayDuration: 700 });

    hoverTriggerAndAdvance(699);

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("should open the content when the provider's delayDuration has elapsed", () => {
    vi.useFakeTimers();
    renderTooltip({ delayDuration: 700 });

    hoverTriggerAndAdvance(700);

    expect(screen.getByRole("tooltip").textContent).toBe("下書きを保存する");
  });

  it("should keep the caller's class when className conflicts with a content class", () => {
    vi.useFakeTimers();
    renderTooltip({}, "rounded-none");

    hoverTriggerAndAdvance(0);

    const content = screen.getByRole("tooltip");

    expect({
      hasCaller: content.classList.contains("rounded-none"),
      hasDefault: content.classList.contains("rounded-md"),
    }).toStrictEqual({ hasCaller: true, hasDefault: false });
  });
});
