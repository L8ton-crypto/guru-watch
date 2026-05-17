import Link from "next/link";

export const metadata = {
  title: "About - GuruWatch",
  description: "How GuruWatch scores YouTube finance creators against real prices.",
};

export default function About() {
  return (
    <main className="min-h-screen px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl text-sm text-gray-300 sm:text-base">
        <Link href="/" className="text-xs text-emerald-400 hover:underline">
          &larr; Back to GuruWatch
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          About GuruWatch
        </h1>

        <h2 className="mt-8 text-lg font-semibold text-emerald-400">What it does</h2>
        <p className="mt-2 text-gray-400">
          Paste a YouTube channel handle. We pull the channel&apos;s last 30 days
          of videos from the public RSS feed, extract every explicit US stock or
          ETF ticker mention from the title and description, classify the
          creator&apos;s stance, and compare the price on the day the video was
          posted to the price today.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-emerald-400">How a call is scored</h2>
        <p className="mt-2 text-gray-400">
          A bullish call hits if the stock is up at least 2% since the video.
          A bearish call hits if it&apos;s down at least 2%. Anything inside that
          band counts as flat. Tickers we can&apos;t find on Yahoo Finance get a
          &quot;no data&quot; flag instead of being scored.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-emerald-400">What it does NOT do (yet)</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-400">
          <li>Read the video itself or the audio transcript. We use the title and description only. Calls a creator makes in voice and not in the description are missed.</li>
          <li>Track deletions over time. The W2 scope adds daily re-checks and a &quot;DELETED&quot; / &quot;EDITED&quot; stamp.</li>
          <li>Score crypto, forex, or non-US tickers.</li>
        </ul>

        <h2 className="mt-8 text-lg font-semibold text-emerald-400">Defamation safety</h2>
        <p className="mt-2 text-gray-400">
          GuruWatch only shows factual, publicly verifiable data: a ticker was
          mentioned on date X in video Y, the price has moved Z% since. No
          opinions on individuals. No accusations. Just the receipts.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-emerald-400">Disclaimer</h2>
        <p className="mt-2 text-gray-400">
          Educational tool. Not financial advice. Not legal advice. Past
          performance of a creator&apos;s calls is not a prediction of future
          performance. Do your own research and don&apos;t trade based on this
          page.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-emerald-400">Data sources</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-400">
          <li>YouTube channel RSS feed for video metadata.</li>
          <li>Yahoo Finance public chart endpoint for prices.</li>
          <li>Anthropic Claude for ticker extraction and stance classification when an API key is configured; a regex + keyword heuristic otherwise.</li>
        </ul>

        <p className="mt-10 text-xs text-gray-500">
          Part of the L8 portfolio. Built overnight by Arc.
        </p>
      </div>
    </main>
  );
}
