import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // packages/engine ships TypeScript source with no build step (CLAUDE.md:
  // zero runtime dependencies, no bundling step required for a dependency-free
  // package), so Next must transpile it itself rather than treat it as
  // pre-built node_modules code.
  transpilePackages: ["@undertone/engine"],
  // The engine's own source imports use NodeNext-style explicit ".js"
  // specifiers that point at sibling ".ts" files (e.g. "./mask.js" ->
  // mask.ts) — valid TypeScript, but the bundler's resolver needs to be told
  // ".js" may also resolve to ".ts"/".tsx" to follow them.
  webpack(config) {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
