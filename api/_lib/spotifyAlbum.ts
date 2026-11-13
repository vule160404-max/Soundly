export interface SpotifyParsedTrackItem {
  spotifyTrackId: string;
  spotifyUrl: string;
  title: string;
  artist: string;
  duration: number;
  previewUrl?: string;
}

export interface SpotifyParsedCollection {
  spotifyId: string;
  spotifyType: 'album' | 'playlist' | 'track';
  spotifyUrl: string;
  title: string;
  artist: string;
  coverUrl: string;
  releaseYear?: number;
  tracks: SpotifyParsedTrackItem[];
}

function cleanText(raw: unknown, fallback = ''): string {
  if (typeof raw !== 'string') return fallback;
  return raw.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim() || fallback;
}

function extractSpotifyTypeAndId(
  input: string
): { type: 'album' | 'playlist' | 'track'; id: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Handle spotify:album:ID or spotify:playlist:ID
  const uriMatch = trimmed.match(
    /spotify:(album|playlist|track):([a-zA-Z0-9]{15,30})/i
  );
  if (uriMatch) {
    return {
      type: uriMatch[1].toLowerCase() as 'album' | 'playlist' | 'track',
      id: uriMatch[2],
    };
  }

  // Handle https://open.spotify.com/(intl-xx/)?(embed/)?(album|playlist|track)/ID
  const urlMatch = trimmed.match(
    /spotify\.com\/(?:intl-[a-zA-Z-]+\/)?(?:embed\/)?(album|playlist|track)\/([a-zA-Z0-9]{15,30})/i
  );
  if (urlMatch) {
    return {
      type: urlMatch[1].toLowerCase() as 'album' | 'playlist' | 'track',
      id: urlMatch[2],
    };
  }

  return null;
}

async function resolveShortSpotifyUrl(rawUrl: string): Promise<string> {
  const trimmed = rawUrl.trim();
  if (
    /^https?:\/\/(spotify\.link|spoti\.fi)\//i.test(trimmed)
  ) {
    try {
      const res = await fetch(trimmed, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      });
      if (res.url) return res.url;
    } catch {
      // ignore redirect resolution failure
    }
  }
  return trimmed;
}

function pickBestImageUrl(entity: Record<string, any>): string {
  const sources: Array<{ url?: string; width?: number; maxWidth?: number }> = [
    ...(Array.isArray(entity?.coverArt?.sources) ? entity.coverArt.sources : []),
    ...(Array.isArray(entity?.visualIdentity?.image)
      ? entity.visualIdentity.image
      : []),
  ];

  const valid = sources.filter(
    s => typeof s?.url === 'string' && s.url.startsWith('http')
  );
  if (valid.length === 0) return '';

  valid.sort(
    (a, b) =>
      (Number(b.width || b.maxWidth) || 0) -
      (Number(a.width || a.maxWidth) || 0)
  );
  return valid[0].url || '';
}

