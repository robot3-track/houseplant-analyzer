import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@huggingface/transformers'],
  
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };

    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    };

    return config;
  },
};

export default nextConfig;