import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StashItemPlaceholderModal } from "@/components/canvas/StashItemPlaceholderModal";

describe("StashItemPlaceholderModal", () => {
  it("renders the placeholder copy and canvas position", () => {
    render(
      <StashItemPlaceholderModal
        open
        position={{ x: 120.4, y: 80.6 }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("New stash item")).toBeInTheDocument();
    expect(
      screen.getByText(/Item details form coming in the next milestone/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/x 120, y 81/)).toBeInTheDocument();
  });

  it("calls onClose when cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <StashItemPlaceholderModal
        open
        position={{ x: 0, y: 0 }}
        onClose={onClose}
      />
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
