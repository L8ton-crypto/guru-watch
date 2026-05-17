// Resolve a YouTube channel handle/URL to a channel ID, then fetch the RSS
// feed for the last ~15 videos. No API key required.

export type ChannelInfo = {
  channelId: string;
  channelTitle: string;
  channelUrl: string;
  avatar: string | null;
};

export type VideoInfo = {
  videoId: string;
  url: string;
  title: string;
  description: string;
  publishedAt: string; // ISO
  thumbnail: string;
};

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function pick(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  return m ? m[1] : null;
}

// Accepts: @handle, channel/UCxxx, /c/Name, /user/Name, or a full URL
export async function resolveChannel(input: string): Promise<ChannelInfo | null> {
  const raw = input.trim();
  if (!raw) return null;

  let url: string;
  if (/^https?:\/\//i.test(raw)) {
    url = raw;
  } else if (raw.startsWith("@")) {
    url = `https://www.youtube.com/${raw}`;
  } else if (/^UC[\w-]{20,}$/i.test(raw)) {
    url = `https://www.youtube.com/channel/${raw}`;
  } else {
    url = `https://www.youtube.com/@${raw.replace(/^@/, "")}`;
  }

  // Use a desktop UA so we get the full page, not a stripped mobile shell.
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });
  if (!res.ok) return null;
  const html = await res.text();

  const channelId =
    pick(html, /"channelId":"(UC[\w-]{20,})"/) ||
    pick(html, /<meta itemprop="channelId" content="(UC[\w-]{20,})"/) ||
    pick(html, /\/channel\/(UC[\w-]{20,})/);

  if (!channelId) return null;

  const channelTitle =
    pick(html, /<meta itemprop="name" content="([^"]+)"/) ||
    pick(html, /"author":"([^"]+)"/) ||
    pick(html, /<title>([^<]+) - YouTube<\/title>/) ||
    channelId;

  const avatar =
    pick(html, /"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/) ||
    pick(html, /<link rel="image_src" href="([^"]+)"/);

  return {
    channelId,
    channelTitle: decodeEntities(channelTitle),
    channelUrl: `https://www.youtube.com/channel/${channelId}`,
    avatar,
  };
}

// Parse the YouTube RSS feed for the last ~15 videos of a channel.
export async function fetchRecentVideos(
  channelId: string,
  sinceDays = 30,
): Promise<VideoInfo[]> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const res = await fetch(url, {
    headers: { "user-agent": "GuruWatch/1.0 (+https://guru-watch.vercel.app)" },
  });
  if (!res.ok) return [];
  const xml = await res.text();

  const entries = xml.split(/<entry>/).slice(1);
  const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
  const out: VideoInfo[] = [];

  for (const entry of entries) {
    const block = entry.split("</entry>")[0];
    const videoId = pick(block, /<yt:videoId>([^<]+)<\/yt:videoId>/);
    const title = pick(block, /<title>([^<]+)<\/title>/);
    const published = pick(block, /<published>([^<]+)<\/published>/);
    const description =
      pick(block, /<media:description>([\s\S]*?)<\/media:description>/) || "";
    const thumb = pick(block, /<media:thumbnail url="([^"]+)"/);
    if (!videoId || !title || !published) continue;
    const ts = Date.parse(published);
    if (Number.isFinite(ts) && ts < cutoff) continue;
    out.push({
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: decodeEntities(title),
      description: decodeEntities(description),
      publishedAt: published,
      thumbnail: thumb || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    });
  }
  return out;
}
