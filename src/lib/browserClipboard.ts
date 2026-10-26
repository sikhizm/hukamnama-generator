/** Start the clipboard write during the click; promised PNG data supports async canvas rendering. */
export async function copyPngImage(createImage: () => Promise<Blob | null>): Promise<void> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("Image copying is unavailable in this browser. Use Download Image, then attach it in WhatsApp.");
  }
  const png = Promise.resolve().then(createImage).then(file => {
    if (!file || file.type !== "image/png") throw new Error("Could not prepare a PNG image for copying. Use Download Image instead.");
    return file;
  });
  // Handle rendering rejection even if clipboard permissions are denied first.
  void png.catch(() => {});
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}
