"use client";

import { useMemo, useState } from "react";

type Stance = "bullish" | "bearish" | "neutral";
type Hit = "hit" | "miss" | "flat" | "no-data";

type Channel = {
  channelId: string;
  channelTitle: string;
  channelUrl: string;
  avatar: string | null;
};

type Row = {
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  thumbnail: string;
  publishedAt: string;
  ticker: string;
  stance: Stance;
  evidence: string;
  closeAt: number | null;
  closeNow: number | null;
  pctChange: number | null;
  hit: Hit;
};

type Summary = {
  videos: number;
  calls: number;
  hits: number;
  misses: number;
  flat: number;
  noData: number;
  hitRate: number | null;
};

type AnalyzeResponse = {
  channel: Channel;
  rows: Row[];
  summary: Summary;
};

function fmtDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "-";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function fmtMoney(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return `$${n.toFixed(2)}`;
}

const stanceColor: Record<Stance, string> = {
  bullish: "text-emerald-400",
  bearish: "text-red-400",
  neutral: "text-gray-400",
};

const hitColor: Record<Hit, string> = {
  hit: "text-emerald-400",
  miss: "text-red-400",
  flat: "text-gray-400",
  "no-data": "text-gray-600",
};

const hitLabel: Record<Hit, string> = {
  hit: "Hit",
  miss: "Miss",
  flat: "Flat",
  "no-data": "No data",
};

