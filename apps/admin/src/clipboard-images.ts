// Prefer the original GIF over a clipboard-provided static rendition.
export const IMAGE_TYPES = [
  "image/gif",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
] as const;

export function isSupportedImage(file: File) {
  return (
    IMAGE_TYPES.some((type) => type === file.type) ||
    (!file.type && /\.(gif|png|jpe?g|webp|avif)$/i.test(file.name))
  );
}

export function pastedImageFiles(data: DataTransfer) {
  return Array.from(data.files).filter(isSupportedImage);
}

export async function readClipboardImages(items: ClipboardItem[]) {
  const files: File[] = [];
  for (const item of items) {
    const type = IMAGE_TYPES.find((candidate) =>
      item.types.includes(candidate),
    );
    if (!type) continue;
    const blob = await item.getType(type);
    files.push(
      new File([blob], `pasted-image.${type.split("/")[1]}`, { type }),
    );
  }
  return files;
}
