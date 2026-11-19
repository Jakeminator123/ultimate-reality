import type { NextConfig } from "next";
const config: NextConfig = {
  agentRules: false,
  devIndicators: false,
  experimental: { cpus: 4 },
};
export default config;
