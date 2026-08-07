"use client";
import { ProgressProvider } from "@bprogress/next/app";
import { TooltipProvider } from "@/components/ui/overlays";

/**
 * What every page needs, wallet or no wallet.
 *
 * Wagmi deliberately is not here. Reading the wallet cookie for its initial
 * state means calling headers(), and headers() in the *root* layout opts every
 * route in the app into dynamic rendering — which is exactly what happened: the
 * marketing pages and /login, all previously static, started being server
 * rendered on every request for state they never use. It lives in
 * WalletProviders instead, mounted only by the routes that connect a wallet,
 * which were already dynamic because they read a session.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        // A hairline at the top of the window whenever a navigation is in
        // flight. App Router transitions can take a beat on a cold route, and
        // without this the UI looks like it ignored the click.
        //
        // shallowRouting keeps it quiet for ?highlight= style updates — those
        // change the current page rather than leaving it, and a progress bar for
        // them is noise.
        //
        // Deliberately not a spinner: this is the one indicator that must never
        // cover content or move layout, because it can fire on any click
        // anywhere in the product.
        <ProgressProvider
            height="2px"
            color="var(--accent)"
            options={{ showSpinner: false }}
            shallowRouting
        >
            <TooltipProvider>{children}</TooltipProvider>
        </ProgressProvider>
    );
}
