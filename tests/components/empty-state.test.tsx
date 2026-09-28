import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";

describe("EmptyState", () => {
  it("states the situation and offers the next action", () => {
    render(
      <EmptyState
        title="No consultants match these filters"
        description="Try removing a filter, or search a different focus area."
        action={<Button>Clear filters</Button>}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "No consultants match these filters" }),
    ).toBeTruthy();
    expect(
      screen.getByText("Try removing a filter, or search a different focus area."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeTruthy();
  });

  it("hides the decorative icon from assistive technology", () => {
    const { container } = render(
      <EmptyState
        icon={<svg data-testid="empty-icon" />}
        title="Nothing here yet"
        description="This list fills up once there is something to show."
      />,
    );

    const iconWrapper = container.querySelector('[aria-hidden="true"]');
    expect(iconWrapper).not.toBeNull();
    expect(iconWrapper?.querySelector('[data-testid="empty-icon"]')).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("merges caller classes and keeps the empty state visible without an action", () => {
    const { container } = render(
      <EmptyState className="mt-8" title="Nothing here yet" description="Nothing to show." />,
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("mt-8");
    expect(root.className).toContain("border-dashed");
  });
});
