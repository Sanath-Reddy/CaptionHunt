import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Required for @huggingface/transformers (Node.js WASM)
  serverExternalPackages: ['@huggingface/transformers'],

  // Allow YouTube and other image domains
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'yt3.ggpht.com' },
      { protocol: 'https', hostname: 'yt3.googleusercontent.com' },
    ],
  },

  // Empty turbopack config to silence Turbopack warning
  turbopack: {},
};

export default nextConfig;
