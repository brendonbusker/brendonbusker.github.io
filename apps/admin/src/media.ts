import { hasGifSignature, MAX_IMAGE_BYTES } from "@brendon/shared";

export async function optimizeImage(file: File, maxDimension = 2000) {
  const signature = new Uint8Array(await file.slice(0, 6).arrayBuffer());
  if (hasGifSignature(signature)) {
    if (file.size > MAX_IMAGE_BYTES)
      throw new Error(
        "GIF must be smaller than 6 MB. Choose a smaller GIF to preserve its animation.",
      );
    // Canvas conversion would keep only one frame. Preserve every frame and its timing.
    return new File([file], `${file.name.replace(/\.[^.]+$/, "")}.gif`, {
      type: "image/gif",
    });
  }
  if (file.type === "image/gif" || /\.gif$/i.test(file.name))
    throw new Error("The selected file is not a valid GIF.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    maxDimension / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value ? resolve(value) : reject(new Error("Image conversion failed.")),
      "image/webp",
      0.84,
    ),
  );
  return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
    type: "image/webp",
  });
}
