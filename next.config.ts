import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/social/reel": ["./node_modules/@ffmpeg-installer/linux-x64/ffmpeg"],
  },
};

export default nextConfig;
