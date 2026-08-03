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
import { Tooltip } from "@/components/ui/overlays";

type FlagComponent = React.ComponentType<React.SVGProps<SVGSVGElement> & { title?: string }>;

export default function Flag({ country, className = "", size = 14, label = true }: {
    /** Full country name as stored on the record, e.g. "Nigeria". */
    country?: string | null;
    className?: string;
    size?: number;
    /**
     * Name the country on hover. On by default: a flag is a picture, and a
     * picture of a flag most people can't name is a worse label than no label.
     * Pass false where the name is already written immediately beside it.
     */
    label?: boolean;
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

    const svg = (
        <Svg
            // Decoration when the country is written beside it; when it isn't,
            // the wrapper below supplies the accessible name instead.
            aria-hidden
            className={`inline-block shrink-0 rounded-[2px] align-[-0.1em] ${className}`}
            style={{ width: size, height: size * (2 / 3) }}
        />
    );

    if (!label || !country) return svg;

    return (
        <Tooltip content={country}>
            {/* The tooltip needs a focusable, hoverable box of its own — an SVG
                with aria-hidden is neither. tabIndex 0 also means a keyboard can
                reach the name, not just a pointer. */}
            <span
                tabIndex={0}
                role="img"
                aria-label={country}
                className="inline-flex shrink-0 cursor-help rounded-[2px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
                {svg}
            </span>
        </Tooltip>
    );
}
