import { http, createConfig, type CreateConnectorFn } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected, safe, walletConnect } from "wagmi/connectors";

// How a client company connects their treasury wallet, in the order we offer it:
//
//  1. safe()          — only live when GlobePay is loaded *inside* the Safe UI
//                       as a Safe App. Auto-connects; unavailable elsewhere.
//  2. walletConnect() — the main flow: the client stays on globepay.com and
//                       connects their Safe (or any wallet) by scanning a QR /
//                       approving in the Safe app. Needs a free projectId.
//  3. injected()      — a browser extension like MetaMask, for solo operators
//                       who don't run a multisig.
//
// walletConnect is skipped entirely when no projectId is configured, so the app
// still builds and runs without one.
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const connectors: CreateConnectorFn[] = [
    safe({
        // getInfo() never resolves outside the Safe iframe, so cap the wait
        // rather than hanging the connect UI for normal browser users.
        unstable_getInfoTimeout: 500,
    }),
];

if (projectId) {
    connectors.push(
        walletConnect({
            projectId,
            showQrModal: true,
            metadata: {
                name: "GlobePay",
                description: "Pay all your global freelancers in USDC in one transaction, from your own wallet.",
                url: process.env.NEXT_PUBLIC_APP_URL || "https://globepay.local",
                icons: [`${process.env.NEXT_PUBLIC_APP_URL || ""}/globepay-icon.svg`],
            },
        }),
    );
}

connectors.push(injected());

export const config = createConfig({
    chains: [baseSepolia],
    connectors,
    transports: {
        // optional dedicated RPC for reliability; falls back to the public endpoint
        [baseSepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
    },
    ssr: true,
});
