import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained build in .next/standalone (server.js + only the needed node_modules),
  // so the CRM can run on a VPS or a cPanel "Node.js App" without a full npm install.
  output: "standalone",
};

export default nextConfig;
