import { execFile } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export function reelArgs(image: string, audio: string, output: string, duration: number) {
  if (!Number.isFinite(duration) || duration < 1 || duration > 60) throw new Error("Use an audio clip between 1 and 60 seconds.");
  return ["-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-i", image, "-i", audio,
    "-t", String(duration), "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x10121b,setsar=1",
    "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-preset", "veryfast", "-tune", "stillimage", "-crf", "24", "-r", "30", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "192k", "-movflags", "+faststart", "-threads", "2", output];
}

export function waveDuration(wav: Uint8Array): number {
  const buffer = Buffer.from(wav);
  let bytesPerSecond = 0, dataBytes = 0;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const tag = buffer.toString("ascii", offset, offset + 4), size = buffer.readUInt32LE(offset + 4);
    if (tag === "fmt " && size >= 16) bytesPerSecond = buffer.readUInt32LE(offset + 16);
    if (tag === "data") dataBytes = Math.min(size, buffer.length - offset - 8);
    offset += 8 + size + (size % 2);
  }
  const seconds = dataBytes / bytesPerSecond;
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 60) throw new Error("Use an audio clip between 1 and 60 seconds.");
  return seconds;
}

export async function renderReel(image: Uint8Array, audio: Uint8Array, duration: number | "full" = "full") {
  if (duration !== "full" && duration !== 10 && duration !== 15) throw new Error("Choose full audio, 10 or 15 seconds.");
  const directory = await mkdtemp(path.join(tmpdir(), "sikhizm-reel-"));
  try {
    const imagePath = path.join(directory, "image.jpg");
    const audioPath = path.join(directory, "audio");
    const normalizedPath = path.join(directory, "audio.wav");
    const outputPath = path.join(directory, "reel.mp4");
    await Promise.all([writeFile(imagePath, image), writeFile(audioPath, audio)]);
    // Included explicitly by Next's file tracing. Treat the executable as a
    // filesystem asset; importing/resolving it makes Turbopack parse it as JS.
    const binary = path.join(process.cwd(), "node_modules", "@ffmpeg-installer", "linux-x64", "ffmpeg");
    const run = (args: string[]) => new Promise<void>((resolve, reject) => execFile(binary, args, { timeout: 100000, maxBuffer: 1000000 }, error => error ? reject(new Error("Could not create the reel. Use a readable audio file and image.")) : resolve()));
    // Decode the recording once to continuous PCM. This discards MP3 packet
    // timing irregularities before the final AAC encode; never loop the chant.
    await run(["-hide_banner", "-loglevel", "error", "-y", "-i", audioPath, "-map", "0:a:0", "-vn", "-t", "61", "-af", "aresample=48000:async=1:first_pts=0", "-ac", "2", "-c:a", "pcm_s16le", normalizedPath]);
    const seconds = waveDuration(await readFile(normalizedPath));
    await run(reelArgs(imagePath, normalizedPath, outputPath, duration === "full" ? seconds : Math.min(duration, seconds)));
    const result = await readFile(outputPath);
    if (result.length > 4000000) throw new Error("The reel exceeds the 4 MB transfer limit. Try 10 seconds or a simpler image.");
    return result;
  } finally { await rm(directory, { recursive: true, force: true }); }
}
