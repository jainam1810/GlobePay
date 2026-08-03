"use client";
import { WagmiProvider, type State } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProgressProvider } from "@bprogress/next/app";
import { useState } from "react";
import { config } from "@/lib/wagmi";
import { TooltipProvider } from "@/components/ui/overlays";

export default function Providers({ children, initialState }: {
    children: React.ReactNode;
    /** Wallet state recovered from the cookie in the root layout. */
    initialState?: State;
}) {
    const [queryClient] = useState(() => new QueryClient());
    return (
        <WagmiProvider config={config} initialState={initialState}>
            <QueryClientProvider client={queryClient}>
                {/* A hairline at the top of the window whenever a navigation is in
                    flight. App Router transitions can take a beat on a cold route,
                    and without this the UI looks like it ignored the click.

                    shallowRouting keeps it quiet for ?highlight= style updates —
                    those change the current page rather than leaving it, and a
                    progress bar for them is noise.

                    Deliberately not a spinner: this is the one indicator that must
                    never cover content or move layout, because it can fire on any
                    click anywhere in the product. */}
                <ProgressProvider
                    height="2px"
                    color="var(--accent)"
                    options={{ showSpinner: false }}
                    shallowRouting
                >
                    <TooltipProvider>{children}</TooltipProvider>
                </ProgressProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
