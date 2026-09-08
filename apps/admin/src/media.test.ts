import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { optimizeImage } from "./media";
import { MAX_IMAGE_BYTES } from "@brendon/shared";

const gif = readFileSync(
  new URL("../../../tests/fixtures/animated.gif", import.meta.url),
);

describe("animated image uploads", () => {
  it("preserves GIF bytes, frame timing and looping without canvas conversion", async () => {
    // Node has no canvas or createImageBitmap; a GIF must never reach those APIs.
    const result = await optimizeImage(
      new File([gif], "animation.GIF", { type: "image/gif" }),
    );
    expect(result.name).toBe("animation.gif");
    expect(result.type).toBe("image/gif");
    expect(Buffer.from(await result.arrayBuffer())).toEqual(gif);
  });
  it("recognizes GIF data even when browser MIME metadata is missing", async () => {
    const result = await optimizeImage(new File([gif], "animation"));
    expect(result.type).toBe("image/gif");
    expect(result.name).toBe("animation.gif");
    expect(Buffer.from(await result.arrayBuffer())).toEqual(gif);
  });
  it("rejects oversized GIFs and files merely named GIF", async () => {
    const oversized = new File(
      [gif, new Uint8Array(MAX_IMAGE_BYTES)],
      "large.gif",
      { type: "image/gif" },
    );
    await expect(optimizeImage(oversized)).rejects.toThrow("smaller than 6 MB");
    await expect(
      optimizeImage(
        new File(["<html>Not an image</html>"], "fake.gif", {
          type: "image/gif",
        }),
      ),
    ).rejects.toThrow("not a valid GIF");
  });
});
