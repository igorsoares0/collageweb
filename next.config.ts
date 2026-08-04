import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The legal pages moved to the public marketing site (the `uselayer`
  // project); this deployment is the editor and the app's API. Anything still
  // pointing here — an app build made before SITE_BASE changed, an old link —
  // lands on the real page instead of the Basic Auth prompt.
  //
  // `proxy.ts` keeps these two paths exempt from auth so the redirect itself
  // is reachable; without that they would 401 before ever redirecting.
  async redirects() {
    return [
      {
        source: "/privacy",
        destination: "https://uselayer.online/privacy",
        permanent: true,
      },
      {
        source: "/terms",
        destination: "https://uselayer.online/terms",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
