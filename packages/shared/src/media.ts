export const MAX_IMAGE_BYTES = 6_000_000;

export function hasGifSignature(bytes: Uint8Array) {
  const signature = String.fromCharCode(...bytes.slice(0, 6));
  return signature === "GIF87a" || signature === "GIF89a";
}
