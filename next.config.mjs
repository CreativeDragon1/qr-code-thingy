/** @type {import('next').NextConfig} */
const nextConfig = {
  // The email route reads these off disk at runtime. Next's bundle tracer cannot
  // see them, so they must be force-included or the deployed function 404s on them.
  outputFileTracingIncludes: {
    "/api/send-ticket": ["./emails/**", "./public/logo.png"],
  },
};

export default nextConfig;
