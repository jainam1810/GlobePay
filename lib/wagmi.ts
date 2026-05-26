import { http, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const config = createConfig({
    chains: [baseSepolia],
    connectors: [injected()],
    transports: {
        // optional dedicated RPC for reliability; falls back to the public endpoint
        [baseSepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
    },
    ssr: true,
});