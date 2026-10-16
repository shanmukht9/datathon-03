/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Exclude script files from the main Next.js build
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
