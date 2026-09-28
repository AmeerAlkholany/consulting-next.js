import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";

/**
 * Assertions use plain Vitest matchers plus DOM properties: the project does
 * not depend on @testing-library/jest-dom.
 */
describe("Button", () => {
  it("renders an accessible button that defaults to type=button", () => {
    render(<Button>Save changes</Button>);
    const button = screen.getByRole("button", { name: "Save changes" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
  });

  it("applies the variant and size classes", () => {
    render(
      <Button variant="destructive" size="lg">
        Delete account
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Delete account" });
    expect(button.className).toContain("bg-danger");
    expect(button.className).toContain("h-12");
  });

  it("meets the 44px minimum tap target in its default and icon sizes", () => {
    const { rerender } = render(<Button>Default</Button>);
    expect(screen.getByRole("button").className).toContain("h-11");

    rerender(
      <Button size="icon" aria-label="Close">
        x
      </Button>,
    );
    const iconButton = screen.getByRole("button", { name: "Close" });
    expect(iconButton.className).toContain("h-11");
    expect(iconButton.className).toContain("w-11");
  });

  it("is operable from the keyboard", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Confirm</Button>);

    await user.tab();
    const button = screen.getByRole("button", { name: "Confirm" });
    expect(document.activeElement).toBe(button);

    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);

    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("does not fire when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Saving
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Saving" });
    expect((button as HTMLButtonElement).disabled).toBe(true);

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders as the child element when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/consultants">Find a consultant</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Find a consultant" });
    expect(link.getAttribute("href")).toBe("/consultants");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("lets caller classes win the Tailwind conflict", () => {
    render(<Button className="bg-success">Overridden</Button>);
    const button = screen.getByRole("button", { name: "Overridden" });
    expect(button.className).toContain("bg-success");
    expect(button.className).not.toContain("bg-primary ");
  });
});
