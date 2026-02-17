import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {},
  serverExternalPackages: ['@tensorflow/tfjs', '@tensorflow-models/face-landmarks-detection', '@tensorflow-models/face-detection'],
};

export default nextConfig;
