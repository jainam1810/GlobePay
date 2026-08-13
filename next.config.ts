import type { NextConfig } from "next";

// Origins the browser genuinely needs to reach, measured from a real session
// rather than guessed — every entry below was either observed in the network
// log or traced to the code that calls it.
const origin = (raw?: string) => {
  try { return new URL(raw!).origin; } catch { return ""; }
};

const SUPABASE = origin(process.env.NEXT_PUBLIC_SUPABASE_URL);
const RPC = origin(process.env.NEXT_PUBLIC_RPC_URL);

const connectSrc = [
  "'self'",
  SUPABASE,                          // auth, data, signed attachment URLs
  SUPABASE && SUPABASE.replace("https://", "wss://"),
  RPC,
  "https://sepolia.base.org",        // viem's default when NEXT_PUBLIC_RPC_URL is unset
  // FX rates. Fetched in the browser as well as on the server — see the
  // getFxRate call in payment-history.tsx that prices the network fee.
  "https://cdn.jsdelivr.net",
  "https://*.currency-api.pages.dev",
  // WalletConnect / Reown: wallet discovery, the relay socket, analytics.
  "https://api.web3modal.org",
  "https://*.walletconnect.com",
  "https://*.walletconnect.org",
  "wss://*.walletconnect.com",
  "wss://*.walletconnect.org",
].filter(Boolean).join(" ");

const csp = [
  "default-src 'self'",
  // Next.js inlines its hydration bootstrap, and a nonce would force every page
  // to render dynamically — losing static generation on the marketing pages for
  // a policy that is not this app's main XSS defence anyway. Being straight
  // about it: with 'unsafe-inline' here, CSP is defence in depth against
  // exfiltration and framing, not a guarantee against script injection. What
  // keeps that surface small is that nothing renders raw HTML — there is no
  // dangerouslySetInnerHTML anywhere in the codebase, and the assistant's
  // replies go through react-markdown rather than into innerHTML.
  "script-src 'self' 'unsafe-inline'",
  // Tailwind ships a stylesheet, but React style={{…}} props still need inline.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // data: for the wallet icons announced over EIP-6963; blob: for the generated
  // PDF; https: because a freelancer's avatar can be hosted anywhere.
  "img-src 'self' data: blob: https:",
  `connect-src ${connectSrc}`,
  // Two things get embedded: the WalletConnect QR modal, and an uploaded invoice
  // shown in the browser's own PDF viewer while a reviewer checks it against the
  // fields. The invoice arrives on a signed Supabase Storage URL, so that origin
  // has to be allowed or the frame renders as a blocked-content icon.
  `frame-src 'self' ${SUPABASE} https://*.walletconnect.com https://*.walletconnect.org`,
  // Who may embed *us*. Not DENY: GlobePay is a Safe App and has to load inside
  // app.safe.global. Everyone else is refused, which closes the clickjacking
  // route to the Confirm & pay button.
  "frame-ancestors 'self' https://app.safe.global",
  "object-src 'none'",               // no plugin execution
  "base-uri 'self'",                 // an injected <base> can't retarget every relative URL
  "form-action 'self'",              // a form can't be repointed at an attacker
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Belt and braces with frame-ancestors: older browsers ignore the CSP
  // directive but honour this one. SAMEORIGIN rather than DENY, again for Safe.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Without this, ?q=Akil%20Shaikh and ?highlight=0x… travel to third parties in
  // the Referer header — freelancer names and transaction hashes leaking through
  // nothing more than an outbound link.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here needs a camera, a microphone or a location.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // Ignored on http://localhost; matters the moment this is served over TLS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Stop advertising the framework and its version to anyone scanning.
  poweredByHeader: false,

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Safe{Wallet} fetches /manifest.json (and the icon it points at) from its
      // own origin before it will accept GlobePay as a Safe App, so both need
      // CORS. Everything else stays same-origin.
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
