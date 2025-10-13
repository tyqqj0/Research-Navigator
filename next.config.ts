import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // 忽略 ESLint 和 TypeScript 错误
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 排除 old 目录从构建过程中
  webpack: (config, { isServer }) => {
    // 忽略 old 目录
    config.watchOptions = {
      ignored: /old\/.*/,
    };
    
    // 忽略 old 目录下的所有文件
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    
    return config;
  },
  
  // Next.js 15 已默认启用 App Router，无需配置
};

export default nextConfig;
