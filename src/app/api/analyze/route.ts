import { NextRequest, NextResponse } from "next/server";
import { resolveChannel, fetchRecentVideos } from "@/lib/youtube";
import { extractClaims, type Claim } from "@/lib/claims";
import { priceMove } from "@/lib/prices";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

function clientKey(req: NextRequest): string {
  const xfwd = req.headers.get("x-forwarded-for");
  if (xfwd) return xfwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "anon";
}

type RowOut = {
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  thumbnail: string;
  publishedAt: string;
  ticker: string;
  stance: Claim["stance"];
  evidence: string;
  closeAt: number | null;
  closeNow: number | null;
  pctChange: number | null;
  hit: "hit" | "miss" | "flat" | "no-data";
};

function scoreHit(stance: Claim["stance"], pct: number | null): RowOut["hit"] {
  if (pct == null || !Number.isFinite(pct)) return "no-data";
  if (Math.abs(pct) < 2) return "flat";
  if (stance === "bullish") return pct >= 2 ? "hit" : "miss";
  if (stance === "bearish") return pct <= -2 ? "hit" : "miss";
  return "flat";
}

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimit(clientKey(req), 10, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Rate limit reached. Try again in a bit." },
        { status: 429 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const input = String(body?.channel || "").trim();
    if (!input) {
      return NextResponse.json({ error: "Channel handle or URL is required" }, { status: 400 });
    }
    if (input.length > 200) {
      return NextResponse.json({ error: "Input too long" }, { status: 400 });
    }

    const channel = await resolveChannel(input);
    if (!channel) {
      return NextResponse.json(
        { error: "Could not resolve that channel. Try the full URL or the @handle." },
        { status: 404 },
      );
    }

    const videos = await fetchRecentVideos(channel.channelId, 30);
    if (videos.length === 0) {
      return NextResponse.json({
        channel,
        videos: [],
        rows: [],
        summary: { videos: 0, calls: 0, hits: 0, misses: 0, flat: 0, noData: 0, hitRate: null },
      });
    }

    // Extract claims per video in parallel. Claude calls are pooled by their own provider.
    const perVideo = await Promise.all(
      videos.map(async (v) => ({
        video: v,
        claims: await extractClaims(v.title, v.description),
      })),
    );

    // Flatten into rows and gather unique (ticker, publishedAt) for price fetches.
    type Row = {
      video: typeof videos[number];
      claim: Claim;
    };
    const rows: Row[] = [];
    for (const pv of perVideo) {
      for (const claim of pv.claims) rows.push({ video: pv.video, claim });
    }

    // Limit per-row price fetches to keep us inside maxDuration on busy channels.
    const cap = 60;
    const capped = rows.slice(0, cap);

    const priceResults = await Promise.all(
      capped.map((r) => priceMove(r.claim.ticker, r.video.publishedAt)),
    );

    const out: RowOut[] = capped.map((r, i) => {
      const p = priceResults[i];
      const pct = p ? p.pctChange : null;
      return {
        videoId: r.video.videoId,
        videoTitle: r.video.title,
        videoUrl: r.video.url,
        thumbnail: r.video.thumbnail,
        publishedAt: r.video.publishedAt,
        ticker: r.claim.ticker,
        stance: r.claim.stance,
        evidence: r.claim.evidence,
        closeAt: p ? p.closeAt : null,
        closeNow: p ? p.closeNow : null,
        pctChange: pct,
        hit: scoreHit(r.claim.stance, pct),
      };
    });

    const summary = {
      videos: videos.length,
      calls: out.length,
      hits: out.filter((r) => r.hit === "hit").length,
      misses: out.filter((r) => r.hit === "miss").length,
      flat: out.filter((r) => r.hit === "flat").length,
      noData: out.filter((r) => r.hit === "no-data").length,
      hitRate: 0 as number | null,
    };
    const decided = summary.hits + summary.misses;
    summary.hitRate = decided > 0 ? Math.round((summary.hits / decided) * 100) : null;

    return NextResponse.json({ channel, videos, rows: out, summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Analyze failed: ${msg}` }, { status: 500 });
  }
}