export default function Home() {
  const [channel, setChannel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [sortKey, setSortKey] = useState<"date" | "ticker" | "pct" | "hit">("date");
  const [stanceFilter, setStanceFilter] = useState<Stance | "all">("all");

  const sortedRows = useMemo(() => {
    if (!data) return [] as Row[];
    let rows = data.rows;
    if (stanceFilter !== "all") rows = rows.filter((r) => r.stance === stanceFilter);
    const copy = [...rows];
    switch (sortKey) {
      case "date":
        copy.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
        break;
      case "ticker":
        copy.sort((a, b) => a.ticker.localeCompare(b.ticker));
        break;
      case "pct":
        copy.sort((a, b) => (b.pctChange ?? -1e9) - (a.pctChange ?? -1e9));
        break;
      case "hit":
        copy.sort((a, b) => {
          const order: Record<Hit, number> = { hit: 0, miss: 1, flat: 2, "no-data": 3 };
          return order[a.hit] - order[b.hit];
        });
        break;
    }
    return copy;
  }, [data, sortKey, stanceFilter]);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (!channel.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || `Failed (${res.status})`);
      } else {
        setData(json);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 sm:mb-12">
          <div className="flex items-center gap-3">
            <div className="relative h-3 w-3">
              <span className="pulse-ring absolute inset-0 rounded-full bg-emerald-500/40"></span>
              <span className="absolute inset-0 rounded-full bg-emerald-500"></span>
            </div>
            <p className="text-xs uppercase tracking-widest text-emerald-400">
              GuruWatch
            </p>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
            YouTube finance receipts they wanted you to forget.
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-gray-400 sm:text-base">
            Paste a YouTube finance channel. We pull every ticker call from the
            last 30 days, score it against the actual price move, and flag the
            hits and the misses. Free, no login.
          </p>
        </header>

        <form
          onSubmit={run}
          className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6"
        >
          <label htmlFor="channel" className="block text-sm font-medium text-gray-300">
            YouTube channel
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="channel"
              type="text"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="@MeetKevin or https://www.youtube.com/@MeetKevin"
              className="flex-1 rounded-md border border-[var(--border)] bg-black px-3 py-2 text-sm outline-none ring-emerald-500/40 placeholder:text-gray-600 focus:ring-2"
              disabled={loading}
              maxLength={200}
            />
            <button
              type="submit"
              disabled={loading || !channel.trim()}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/40"
            >
              {loading ? "Pulling receipts..." : "Get the receipts"}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Tip: @handle, channel URL, or channel ID all work.
          </p>
        </form>

        {error && (
          <div className="mt-6 rounded-md border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-12 flex flex-col items-center gap-3 text-sm text-gray-500">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
            <span>Reading videos, extracting tickers, scoring against price.</span>
          </div>
        )}

        {data && (
          <section className="mt-8">
            <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex items-center gap-3">
                {data.channel.avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.channel.avatar}
                    alt=""
                    className="h-12 w-12 rounded-full border border-[var(--border)] object-cover"
                  />
                )}
                <div>
                  <a
                    href={data.channel.channelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg font-semibold hover:text-emerald-400"
                  >
                    {data.channel.channelTitle}
                  </a>
                  <p className="text-xs text-gray-500">{data.channel.channelId}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 sm:gap-6">
                <Stat label="Videos" value={String(data.summary.videos)} />
                <Stat label="Calls" value={String(data.summary.calls)} />
                <Stat label="Hits" value={String(data.summary.hits)} color="text-emerald-400" />
                <Stat label="Misses" value={String(data.summary.misses)} color="text-red-400" />
                <Stat
                  label="Hit rate"
                  value={
                    data.summary.hitRate == null
                      ? "-"
                      : `${data.summary.hitRate}%`
                  }
                  color={
                    data.summary.hitRate == null
                      ? "text-gray-400"
                      : data.summary.hitRate >= 50
                        ? "text-emerald-400"
                        : "text-red-400"
                  }
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-500">Sort</span>
              {(["date", "ticker", "pct", "hit"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSortKey(k)}
                  className={`rounded-full border px-3 py-1 ${
                    sortKey === k
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                      : "border-[var(--border)] text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {k === "pct" ? "% move" : k === "hit" ? "result" : k}
                </button>
              ))}
              <span className="ml-3 text-gray-500">Stance</span>
              {(["all", "bullish", "bearish", "neutral"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStanceFilter(s)}
                  className={`rounded-full border px-3 py-1 capitalize ${
                    stanceFilter === s
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                      : "border-[var(--border)] text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {sortedRows.length === 0 ? (
              <p className="mt-8 text-sm text-gray-500">
                No ticker calls found in the last 30 days of videos.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="bg-[var(--panel)] text-left text-xs uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Video</th>
                      <th className="px-4 py-3">Ticker</th>
                      <th className="px-4 py-3">Stance</th>
                      <th className="px-4 py-3 text-right">Then</th>
                      <th className="px-4 py-3 text-right">Now</th>
                      <th className="px-4 py-3 text-right">% Move</th>
                      <th className="px-4 py-3">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((r, i) => (
                      <tr
                        key={`${r.videoId}-${r.ticker}-${i}`}
                        className="border-t border-[var(--border)] align-top hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                          {fmtDate(r.publishedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={r.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block max-w-[28ch] truncate hover:text-emerald-400"
                            title={r.videoTitle}
                          >
                            {r.videoTitle}
                          </a>
                          {r.evidence && (
                            <p
                              className="mt-1 max-w-[40ch] truncate text-xs text-gray-500"
                              title={r.evidence}
                            >
                              {r.evidence}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold">{r.ticker}</td>
                        <td className={`px-4 py-3 capitalize ${stanceColor[r.stance]}`}>
                          {r.stance}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">
                          {fmtMoney(r.closeAt)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">
                          {fmtMoney(r.closeNow)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono ${
                            r.pctChange == null
                              ? "text-gray-600"
                              : r.pctChange >= 0
                                ? "text-emerald-400"
                                : "text-red-400"
                          }`}
                        >
                          {fmtPct(r.pctChange)}
                        </td>
                        <td className={`px-4 py-3 font-semibold ${hitColor[r.hit]}`}>
                          {hitLabel[r.hit]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {!data && !loading && (
          <section className="mt-10 grid gap-4 sm:grid-cols-3">
            <Card title="The receipts">
              Most analyst-tracking tools cover X handles or credentialed bloggers.
              YouTube is the highest volume scam vector in retail finance and nobody
              tracks it. We do.
            </Card>
            <Card title="Public data only">
              Video titles and descriptions are public. Prices are public. We just
              line them up and let the numbers talk.
            </Card>
            <Card title="Not advice">
              Educational only. Not financial advice. We surface what is
              publicly verifiable. Don&apos;t make trades on this.
            </Card>
          </section>
        )}

        <footer className="mt-16 border-t border-[var(--border)] pt-6 text-xs text-gray-500 sm:text-sm">
          <p>
            Hit logic: bullish call hits if the stock is up 2% or more since the
            video. Bearish call hits if it&apos;s down 2% or more. Anything within
            2% counts as flat.
          </p>
          <p className="mt-2">
            Educational tool. Not financial advice. <a
              href="/about"
              className="text-emerald-400 hover:underline"
            >
              About &amp; method
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${color || "text-gray-100"}`}>{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
        {title}
      </h3>
      <p className="mt-2 text-sm text-gray-400">{children}</p>
    </div>
  );
}
