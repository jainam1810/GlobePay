// CSV export.
//
// Deliberately CSV rather than real .xlsx: Excel, Numbers and Sheets all open it
// natively, and a true xlsx writer is ~1MB of dependency to produce a file that
// nobody reads differently. The BOM matters — without it Excel on Windows
// guesses the encoding and mangles any non-ASCII name.

/** Quote a cell so commas, quotes and newlines survive the round trip. */
function cell(value: unknown): string {
    if (value === null || value === undefined) return "";
    const s = String(value);
    // A leading =, +, - or @ is executed as a formula by Excel when the file is
    // opened. Prefix those with a quote so a contractor's name can never run.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
    return [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\r\n");
}

/** Trigger a browser download without touching the DOM permanently. */
export function downloadCsv(filename: string, csv: string) {
    // ﻿ = UTF-8 BOM, so Excel reads accented names correctly.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/** A filename that sorts chronologically and says what it contains. */
export function exportName(scope: string, ext: string) {
    const slug = scope.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "all-clients";
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return `globepay-audit-pack_${slug}_${stamp}.${ext}`;
}
