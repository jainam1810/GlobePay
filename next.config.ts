import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Safe{Wallet} fetches /manifest.json (and the icon it points at) from its own
  // origin before it will accept GlobePay as a Safe App, so both need CORS.
  // Everything else stays same-origin.
  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
      {
        source: "/globepay-icon.svg",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};

export default nextConfig;
