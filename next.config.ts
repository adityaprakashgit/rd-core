import type { NextConfig } from "next";

const defaultAllowedDevOrigins = [
  "localhost",
  "127.0.0.1",
  "192.168.29.54",
  "192.168.1.7",
];

const extraAllowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: Array.from(
    new Set([...defaultAllowedDevOrigins, ...extraAllowedDevOrigins]),
  ),
};

export default nextConfig;
