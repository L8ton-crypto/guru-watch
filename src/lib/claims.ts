// Extract ticker calls + stance from a video title and description.
// Two paths:
// 1. If ANTHROPIC_API_KEY is set, ask Claude for a strict JSON list.
// 2. Otherwise, fall back to a regex + keyword heuristic so the app always works.

export type Stance = "bullish" | "bearish" | "neutral";

export type Claim = {
  ticker: string;
  stance: Stance;
  evidence: string;
};

// Ignore common words that look like tickers in ALL CAPS but aren't.
const NOT_TICKERS = new Set([
  "AI", "API", "AM", "PM", "EST", "CEO", "CFO", "CTO", "ETF", "ETFS",
  "USA", "USD", "EUR", "GBP", "JPY", "EU", "UK", "US", "GDP", "CPI",
  "FED", "FOMC", "ECB", "NYSE", "NASDAQ", "SP", "DOW", "VIX", "IPO",
  "IPOS", "SEC", "FDA", "FTC", "IRS", "DOJ", "EV", "EVS", "BUY", "SELL",
  "HOLD", "BULL", "BEAR", "LONG", "SHORT", "CALL", "PUT", "STOCK", "STOCKS",
  "MARKET", "MARKETS", "TODAY", "NOW", "NEW", "OLD", "TOP", "BOTTOM",
  "MUST", "BIG", "ALL", "ONE", "TWO", "WEEK", "MONTH", "YEAR", "DAY",
  "OK", "NO", "YES", "WTF", "LOL", "GG", "WTH", "IMO", "TLDR", "FAQ",
  "PLEASE", "LIKE", "SUBSCRIBE", "WATCH", "FOLLOW", "LINK", "CHANNEL",
  "VIDEO", "EPISODE", "PART", "EP", "Q", "MR", "DR",
]);

function isTickerCandidate(t: string): boolean {
  if (!/^[A-Z]{1,5}$/.test(t)) return false;
  if (NOT_TICKERS.has(t)) return false;
  return true;
}

const BULLISH = [
  "buy", "long", "bull", "bullish", "moon", "rally", "pump", "calls",
  "load up", "loading", "accumulate", "breakout", "to the moon", "uptrend",
  "huge upside", "undervalued", "screaming buy", "buying", "added",
];
const BEARISH = [
  "sell", "short", "bear", "bearish", "dump", "crash", "puts", "avoid",
  "overvalued", "bubble", "trim", "trimming", "exit", "fade", "downtrend",
  "topping", "topped", "selling", "scam", "fraud",
];

function classifyStance(near: string): Stance {
  const t = near.toLowerCase();
  let b = 0;
  let s = 0;
  for (const w of BULLISH) if (t.includes(w)) b++;
  for (const w of BEARISH) if (t.includes(w)) s++;
  if (b > s) return "bullish";
  if (s > b) return "bearish";
  return "neutral";
}

export function heuristicExtract(title: string, description: string): Claim[] {
  const combined = `${title}\n${description}`;
  const seen = new Map<string, Claim>();

  // $TICKER form is the strongest signal.
  const dollarRe = /\$([A-Z]{1,5})\b/g;
  let m: RegExpExecArray | null;
  while ((m = dollarRe.exec(combined)) !== null) {
    const t = m[1];
    if (!isTickerCandidate(t)) continue;
    const start = Math.max(0, m.index - 80);
    const end = Math.min(combined.length, m.index + 80);
    const window = combined.slice(start, end);
    const stance = classifyStance(window);
    if (!seen.has(t)) {
      seen.set(t, { ticker: t, stance, evidence: window.trim().slice(0, 200) });
    }
  }

  // Bare TICKER form, but only when next to a stance keyword to keep false-positives down.
  const bareRe = /\b([A-Z]{2,5})\b/g;
  while ((m = bareRe.exec(combined)) !== null) {
    const t = m[1];
    if (!isTickerCandidate(t)) continue;
    if (seen.has(t)) continue;
    const start = Math.max(0, m.index - 50);
    const end = Math.min(combined.length, m.index + 50);
    const window = combined.slice(start, end);
    const stance = classifyStance(window);
    if (stance === "neutral") continue;
    seen.set(t, { ticker: t, stance, evidence: window.trim().slice(0, 200) });
  }

  return Array.from(seen.values());
}

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

export async function claudeExtract(
  title: string,
  description: string,
): Promise<Claim[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are extracting stock ticker calls from a YouTube video title + description.

Title: ${title}

Description:
${description.slice(0, 4000)}

Return a strict JSON array. Each item is { "ticker": "AAPL", "stance": "bullish|bearish|neutral", "evidence": "<= 200 chars from the source explaining the call" }.

Rules:
- Only include real US-listed stock or ETF tickers. Ignore crypto, forex, indices like SPX, and generic acronyms like AI, ETF, CEO.
- The same ticker can appear once at most. Pick the strongest stance the creator expressed in this video.
- stance bullish means buy/long/positive. bearish means sell/short/negative/avoid. neutral means mentioned without clear direction.
- If the creator is reviewing or comparing multiple tickers and they are clearly recommending some over others, include those with the right stance.
- If no tickers are mentioned, return [].

Return ONLY the JSON array. No prose, no markdown fences.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data?.content?.find((c) => c.type === "text")?.text || "";
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start < 0 || end <= start) return null;
    const slice = cleaned.slice(start, end + 1);
    const parsed = JSON.parse(slice) as unknown;
    if (!Array.isArray(parsed)) return null;
    const out: Claim[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const ticker = String(rec.ticker || "").toUpperCase().trim();
      const stanceRaw = String(rec.stance || "neutral").toLowerCase();
      const evidence = String(rec.evidence || "").slice(0, 200);
      if (!/^[A-Z][A-Z0-9.-]{0,5}$/.test(ticker)) continue;
      if (NOT_TICKERS.has(ticker)) continue;
      const stance: Stance =
        stanceRaw === "bullish" || stanceRaw === "bearish"
          ? stanceRaw
          : "neutral";
      out.push({ ticker, stance, evidence });
    }
    return out;
  } catch {
    return null;
  }
}

export async function extractClaims(
  title: string,
  description: string,
): Promise<Claim[]> {
  const viaClaude = await claudeExtract(title, description);
  if (viaClaude && viaClaude.length >= 0) return viaClaude;
  return heuristicExtract(title, description);
}
