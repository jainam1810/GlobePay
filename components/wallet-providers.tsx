"use client";
// Wagmi, mounted only where a wallet is actually used.
//
// Kept out of the root layout on purpose. `initialState` has to come from the
// cookie, reading the cookie means headers(), and headers() at the root turns
// every page in the app dynamic — including the marketing pages, which have no
// wallet on them at all. The routes that mount this are already dynamic because
// they read a session, so nothing is lost by putting it here.
//
// The cookie is what makes a connection survive a tab being closed, and passing
// it as initialState is what stops the first paint saying "not connected"
// before hydration corrects it.
import { WagmiProvider, type State } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { config } from "@/lib/wagmi";

export default function WalletProviders({ children, initialState }: {
    children: React.ReactNode;
    initialState?: State;
}) {
    // One client per mount, created lazily so it is never shared between
    // requests on the server.
    const [queryClient] = useState(() => new QueryClient());
    return (
        <WagmiProvider config={config} initialState={initialState}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </WagmiProvider>
    );
}
