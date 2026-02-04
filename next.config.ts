import type { NextConfig } from "next";
import { withLingo } from "@lingo.dev/compiler/next";

const nextConfig: NextConfig = {
  // Suppress hydration warnings from lingo compiler during development
  reactStrictMode: true,
};

export default async function (): Promise<NextConfig> {
  return await withLingo(nextConfig, {
    sourceRoot: "./app",
    sourceLocale: "en",
    targetLocales: ["es", "hi", "fr", "de", "ja", "zh"],
    models: "lingo.dev",
    dev: {
      // Use pseudotranslator in development for fast iteration
      // Set to false to use real translations in development
      usePseudotranslator: false,
    },
  });
}
