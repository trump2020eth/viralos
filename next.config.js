/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: 'image.pollinations.ai' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.replicate.delivery' },
      { protocol: 'https', hostname: 'ideogram.ai' },
    ],
  },
  // Silence ESLint during builds — run lint separately in CI
  eslint: {
    ignoreDuringBuilds: true,
  },
  // TypeScript errors as warnings in dev, errors in CI
  typescript: {
    ignoreBuildErrors: false,
  },
  // Required for Remotion server-side rendering (uses Node.js APIs)
  experimental: {
    serverComponentsExternalPackages: [
      '@remotion/renderer',
      '@remotion/bundler',
    ],
  },
}

module.exports = nextConfig
