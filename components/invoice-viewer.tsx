"use client";
// The invoice, in place, next to the fields read out of it.
//
// The job is comparison: does the wallet on the page match the wallet in the
// box. Sending the reviewer to a new tab hides the half they are comparing
// against, and downloading it hides both — so the document opens here, beside
// the form, and stays there while the fields are corrected.
//
// PDFs render through the browser's own viewer in an <iframe>, which is the one
// PDF engine already installed, already accessible, and already able to search
// and print. Images get a plain <img> with the same zoom controls, so both kinds
// of document behave identically to the person reviewing them.
import { useState } from "react";
import { Maximize2, RotateCw, ZoomIn, ZoomOut } from "lucide-react";

const STEPS = [0.75, 1, 1.25, 1.5, 2, 3];

export default function InvoiceViewer({ url, name, type }: {
    url: string;
    name: string;
    type: string | null;
}) {
    const [zoomIdx, setZoomIdx] = useState(1);   // start at 100%
    const [rotation, setRotation] = useState(0);
    const zoom = STEPS[zoomIdx];
    const isPdf = (type ?? "").includes("pdf") || name.toLowerCase().endsWith(".pdf");

    const btn =
        "grid h-7 w-7 place-items-center rounded-md border border-[var(--border)] text-[var(--text-dim)] transition hover:border-[var(--border-strong)] hover:text-[var(--text)] disabled:opacity-40 disabled:hover:border-[var(--border)]";

    return (
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
                <span className="min-w-0 truncate text-[12px] text-[var(--text-dim)]">{name}</span>
                <div className="flex items-center gap-1.5">
                    <button onClick={() => setZoomIdx((i) => Math.max(0, i - 1))} disabled={zoomIdx === 0}
                        className={btn} aria-label="Zoom out" title="Zoom out">
                        <ZoomOut size={13} />
                    </button>
                    <span className="w-10 text-center font-mono text-[11px] text-[var(--text-faint)]">
                        {Math.round(zoom * 100)}%
                    </span>
                    <button onClick={() => setZoomIdx((i) => Math.min(STEPS.length - 1, i + 1))} disabled={zoomIdx === STEPS.length - 1}
                        className={btn} aria-label="Zoom in" title="Zoom in">
                        <ZoomIn size={13} />
                    </button>
                    {/* Photographed invoices arrive sideways more often than you
                        would think, and a reviewer should not have to tilt. */}
                    {!isPdf && (
                        <button onClick={() => setRotation((r) => (r + 90) % 360)} className={btn}
                            aria-label="Rotate" title="Rotate">
                            <RotateCw size={13} />
                        </button>
                    )}
                    <a href={url} target="_blank" rel="noopener noreferrer" className={btn}
                        aria-label="Open full size" title="Open full size">
                        <Maximize2 size={13} />
                    </a>
                </div>
            </div>

            {/* Fixed height with its own scroll: the card must not grow to the
                length of a document, or the fields you are comparing against
                scroll off the screen. */}
            <div className="h-[460px] overflow-auto bg-[#1a1a1a]">
                {isPdf ? (
                    <iframe
                        // The browser's own PDF viewer. #view=FitH opens fitted to
                        // width, which is the reading most invoices want.
                        src={`${url}#view=FitH&toolbar=0`}
                        title={name}
                        className="border-0"
                        style={{
                            width: `${100 * zoom}%`,
                            height: `${460 * zoom}px`,
                            // Zooming an iframe by scaling would blur the text it
                            // renders; giving it more space re-lays it out sharp.
                        }}
                    />
                ) : (
                    <div className="grid min-h-full place-items-center p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={url}
                            alt={name}
                            style={{
                                width: `${zoom * 100}%`,
                                transform: `rotate(${rotation}deg)`,
                                transition: "transform .2s ease",
                            }}
                            className="max-w-none"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
