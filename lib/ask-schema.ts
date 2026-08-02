import {
    startOfMonth, endOfMonth, subMonths,
    startOfQuarter, endOfQuarter, subQuarters,
    startOfYear, endOfYear, subYears,
    startOfDay, endOfDay, parseISO, format,
    isSameMonth, isSameYear, isFirstDayOfMonth, isLastDayOfMonth,
} from "date-fns";

// Natural-language questions about payment history.
//
// The model's ONLY job is to turn a sentence into a filter. It never sees an
// amount, never adds anything up, and never writes a figure — code does all of
// that from the records themselves. A language model asked to sum forty numbers
// will produce a confident, plausible, wrong total, and someone will read it out
// in a board meeting.
//
// Relative periods come back as symbols ("last_year"), not dates, for the same
// reason: date arithmetic is arithmetic. Code resolves them against today.

export type AskMetric = "total" | "count" | "average" | "largest";
export type AskPeriod =
    | "this_month" | "last_month"
    | "this_quarter" | "last_quarter"
    | "this_year" | "last_year"
    | "all_time" | "custom";
export type AskGroupBy = "none" | "country" | "contractor" | "month";

export type AskQuery = {
    metric: AskMetric;
    period: AskPeriod;
    from: string;        // YYYY-MM-DD, only meaningful when period = "custom"
    to: string;
    country: string;     // "" for all
    contractor: string;  // "" for all
    groupBy: AskGroupBy;
    /** Set when the question can't be answered from payment records at all. */
    unanswerable: string;
};

export const askSchema = {
    type: "object",
    properties: {
        metric: {
            type: "string", enum: ["total", "count", "average", "largest"],
            description: "What is being asked for: total money, number of payments, average payment, or the largest one.",
        },
        period: {
            type: "string",
            enum: ["this_month", "last_month", "this_quarter", "last_quarter", "this_year", "last_year", "all_time", "custom"],
            description: "Time range. Use 'custom' ONLY when an explicit date or named month/quarter is given. Default 'all_time' if no period is mentioned.",
        },
        from: { type: "string", description: "Start date YYYY-MM-DD. Only when period is 'custom'. Empty string otherwise." },
        to: { type: "string", description: "End date YYYY-MM-DD, inclusive. Only when period is 'custom'. Empty string otherwise." },
        country: { type: "string", description: "Contractor country in English (Nigeria, Argentina, Philippines). Empty string if not mentioned." },
        contractor: { type: "string", description: "A person's name if one is named. Empty string otherwise." },
        groupBy: {
            type: "string", enum: ["none", "country", "contractor", "month"],
            description: "Set when the question asks for a breakdown, e.g. 'per country' or 'by month'. Otherwise 'none'.",
        },
        unanswerable: {
            type: "string",
            description: "If the question is not about payments made through GlobePay (e.g. tax advice, forecasts, anything needing data we don't hold), explain in one short sentence what can't be answered. Empty string when the question IS answerable.",
        },
    },
    required: ["metric", "period", "from", "to", "country", "contractor", "groupBy", "unanswerable"],
};

/** Calendar day as YYYY-MM-DD, read in local terms. */
const ymd = (d: Date) => format(d, "yyyy-MM-dd");

/**
 * Resolve a symbolic period into a concrete, inclusive date range.
 *
 * Uses date-fns rather than hand-rolled month/quarter arithmetic — the edge
 * cases (Q1 rolling back to Q4 of the previous year, month lengths, DST) are
 * exactly where home-made date maths goes wrong, and a wrong range here means a
 * wrong total in front of a stakeholder.
 *
 * Boundaries are also returned as YYYY-MM-DD strings, and callers filter on
 * those rather than on Date objects. The records carry `invoice_date`, a DATE
 * column, which JavaScript parses as UTC midnight — while startOfMonth() returns
 * *local* midnight. Comparing the two drops a payment made on the 1st of the
 * month in any timezone behind UTC. Comparing calendar days as strings is exact
 * at the granularity we actually filter on, and has no timezone at all.
 */
export function resolvePeriod(period: AskPeriod, from: string, to: string, now = new Date()) {
    const none = { start: null, end: null, label: "all time", startStr: null, endStr: null };

    switch (period) {
        case "this_month":
            return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, "MMMM yyyy"), startStr: ymd(startOfMonth(now)), endStr: ymd(endOfMonth(now)) };
        case "last_month": {
            const d = subMonths(now, 1);
            return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMMM yyyy"), startStr: ymd(startOfMonth(d)), endStr: ymd(endOfMonth(d)) };
        }
        case "this_quarter":
            return { start: startOfQuarter(now), end: endOfQuarter(now), label: format(now, "QQQ yyyy"), startStr: ymd(startOfQuarter(now)), endStr: ymd(endOfQuarter(now)) };
        case "last_quarter": {
            const d = subQuarters(now, 1);
            return { start: startOfQuarter(d), end: endOfQuarter(d), label: format(d, "QQQ yyyy"), startStr: ymd(startOfQuarter(d)), endStr: ymd(endOfQuarter(d)) };
        }
        case "this_year":
            return { start: startOfYear(now), end: endOfYear(now), label: format(now, "yyyy"), startStr: ymd(startOfYear(now)), endStr: ymd(endOfYear(now)) };
        case "last_year": {
            const d = subYears(now, 1);
            return { start: startOfYear(d), end: endOfYear(d), label: format(d, "yyyy"), startStr: ymd(startOfYear(d)), endStr: ymd(endOfYear(d)) };
        }
        case "custom": {
            const s = from ? startOfDay(parseISO(from)) : null;
            const e = to ? endOfDay(parseISO(to)) : null;
            if (s && isNaN(+s)) return none;
            if (e && isNaN(+e)) return none;
            if (s && e) {
                // A range that happens to be exactly one calendar month or year
                // reads far better by name. "July 2026" is what someone asked
                // for; "2026-07-01 to 2026-07-31" is how we stored it.
                if (isSameMonth(s, e) && isFirstDayOfMonth(s) && isLastDayOfMonth(e)) {
                    return { start: s, end: e, label: format(s, "MMMM yyyy"), startStr: ymd(s), endStr: ymd(e) };
                }
                if (isSameYear(s, e) && isFirstDayOfMonth(s) && s.getMonth() === 0 && e.getMonth() === 11 && isLastDayOfMonth(e)) {
                    return { start: s, end: e, label: format(s, "yyyy"), startStr: ymd(s), endStr: ymd(e) };
                }
                return { start: s, end: e, label: `${from} to ${to}`, startStr: ymd(s), endStr: ymd(e) };
            }
            if (s) return { start: s, end: null, label: `since ${from}`, startStr: ymd(s), endStr: null };
            if (e) return { start: null, end: e, label: `up to ${to}`, startStr: null, endStr: ymd(e) };
            return none;
        }
        default:
            return none;
    }
}
