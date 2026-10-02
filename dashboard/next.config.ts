import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/monitering",
        destination: "/monitoring",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