export async function fetchSpotifyCollectionMetadata(
  rawInput: string
): Promise<SpotifyParsedCollection> {
  const resolvedInput = await resolveShortSpotifyUrl(rawInput);
  const parsed = extractSpotifyTypeAndId(resolvedInput);

  if (!parsed) {
    throw new Error(
      'Link Spotify không hợp lệ. Vui lòng dán link Album hoặc Playlist từ Spotify (ví dụ: https://open.spotify.com/album/... hoặc https://open.spotify.com/playlist/...).'
    );
  }

  const { type, id } = parsed;
  const canonicalUrl = `https://open.spotify.com/${type}/${id}`;
  const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;

  const res = await fetch(embedUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  if (!res.ok) {
    throw new Error(
      `Không thể truy cập dữ liệu từ Spotify (HTTP ${res.status}). Vui lòng kiểm tra lại link Album/Playlist công khai.`
    );
  }

  const html = await res.text();
  const nextDataMatch = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i
  );

  if (!nextDataMatch || !nextDataMatch[1]) {
    throw new Error(
      'Không đọc được danh sách bài hát từ link Spotify này. Hãy đảm bảo Album hoặc Playlist đang ở chế độ Công khai (Public).'
    );
  }

  let nextData: Record<string, any>;
  try {
    nextData = JSON.parse(nextDataMatch[1]);
  } catch {
    throw new Error('Dữ liệu phản hồi từ Spotify không đúng định dạng.');
  }

  const entity = nextData?.props?.pageProps?.state?.data?.entity;
  if (!entity || typeof entity !== 'object') {
    throw new Error(
      'Không tìm thấy thông tin Album/Playlist trên Spotify. Vui lòng kiểm tra lại đường dẫn.'
    );
  }

  const title = cleanText(entity.name || entity.title, 'Album từ Spotify');
  const artist = cleanText(
    entity.subtitle ||
      (Array.isArray(entity.artists)
        ? entity.artists.map((a: any) => a?.name).filter(Boolean).join(', ')
        : ''),
    'Nhiều nghệ sĩ'
  );
  let coverUrl = pickBestImageUrl(entity);

  // Fallback to oEmbed thumbnail if embed entity did not include cover sources
  if (!coverUrl) {
    try {
      const oembedRes = await fetch(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(canonicalUrl)}`
      );
      if (oembedRes.ok) {
        const oembed = (await oembedRes.json()) as { thumbnail_url?: string };
        if (oembed?.thumbnail_url) {
          coverUrl = oembed.thumbnail_url;
        }
      }
    } catch {
      // ignore oembed failure
    }
  }

  if (!coverUrl) {
    coverUrl =
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80';
  }

  let releaseYear: number | undefined;
  const isoDate = entity?.releaseDate?.isoString;
  if (typeof isoDate === 'string') {
    const yr = parseInt(isoDate.slice(0, 4), 10);
    if (Number.isFinite(yr) && yr > 1900 && yr <= 2100) {
      releaseYear = yr;
    }
  }

  const rawTracks: any[] = Array.isArray(entity.trackList)
    ? entity.trackList
    : type === 'track'
      ? [entity]
      : [];

  const tracks: SpotifyParsedTrackItem[] = rawTracks
    .map((item: any, idx: number) => {
      const uri = typeof item?.uri === 'string' ? item.uri : '';
      const uriIdMatch = uri.match(/spotify:track:([a-zA-Z0-9]+)/i);
      const spotifyTrackId =
        uriIdMatch?.[1] ||
        (typeof item?.id === 'string' ? item.id : '') ||
        `${id}-track-${idx + 1}`;

      const trackTitle = cleanText(item?.title || item?.name);
      if (!trackTitle) return null;

      const trackArtist = cleanText(
        item?.subtitle ||
          (Array.isArray(item?.artists)
            ? item.artists.map((a: any) => a?.name).filter(Boolean).join(', ')
            : ''),
        artist
      );

      const durationMs = Number(item?.duration || item?.duration_ms) || 0;
      const durationSec =
        durationMs > 1000
          ? Math.max(1, Math.round(durationMs / 1000))
          : durationMs > 0
            ? Math.round(durationMs)
            : 210;

      const previewUrl =
        typeof item?.audioPreview?.url === 'string'
          ? item.audioPreview.url
          : '';

      return {
        spotifyTrackId,
        spotifyUrl: uriIdMatch?.[1]
          ? `https://open.spotify.com/track/${uriIdMatch[1]}`
          : canonicalUrl,
        title: trackTitle,
        artist: trackArtist,
        duration: durationSec,
        ...(previewUrl ? { previewUrl } : {}),
      };
    })
    .filter((t): t is SpotifyParsedTrackItem => t !== null);

  if (tracks.length === 0) {
    throw new Error(
      'Album/Playlist Spotify này hiện chưa có bài hát nào hoặc đang để ở chế độ riêng tư.'
    );
  }

  return {
    spotifyId: id,
    spotifyType: type,
    spotifyUrl: canonicalUrl,
    title,
    artist,
    coverUrl,
    ...(releaseYear ? { releaseYear } : {}),
    tracks,
  };
}
