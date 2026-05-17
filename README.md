# GuruWatch

YouTube finance receipts they wanted you to forget.

Paste a YouTube finance channel, get every explicit ticker call from the last 30 days of videos with the actual price move since the call. Hit or miss, public data only, free, no login.

## Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind v4 (dark mode, mobile-first)
- @vercel/analytics + @vercel/speed-insights
- Anthropic Claude API (optional) for ticker + stance extraction; regex fallback otherwise
- Yahoo Finance public chart endpoint for prices
- YouTube channel RSS feed for video metadata

No DB, no auth, no caching. Live per request.

## Env

- `ANTHROPIC_API_KEY` (optional). Without it, GuruWatch uses a regex + keyword heuristic to extract tickers. With it, Claude Haiku 4.5 does the extraction.

## Local

```bash
npm install
npm run dev
```

## Scoring

A bullish call hits if the stock is up at least 2% since the video. A bearish call hits if it's down at least 2%. Anything inside that band is flat.

## Roadmap (W2 scope)

- Neon persistence so claims are cached and not re-scraped on every load
- Daily video re-check, stamp `DELETED` / `EDITED` status
- Public leaderboard sorted by hit-rate, secondary by deletion-rate
- "Add a channel" submission form
- OG card per channel for LinkedIn shares
- Email digest opt-in: notify when a tracked channel deletes a video

## Disclaimer

Educational tool. Not financial advice. Not legal advice. GuruWatch only surfaces publicly verifiable data; it does not make accusations about individuals.
