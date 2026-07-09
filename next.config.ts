import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Tells Next.js to skip parsing this package for Server Components
  serverExternalPackages: ['@huggingface/transformers'],
  
  webpack: (config) => {
    // Ignore node-specific modules when bundling for the browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };

    // Prevent Webpack from attempting to bundle Node.js binaries
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    };

    return config;
  },
};

export default nextConfig;