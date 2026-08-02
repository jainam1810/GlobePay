import {
    startOfMonth, endOfMonth, subMonths,
    startOfQuarter, endOfQuarter, subQuarters,
    startOfYear, endOfYear, subYears,
    startOfDay, endOfDay, parseISO, format,
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

/**
 * Resolve a symbolic period into a concrete, inclusive date range.
 *
 * Uses date-fns rather than hand-rolled month/quarter arithmetic — the edge
 * cases (Q1 rolling back to Q4 of the previous year, month lengths, DST) are
 * exactly where home-made date maths goes wrong, and a wrong range here means a
 * wrong total in front of a stakeholder.
 */
export function resolvePeriod(period: AskPeriod, from: string, to: string, now = new Date()) {
    const none = { start: null, end: null, label: "all time" };

    switch (period) {
        case "this_month":
            return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, "MMMM yyyy") };
        case "last_month": {
            const d = subMonths(now, 1);
            return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMMM yyyy") };
        }
        case "this_quarter":
            return { start: startOfQuarter(now), end: endOfQuarter(now), label: format(now, "QQQ yyyy") };
        case "last_quarter": {
            const d = subQuarters(now, 1);
            return { start: startOfQuarter(d), end: endOfQuarter(d), label: format(d, "QQQ yyyy") };
        }
        case "this_year":
            return { start: startOfYear(now), end: endOfYear(now), label: format(now, "yyyy") };
        case "last_year": {
            const d = subYears(now, 1);
            return { start: startOfYear(d), end: endOfYear(d), label: format(d, "yyyy") };
        }
        case "custom": {
            const s = from ? startOfDay(parseISO(from)) : null;
            const e = to ? endOfDay(parseISO(to)) : null;
            if (s && isNaN(+s)) return none;
            if (e && isNaN(+e)) return none;
            if (s && e) return { start: s, end: e, label: `${from} to ${to}` };
            if (s) return { start: s, end: null, label: `since ${from}` };
            if (e) return { start: null, end: e, label: `up to ${to}` };
            return none;
        }
        default:
            return none;
    }
}
