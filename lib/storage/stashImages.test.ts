import { describe, expect, it } from "vitest";
import {
  dataUrlToBlob,
  isDataUrl,
} from "@/lib/storage/stashImages";

describe("stashImages", () => {
  it("detects data URLs", () => {
    expect(isDataUrl("data:image/jpeg;base64,abc")).toBe(true);
    expect(isDataUrl("https://example.com/x.jpg")).toBe(false);
    expect(isDataUrl(undefined)).toBe(false);
  });

  it("converts a data URL to a blob with the right extension", () => {
    // 1x1 red JPEG
    const dataUrl =
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z";

    const { blob, ext } = dataUrlToBlob(dataUrl);
    expect(ext).toBe("jpg");
    expect(blob.type).toBe("image/jpeg");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("maps png/webp mime types to extensions", () => {
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    expect(dataUrlToBlob(png).ext).toBe("png");

    const webp = "data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=";
    expect(dataUrlToBlob(webp).ext).toBe("webp");
  });
});
