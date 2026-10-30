/** Start the clipboard write during the click; promised PNG data supports async canvas rendering. */
export async function copyPngImage(createImage: () => Promise<Blob | null>): Promise<void> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("Image copying is unavailable in this browser. Use Share Image, or save with the PNG/JPG buttons below.");
  }
  const png = Promise.resolve().then(createImage).then(file => {
    if (!file || file.type !== "image/png") throw new Error("Could not prepare a PNG image for copying. Use Share Image or the PNG/JPG buttons below.");
    return file;
  });
  // Handle rendering rejection even if clipboard permissions are denied first.
  void png.catch(() => {});
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}
