// Fetches rate from fawazahmed0/currency-api via jsDelivr CDN.
// Returns the rate (base→target) on the given date, or null if unavailable.
// Historical data is available back to ~2023; older dates fall back to "latest".

export async function getFxRate(
    base: string,
    target: string,
    date: string | "latest",
): Promise<number | null> {
    const b = base.toLowerCase();
    const t = target.toLowerCase();
    if (b === t) return 1;

    const segment = date === "latest" ? "latest" : date;
    const primary = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${segment}/v1/currencies/${b}.json`;
    const fallback = `https://${segment}.currency-api.pages.dev/v1/currencies/${b}.json`;

    for (const url of [primary, fallback]) {
        try {
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) continue;
            const data = await res.json();
            const rate = data?.[b]?.[t];
            if (typeof rate === "number") return rate;
        } catch {
            // try the next URL
        }
    }
    return null;
}