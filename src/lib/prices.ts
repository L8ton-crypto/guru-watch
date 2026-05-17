// Pull historical and current prices from Yahoo Finance's public chart endpoint.
// No API key. Be polite with one in-flight request per ticker.

export type PricePoint = {
  closeAt: number;
  closeNow: number;
  asOfThen: string; // ISO
  asOfNow: string; // ISO
  pctChange: number;
};

type ChartResp = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{ close?: (number | null)[] }>;
        adjclose?: Array<{ adjclose?: (number | null)[] }>;
      };
      meta?: { regularMarketPrice?: number };
    }>;
    error?: unknown;
  };
};

const UA = "Mozilla/5.0 (compatible; GuruWatch/1.0; +https://guru-watch.vercel.app)";

function isoDay(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

export async function priceMove(
  ticker: string,
  fromIso: string,
): Promise<PricePoint | null> {
  const from = Date.parse(fromIso);
  if (!Number.isFinite(from)) return null;
  const fromSec = Math.floor(from / 1000) - 60 * 60 * 24; // pad 1 day before
  const nowSec = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${fromSec}&period2=${nowSec}&interval=1d&includePrePost=false`;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ChartResp;
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const timestamps = result.timestamp || [];
    const closes =
      result.indicators?.adjclose?.[0]?.adjclose ||
      result.indicators?.quote?.[0]?.close ||
      [];
    // First non-null close at or after fromSec
    let thenIdx = -1;
    for (let i = 0; i < timestamps.length; i++) {
      if (timestamps[i] >= Math.floor(from / 1000) && closes[i] != null) {
        thenIdx = i;
        break;
      }
    }
    if (thenIdx === -1) {
      // Fallback to first available close in the window
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] != null) {
          thenIdx = i;
          break;
        }
      }
    }
    if (thenIdx === -1) return null;
    const closeAt = Number(closes[thenIdx]);
    // Latest non-null close
    let nowIdx = -1;
    for (let i = closes.length - 1; i >= 0; i--) {
      if (closes[i] != null) {
        nowIdx = i;
        break;
      }
    }
    const closeNow =
      nowIdx >= 0
        ? Number(closes[nowIdx])
        : Number(result.meta?.regularMarketPrice ?? NaN);
    if (!Number.isFinite(closeAt) || !Number.isFinite(closeNow)) return null;
    const pct = ((closeNow - closeAt) / closeAt) * 100;
    return {
      closeAt,
      closeNow,
      asOfThen: isoDay(timestamps[thenIdx]),
      asOfNow:
        nowIdx >= 0 ? isoDay(timestamps[nowIdx]) : new Date().toISOString().slice(0, 10),
      pctChange: pct,
    };
  } catch {
    return null;
  }
}
