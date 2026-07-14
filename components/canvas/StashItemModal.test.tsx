import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StashItemModal } from "@/components/canvas/StashItemModal";
import { makeStashItem } from "@/tests/helpers/fixtures";

vi.mock("@/lib/image", () => ({
  compressImageFile: vi.fn(async () => "data:image/jpeg;base64,preview"),
}));

describe("StashItemModal", () => {
  it("renders create mode with empty fields", () => {
    render(
      <StashItemModal
        open
        mode="create"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText("New stash item")).toBeInTheDocument();
    expect(screen.getByLabelText("Item name")).toHaveValue("");
    expect(screen.getByLabelText("Link")).toHaveValue("");
    expect(screen.getByLabelText("Notes")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("renders edit mode with initial values and delete action", () => {
    const item = makeStashItem({
      name: "Desk lamp",
      link: "https://example.com/lamp",
      notes: "Warm light",
    });

    render(
      <StashItemModal
        open
        mode="edit"
        initialItem={item}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Edit stash item")).toBeInTheDocument();
    expect(screen.getByLabelText("Item name")).toHaveValue("Desk lamp");
    expect(screen.getByLabelText("Link")).toHaveValue("https://example.com/lamp");
    expect(screen.getByLabelText("Notes")).toHaveValue("Warm light");
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("trims values and calls onSave", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <StashItemModal
        open
        mode="create"
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    await user.type(screen.getByLabelText("Item name"), "  Chair  ");
    await user.type(screen.getByLabelText("Link"), "  https://example.com  ");
    await user.type(screen.getByLabelText("Notes"), "  Soft fabric  ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({
      name: "Chair",
      imageDataUrl: undefined,
      link: "https://example.com",
      notes: "Soft fabric",
    });
  });

  it("calls onClose when cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <StashItemModal
        open
        mode="create"
        onClose={onClose}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("removes an existing image preview", async () => {
    const user = userEvent.setup();
    const item = makeStashItem({
      imageDataUrl: "data:image/jpeg;base64,preview",
    });

    render(
      <StashItemModal
        open
        mode="edit"
        initialItem={item}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByAltText("Preview")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove image" }));
    expect(screen.queryByAltText("Preview")).not.toBeInTheDocument();
    expect(screen.getByText(/Paste image/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Upload file" })
    ).toBeInTheDocument();
  });

  it("accepts a pasted image from the clipboard", async () => {
    const { compressImageFile } = await import("@/lib/image");

    render(
      <StashItemModal
        open
        mode="create"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    const file = new File(["fake-image"], "pasted.png", { type: "image/png" });
    const clipboardData = {
      items: [
        {
          kind: "file",
          type: "image/png",
          getAsFile: () => file,
        },
      ],
      files: [file],
    };

    window.dispatchEvent(
      new Event("paste", { bubbles: true, cancelable: true })
    );
    // jsdom ClipboardEvent support is limited; drive the listener path directly.
    const pasteEvent = new Event("paste", {
      bubbles: true,
      cancelable: true,
    }) as ClipboardEvent;
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: clipboardData,
    });
    window.dispatchEvent(pasteEvent);

    expect(compressImageFile).toHaveBeenCalledWith(file);
    expect(await screen.findByAltText("Preview")).toBeInTheDocument();
  });
});
