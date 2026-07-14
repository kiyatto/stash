import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditableStashName } from "@/components/stash/EditableStashName";

const renameOwnedStash = vi.fn();

vi.mock("@/lib/storage/ownedStashes", () => ({
  renameOwnedStash: (...args: unknown[]) => renameOwnedStash(...args),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({}),
}));

describe("EditableStashName", () => {
  beforeEach(() => {
    renameOwnedStash.mockReset();
  });

  it("shows the stash name and renames on Enter", async () => {
    const user = userEvent.setup();
    renameOwnedStash.mockResolvedValue({
      id: "stash-1",
      name: "Renamed",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      itemCount: 0,
    });

    render(<EditableStashName stashId="stash-1" initialName="My Stash" />);

    await user.click(screen.getByRole("button", { name: "My Stash" }));
    const input = screen.getByRole("textbox", { name: "Stash name" });
    await user.clear(input);
    await user.type(input, "Renamed{Enter}");

    expect(renameOwnedStash).toHaveBeenCalledWith({}, "stash-1", "Renamed");
    expect(
      await screen.findByRole("button", { name: "Renamed" })
    ).toBeInTheDocument();
  });

  it("cancels edits on Escape without saving", async () => {
    const user = userEvent.setup();
    render(<EditableStashName stashId="stash-1" initialName="My Stash" />);

    await user.click(screen.getByRole("button", { name: "My Stash" }));
    const input = screen.getByRole("textbox", { name: "Stash name" });
    await user.clear(input);
    await user.type(input, "Nope{Escape}");

    expect(renameOwnedStash).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "My Stash" })).toBeInTheDocument();
  });
});
