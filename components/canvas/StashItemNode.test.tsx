import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StashItemNode } from "@/components/canvas/StashItemNode";
import { makeStashItem } from "@/tests/helpers/fixtures";

vi.mock("@xyflow/react", () => ({
  NodeResizer: () => null,
}));

describe("StashItemNode", () => {
  it("renders the item name and notes", () => {
    const item = makeStashItem({
      name: "Ceramic mug",
      notes: "Handmade",
      link: undefined,
    });

    render(
      <StashItemNode
        id={item.id}
        type="stashItem"
        selected={false}
        dragging={false}
        zIndex={0}
        isConnectable={false}
        positionAbsoluteX={item.x}
        positionAbsoluteY={item.y}
        data={{
          item,
          onResizeEnd: vi.fn(),
          onResizeStart: vi.fn(),
        }}
      />
    );

    expect(screen.getByText("Ceramic mug")).toBeInTheDocument();
    expect(screen.getByText("Handmade")).toBeInTheDocument();
  });

  it("renders a linked title when a link is present", () => {
    const item = makeStashItem({
      name: "Bookshelf",
      link: "https://example.com/shelf",
    });

    render(
      <StashItemNode
        id={item.id}
        type="stashItem"
        selected={false}
        dragging={false}
        zIndex={0}
        isConnectable={false}
        positionAbsoluteX={item.x}
        positionAbsoluteY={item.y}
        data={{
          item,
          onResizeEnd: vi.fn(),
          onResizeStart: vi.fn(),
        }}
      />
    );

    const link = screen.getByRole("link", { name: /Bookshelf/i });
    expect(link).toHaveAttribute("href", "https://example.com/shelf");
  });

  it("falls back to untitled when name and link are missing", () => {
    const item = makeStashItem({
      name: "",
      link: undefined,
    });

    render(
      <StashItemNode
        id={item.id}
        type="stashItem"
        selected={false}
        dragging={false}
        zIndex={0}
        isConnectable={false}
        positionAbsoluteX={item.x}
        positionAbsoluteY={item.y}
        data={{
          item,
          onResizeEnd: vi.fn(),
          onResizeStart: vi.fn(),
        }}
      />
    );

    expect(screen.getByText("Untitled item")).toBeInTheDocument();
  });
});
