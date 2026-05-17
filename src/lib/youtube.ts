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
  publishedAt: string;
  thumbnail: string;
};

const ENTITY_AMP = /&amp;/g;
const ENTITY_LT = /&lt;/g;
const ENTITY_GT = /&gt;/g;
const ENTITY_QUOT = /&quot;/g;
const ENTITY_APOS_NUM = /&#39;/g;
const ENTITY_APOS = /&apos;/g;

function decodeEntities(s: string): string {
  return s
    .replace(ENTITY_AMP, "&")
    .replace(ENTITY_LT, "<")
    .replace(ENTITY_GT, ">")
    .replace(ENTITY_QUOT, '"')
    .replace(ENTITY_APOS_NUM, "'")
    .replace(ENTITY_APOS, "'");
}

function pick(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  return m ? m[1] : null;
}

const RE_CHANNEL_ID_JSON = /"channelId":"(UC[\w-]{20,})"/;
const RE_CHANNEL_ID_META = /<meta itemprop="channelId" content="(UC[\w-]{20,})"/;
const RE_CHANNEL_ID_URL = /\/channel\/(UC[\w-]{20,})/;
const RE_CHANNEL_NAME_META = /<meta itemprop="name" content="([^"]+)"/;
const RE_CHANNEL_AUTHOR = /"author":"([^"]+)"/;
const RE_CHANNEL_TITLE_TAG = /<title>([^<]+) - YouTube<\/title>/;
const RE_AVATAR_JSON = /"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/;
const RE_AVATAR_LINK = /<link rel="image_src" href="([^"]+)"/;

const RE_VIDEO_ID = /<yt:videoId>([^<]+)<\/yt:videoId>/;
const RE_VIDEO_TITLE = /<title>([^<]+)<\/title>/;
const RE_VIDEO_PUBLISHED = /<published>([^<]+)<\/published>/;
const RE_VIDEO_DESCRIPTION = /<media:description>([\s\S]*?)<\/media:description>/;
const RE_VIDEO_THUMB = /<media:thumbnail url="([^"]+)"/;

const HANDLE_OK = /^[\w.-]{1,60}$/;
const CHANNEL_ID_FORM = /^UC[\w-]{20,}$/i;
const SCHEME = /^https?:\/\//i;

export async function resolveChannel(input: string): Promise<ChannelInfo | null> {
  const raw = input.trim();
  if (!raw) return null;

  let url: string;
  if (SCHEME.test(raw)) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return null;
    }
    const host = parsed.hostname.toLowerCase();
    const ok = host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com");
    if (!ok) return null;
    url = parsed.toString();
  } else if (raw.startsWith("@")) {
    const handle = raw.slice(1);
    if (!HANDLE_OK.test(handle)) return null;
    url = "https://www.youtube.com/@" + handle;
  } else if (CHANNEL_ID_FORM.test(raw)) {
    url = "https://www.youtube.com/channel/" + raw;
  } else {
    if (!HANDLE_OK.test(raw)) return null;
    url = "https://www.youtube.com/@" + raw;
  }

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
    pick(html, RE_CHANNEL_ID_JSON) ||
    pick(html, RE_CHANNEL_ID_META) ||
    pick(html, RE_CHANNEL_ID_URL);
  if (!channelId) return null;

  const channelTitle =
    pick(html, RE_CHANNEL_NAME_META) ||
    pick(html, RE_CHANNEL_AUTHOR) ||
    pick(html, RE_CHANNEL_TITLE_TAG) ||
    channelId;

  const avatar = pick(html, RE_AVATAR_JSON) || pick(html, RE_AVATAR_LINK);

  return {
    channelId,
    channelTitle: decodeEntities(channelTitle),
    channelUrl: "https://www.youtube.com/channel/" + channelId,
    avatar,
  };
}

export async function fetchRecentVideos(
  channelId: string,
  sinceDays = 30,
): Promise<VideoInfo[]> {
  const url =
    "https://www.youtube.com/feeds/videos.xml?channel_id=" +
    encodeURIComponent(channelId);
  const res = await fetch(url, {
    headers: { "user-agent": "GuruWatch/1.0 (+https://guru-watch.vercel.app)" },
  });
  if (!res.ok) return [];
  const xml = await res.text();

  const entries = xml.split("<entry>").slice(1);
  const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
  const out: VideoInfo[] = [];

  for (const entry of entries) {
    const block = entry.split("</entry>")[0];
    const videoId = pick(block, RE_VIDEO_ID);
    const title = pick(block, RE_VIDEO_TITLE);
    const published = pick(block, RE_VIDEO_PUBLISHED);
    const description = pick(block, RE_VIDEO_DESCRIPTION) || "";
    const thumb = pick(block, RE_VIDEO_THUMB);
    if (!videoId || !title || !published) continue;
    const ts = Date.parse(published);
    if (Number.isFinite(ts) && ts < cutoff) continue;
    out.push({
      videoId,
      url: "https://www.youtube.com/watch?v=" + videoId,
      title: decodeEntities(title),
      description: decodeEntities(description),
      publishedAt: published,
      thumbnail: thumb || "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg",
    });
  }
  return out;
}
