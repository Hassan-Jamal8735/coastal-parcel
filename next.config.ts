import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Customs signature/logo uploads go through a Server Action. Vercel caps
      // request bodies at 4.5 MB, so stay just under it.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
