// Next.js inlines NEXT_PUBLIC_* at build time, so these resolve in the browser bundle.
export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

export const NEXT_PUBLIC_GEOAPIFY_API_KEY =
  process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY ?? ''
