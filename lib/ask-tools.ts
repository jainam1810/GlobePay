// Tool definitions for the assistant.
//
// The model is genuinely in charge here: it reads the question, decides which
// tools to call and how many times, calls several in parallel when a message
// contains more than one question, and writes the reply in its own words. That
// is what makes it an agent rather than a lookup.
//
// What it does not do is arithmetic — because that is the one thing it is
// measurably bad at, and the one thing here that must never be wrong. The
// research is blunt: LLMs "did not learn addition", they learned that "2 + 2 ="
// is usually followed by "4", which is why commercial systems route computation
// to tools. The model asks for a total; code computes it; the model explains it.
// Numbers that come from computation can be audited and reproduced. Numbers that
// come from narrative reasoning cannot.

export type ToolName = "query_payments" | "describe_data";

/** Gemini function declarations. Kept deliberately few and wide — a model given
 *  twenty narrow tools picks the wrong one; given two expressive ones it composes. */
export const toolDeclarations = [
    {
        name: "query_payments",
        description:
            "Compute figures over the payments this account can see. Call once per distinct question — "
            + "if the user asks two things in one message, call it twice in the same turn. "
            + "Returns computed totals, counts and breakdowns plus the matching payments. "
            + "All arithmetic is done by this tool; never calculate figures yourself.",
        parameters: {
            type: "object",
            properties: {
                label: {
                    type: "string",
                    description: "Short label for which part of the question this call answers, e.g. 'overall total' or 'Argentina only'.",
                },
                from: { type: "string", description: "Start date YYYY-MM-DD inclusive. Omit for no lower bound." },
                to: { type: "string", description: "End date YYYY-MM-DD inclusive. Omit for no upper bound." },
                country: { type: "string", description: "Exact country name as returned by describe_data. Omit for all." },
                contractor: { type: "string", description: "Contractor name or part of one. Omit for all." },
                client: { type: "string", description: "Client company name. Only meaningful for GlobePay staff. Omit for all." },
                groupBy: {
                    type: "string",
                    enum: ["none", "country", "contractor", "client", "month"],
                    description: "Return a breakdown by this dimension. Use 'none' for a single figure.",
                },
            },
            required: ["label"],
        },
    },
    {
        name: "describe_data",
        description:
            "List the countries, contractors and clients that actually appear in this account's payments, "
            + "plus the date range covered. Call this first when the user names something and you need to map "
            + "it to a real value — 'the Argentinian guy', a misspelling, a nickname — or when you need to know "
            + "what periods have data. Cheap; prefer calling it over guessing.",
        parameters: { type: "object", properties: {} },
    },
];

export const SYSTEM_BRIEF = `You are GlobePay's payments assistant. You answer questions about payments a company has already made through GlobePay.

How you work:
- Use the tools for every figure. You must never add, subtract, average or otherwise compute a number yourself, and never estimate one. If you need a figure, call query_payments and use exactly what it returns.
- A message may contain several questions. Answer all of them — issue one query_payments call per question in the same turn, each with a distinct label.
- Handle typos, slang, nicknames and vague phrasing. When a name or country is uncertain, call describe_data and map it to a real value rather than guessing.
- Resolve relative periods ("last quarter", "this month", "since April") into explicit from/to dates using today's date, which is given below.

How you reply:
- Lead with the answer. If asked who was paid most, the first words should be that person's name.
- Sentence case, plain English, no jargon, no headings. Two or three short sentences is usually right.
- Currency as $1,234.56. Quote figures exactly as the tools returned them.
- When several questions were asked, answer each clearly — a short line each is better than a paragraph.
- When you requested a breakdown, the interface draws it as a chart beneath your reply. Describe what it shows — the leader, the shape, anything surprising — instead of listing every row back. Call out an "Unspecified" group if there is one, since it means those payments have no country recorded; it is a gap in the data, not a country, so never count it as one. For how many countries there are, use the countries figure the tool returned.
- If the tools return nothing, say so plainly and say what you searched. Never fill a gap with a plausible number.
- If a question can't be answered from payment records — tax advice, forecasts, anything about money not yet paid — say that briefly instead of inventing an answer.`;
