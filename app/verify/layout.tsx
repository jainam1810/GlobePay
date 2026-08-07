import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import WalletProviders from "@/components/wallet-providers";
import { config } from "@/lib/wagmi";

// /verify is where a freelancer proves a wallet is theirs by signing, so it
// needs wagmi — but it is the only public page that does. Giving it a layout of
// its own keeps the wallet stack off every other public page, which is the
// whole point of not mounting it at the root.
export default async function VerifyLayout({ children }: { children: React.ReactNode }) {
    const walletState = cookieToInitialState(config, (await headers()).get("cookie"));
    return <WalletProviders initialState={walletState}>{children}</WalletProviders>;
}
