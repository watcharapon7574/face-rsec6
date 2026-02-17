import type { NextConfig } from "next";
import { execSync } from "child_process";

let gitHash = "";
try {
  gitHash = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  gitHash = "dev";
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {},
  serverExternalPackages: ['@tensorflow/tfjs', '@tensorflow-models/face-landmarks-detection', '@tensorflow-models/face-detection'],
  env: {
    NEXT_PUBLIC_APP_VERSION: `${require("./package.json").version}-${gitHash}`,
  },
};

export default nextConfig;
