import { execFile } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export function reelArgs(image: string, audio: string, output: string, duration: number) {
  if (duration !== 10 && duration !== 15) throw new Error("Choose 10 or 15 seconds.");
  return ["-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-i", image, "-stream_loop", "-1", "-i", audio,
    "-t", String(duration), "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x10121b,setsar=1",
    "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-preset", "veryfast", "-tune", "stillimage", "-crf", "24", "-r", "30", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-ar", "48000", "-b:a", "128k", "-movflags", "+faststart", "-threads", "2", output];
}

export async function renderReel(image: Uint8Array, audio: Uint8Array, duration: number) {
  const directory = await mkdtemp(path.join(tmpdir(), "sikhizm-reel-"));
  try {
    const imagePath = path.join(directory, "image.jpg");
    const audioPath = path.join(directory, "audio");
    const outputPath = path.join(directory, "reel.mp4");
    await Promise.all([writeFile(imagePath, image), writeFile(audioPath, audio)]);
    // Included explicitly by Next's file tracing. Treat the executable as a
    // filesystem asset; importing/resolving it makes Turbopack parse it as JS.
    const binary = path.join(process.cwd(), "node_modules", "@ffmpeg-installer", "linux-x64", "ffmpeg");
    await new Promise<void>((resolve, reject) => execFile(binary, reelArgs(imagePath, audioPath, outputPath, duration), { timeout: 100000, maxBuffer: 1000000 }, error => error ? reject(new Error("Could not create the reel. Use a readable audio file and image.")) : resolve()));
    const result = await readFile(outputPath);
    if (result.length > 4000000) throw new Error("The reel exceeds the 4 MB transfer limit. Try 10 seconds or a simpler image.");
    return result;
  } finally { await rm(directory, { recursive: true, force: true }); }
}
