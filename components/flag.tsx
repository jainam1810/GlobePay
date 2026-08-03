"use client";
// A country flag that actually renders.
//
// The obvious implementation — an emoji flag — is broken for most of the people
// who will use this. Windows ships no flag glyphs: Segoe UI Emoji deliberately
// omits the regional-indicator pairs, so Chrome and Edge on Windows draw 🇳🇬 as
// the letters "NG". Firefox is fine only because Mozilla bundles its own set.
// Printing was worse still, since no PDF font has them either, which is why the
// audit pack read "PH Philippines".
//
// So these are real SVGs from country-flag-icons, which look the same on every
// platform and in every PDF. The set is tiny — GlobePay supports nine countries
// — and each flag is inlined at build time rather than fetched.
import * as Flags from "country-flag-icons/react/3x2";
import { codeFor } from "@/lib/contractor-types";

type FlagComponent = React.ComponentType<React.SVGProps<SVGSVGElement> & { title?: string }>;

export default function Flag({ country, className = "", size = 14 }: {
    /** Full country name as stored on the record, e.g. "Nigeria". */
    country?: string | null;
    className?: string;
    size?: number;
}) {
    const code = country ? codeFor(country) : null;
    const Svg = code ? (Flags as unknown as Record<string, FlagComponent>)[code] : undefined;

    // No flag for this country — a neutral placeholder keeps the row's
    // alignment rather than collapsing the column for one record.
    if (!Svg) {
        return (
            <span
                aria-hidden
                className={`inline-block shrink-0 rounded-[2px] bg-[var(--surface-2)] ${className}`}
                style={{ width: size, height: size * (2 / 3) }}
            />
        );
    }

    return (
        <Svg
            // The country is already written next to every flag in this product,
            // so the flag itself is decoration and shouldn't be read out twice.
            aria-hidden
            className={`inline-block shrink-0 rounded-[2px] align-[-0.1em] ${className}`}
            style={{ width: size, height: size * (2 / 3) }}
        />
    );
}
