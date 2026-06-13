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
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Next.js 15 — moved out of experimental
  serverExternalPackages: [
    '@remotion/renderer',
    '@remotion/bundler',
  ],
  // /api/render/run calls @remotion/bundler's bundle() with a dynamic
  // path.resolve(process.cwd(), 'remotion', 'Root.tsx') entry point. Next's
  // file tracer (@vercel/nft) only follows static `import`/`require` calls,
  // so it can't see that this route needs the rest of remotion/** (Root.tsx
  // itself got pulled in incidentally, but compositions/, captions.tsx, and
  // kenburns.ts did not — causing "Module not found" at render time on
  // Vercel). This explicitly includes the whole remotion/ directory in that
  // route's serverless function bundle.
  outputFileTracingIncludes: {
    '/api/render/run': ['./remotion/**/*'],
  },
}

module.exports = nextConfig
