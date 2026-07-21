import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_IMAGE_BYTES } from "@/lib/types";
import { compressImageFile, mimeToExt } from "@/lib/image";

describe("mimeToExt", () => {
  it("maps known image MIME types", () => {
    expect(mimeToExt("image/png")).toBe("png");
    expect(mimeToExt("image/webp")).toBe("webp");
    expect(mimeToExt("image/gif")).toBe("gif");
    expect(mimeToExt("image/jpeg")).toBe("jpg");
    expect(mimeToExt("application/octet-stream")).toBe("jpg");
  });
});

const JPEG_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";

function mockImage(width: number, height: number) {
  class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = width;
    height = height;

    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }

  vi.stubGlobal(
    "Image",
    MockImage as unknown as { new (): HTMLImageElement }
  );
}

function mockFileReader(result: string) {
  class MockFileReader {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    result = result;

    readAsDataURL() {
      queueMicrotask(() => this.onload?.());
    }
  }

  vi.stubGlobal(
    "FileReader",
    MockFileReader as unknown as { new (): FileReader }
  );
}

describe("compressImageFile", () => {
  beforeEach(() => {
    mockImage(3200, 2400);
    mockFileReader(JPEG_DATA_URL);

    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);

    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(
      (_type, quality) => {
        const size = quality && quality < 0.5 ? 1000 : 3_000_000;
        const padding = "A".repeat(size);
        return `data:image/jpeg;base64,${padding}`;
      }
    );
  });

  it("downscales large images and returns a data URL", async () => {
    const file = new File(["pixels"], "photo.jpg", { type: "image/jpeg" });
    const result = await compressImageFile(file);

    expect(result.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalled();
  });

  it("reduces quality until the output is under MAX_IMAGE_BYTES", async () => {
    const file = new File(["pixels"], "photo.jpg", { type: "image/jpeg" });
    const toDataUrl = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL");

    await compressImageFile(file);

    expect(toDataUrl.mock.calls.length).toBeGreaterThan(1);
    const lastCall = toDataUrl.mock.calls.at(-1);
    expect(lastCall?.[1]).toBeLessThanOrEqual(0.5);
  });

  it("returns the original data URL when canvas context is unavailable", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    const file = new File(["pixels"], "photo.jpg", { type: "image/jpeg" });
    const result = await compressImageFile(file);

    expect(result).toBe(JPEG_DATA_URL);
  });
});

describe("MAX_IMAGE_BYTES", () => {
  it("is set to 2MB for parity with the future server limit", () => {
    expect(MAX_IMAGE_BYTES).toBe(2 * 1024 * 1024);
  });
});
