import { GoogleGenAI, Type } from '@google/genai';

const SPOTIFY_GENRE_NAMES = [
  'Pop',
  'V-Pop',
  'Hip-Hop',
  'R&B',
  'Rock',
  'EDM / Electronic',
  'Indie',
  'Ballad',
  'Lo-Fi & Chill',
  'K-Pop',
  'Jazz',
  'Classical',
];

export interface ClassifyInputTrack {
  id: string;
  title: string;
  artist?: string;
  fileName?: string;
  album?: string;
  duration?: number;
}

export interface ClassifiedTrackResult {
  id: string;
  genre: string;
  mood: string;
  bpm: number;
  suggestedTitle: string;
  suggestedArtist: string;
  reason: string;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const PLACEHOLDER_ARTISTS = new Set([
  'nghe si chua ro',
  'nghe si spotflow',
  'cho ai nhan dien',
  'unknown artist',
  'various artists',
]);

function normalizeAsciiText(raw?: string | null): string {
  return (raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugifyArtistLookup(raw?: string | null): string {
  return (raw || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isHyphenFilenameSlug(text?: string | null): boolean {
  if (!text) return false;
  const t = text.trim();
  if (!t || /\s/.test(t)) return false;
  if (/[^\u0000-\u007f]/.test(t)) return false;
  return t.split('-').filter(Boolean).length >= 2;
}

export function isRawSlugDisplayText(text?: string | null): boolean {
  if (!text || !text.trim()) return true;
  const t = text.trim();
  if (PLACEHOLDER_ARTISTS.has(normalizeAsciiText(t))) return true;
  if (t.includes('_') || isHyphenFilenameSlug(t)) return true;
  return !/[^\u0000-\u007f]/.test(t) && t === t.toLowerCase();
}

export const VIETNAMESE_ARTIST_DICTIONARY: Record<string, string> = {
  'anh-trai-say-hi': 'ANH TRAI "SAY HI"',
  'quang-hung-masterd': 'Quang Hùng MasterD',
  'quang-hung-m': 'Quang Hùng MasterD',
  'quang-hung': 'Quang Hùng MasterD',
  'mr-siro': 'Mr. Siro',
  'b-ray': 'B Ray',
  'bray': 'B Ray',
  'dat-g': 'Đạt G',
  'du-uyen': 'Du Uyên',
  'amee': 'AMEE',
  'buitruonglinh': 'buitruonglinh',
  'bui-truong-linh': 'Bùi Trường Linh',
  'le-quyen': 'Lệ Quyên',
  'bang-kieu': 'Bằng Kiều',
  'quang-le': 'Quang Lê',
  'le-quyen-quang-le': 'Lệ Quyên, Quang Lê',
  'hoai-sa': 'Hoài Sa',
  'son-tung-m-tp': 'Sơn Tùng M-TP',
  'son-tung-mtp': 'Sơn Tùng M-TP',
  'den-vau': 'Đen Vâu',
  'den': 'Đen',
  'hoang-dung': 'Hoàng Dũng',
  'phan-manh-quynh': 'Phan Mạnh Quỳnh',
  'ha-anh-tuan': 'Hà Anh Tuấn',
  'my-tam': 'Mỹ Tâm',
  'noo-phuoc-thinh': 'Noo Phước Thịnh',
  'bich-phuong': 'Bích Phương',
  'duc-phuc': 'Đức Phúc',
  'hoa-minzy': 'Hòa Minzy',
  'van-mai-huong': 'Văn Mai Hương',
  'trung-quan': 'Trung Quân',
  'quan-a-p': 'Quân A.P',
  'quan-ap': 'Quân A.P',
  'hai-dang-doo': 'Hải Đăng Doo',
  'quang-dang-tran': 'Quang Đăng Trần',
  'ha-an-huy': 'Hà An Huy',
  'soobin-hoang-son': 'SOOBIN',
  'soobin': 'SOOBIN',
  'justatee': 'JustaTee',
  'binz': 'Binz',
  'karik': 'Karik',
  'tlinh': 'tlinh',
  'rpt-mck': 'RPT MCK',
  'mck': 'RPT MCK',
  'wren-evans': 'Wren Evans',
  'mono': 'MONO',
  'grey-d': 'GREY D',
  'hieuthuhai': 'HIEUTHUHAI',
  'obito': 'Obito',
  'low-g': 'Low G',
  'phuong-ly': 'Phương Ly',
  'thinh-suy': 'Thịnh Suy',
  'ngot': 'Ngọt',
  'ca-hoi-hoang': 'Cá Hồi Hoang',
  'chillies': 'Chillies',
  'da-lab': 'Da LAB',
  'dalab': 'Da LAB',
  'dangrangto': 'Dangrangto',
  'osad': 'OSAD',
  'only-c': 'Only C',
  'lou-hoang': 'Lou Hoàng',
  'miu-le': 'Miu Lê',
  'trinh-thang-binh': 'Trịnh Thăng Bình',
  'le-bao-binh': 'Lê Bảo Bình',
  'ho-quang-hieu': 'Hồ Quang Hiếu',
  'ung-hoang-phuc': 'Ưng Hoàng Phúc',
  'dan-truong': 'Đan Trường',
  'cam-ly': 'Cẩm Ly',
  'dam-vinh-hung': 'Đàm Vĩnh Hưng',
  'nhu-quynh': 'Như Quỳnh',
  'manh-quynh': 'Mạnh Quỳnh',
  'phi-nhung': 'Phi Nhung',
  'dan-nguyen': 'Đan Nguyên',
  'tuan-vu': 'Tuấn Vũ',
  'che-linh': 'Chế Linh',
  'khanh-ly': 'Khánh Ly',
  'tuan-ngoc': 'Tuấn Ngọc',
  'ngoc-son': 'Ngọc Sơn',
  'duong-domic': 'Dương Domic',
  'hurrykng': 'HURRYKNG',
  'rhyder': 'RHYDER',
  'captain': 'CAPTAIN',
  'negav': 'NEGAV',
  'jsol': 'JSOL',
  'erik': 'ERIK',
  'min': 'MIN',
  'orange': 'Orange',
  'lyly': 'LyLy',
  'juky-san': 'Juky San',
  'bui-cong-nam': 'Bùi Công Nam',
  'tang-duy-tan': 'Tăng Duy Tân',
  'hoang-thuy-linh': 'Hoàng Thùy Linh',
  'truc-nhan': 'Trúc Nhân',
  'bao-anh': 'Bảo Anh',
  'huong-tram': 'Hương Tràm',
  'khac-viet': 'Khắc Việt',
  'vu-cat-tuong': 'Vũ Cát Tường',
  'tien-tien': 'Tiên Tiên',
  'bui-anh-tuan': 'Bùi Anh Tuấn',
  'hoai-lam': 'Hoài Lâm',
  'phuc-du': 'Phúc Du',
  'bigdaddy': 'BigDaddy',
  'emily': 'Emily',
  'kai-dinh': 'Kai Đinh',
  'thai-dinh': 'Thái Đinh',
  'kien': 'Kiên',
  'jack-j97': 'Jack - J97',
  'k-icm': 'K-ICM',
  'jung-kook': 'Jung Kook',
  'latto': 'Latto',
  'vu': 'Vũ.',
  'kimmese': 'Kimmese',
  'yanbi': 'Yanbi',
  'hoang-ton': 'Hoàng Tôn',
  'dsmall': 'Dsmall',
  'xuan-nghi': 'Xuân Nghi',
  'trang': 'Trang',
  'madihu': 'Madihu',
  'my-anh': 'Mỹ Anh',
  'mac-mai-suong': 'Mạc Mai Sương',
  'hooligan': 'Hooligan.',
  'garrett-crosby': 'Garrett Crosby',
  'captain-boy': 'CAPTAIN BOY',
  'phap-kieu': 'Pháp Kiều',
  'coolkid': 'CoolKid',
  'danny-chung': 'Danny Chung',
  'xuan-dinh-k-y': 'Xuân Định K.Y',
  'hyo': 'HYO',
  'tdk': 'TDK',
  'minsicko': 'Minsicko',
  'baby-sam': 'Baby Sam',
  'vine': 'Vine',
  'hoang-yen-chibi': 'Hoàng Yến Chibi',
  'andree-right-hand': 'Andree Right Hand',
  'ali-hoang-duong': 'Ali Hoàng Dương',
  'ho-ngoc-ha': 'Hồ Ngọc Hà',
  'hang-bingboong': 'Hằng BingBoong',
  'vu-duy-khanh': 'Vũ Duy Khánh',
  'doan-hieu': 'Doãn Hiếu',
  'freak-d': 'Freak D',
  'masew': 'Masew',
  'anh-trai-vuot-ngan-chong-gai': 'Anh Trai Vượt Ngàn Chông Gai',
  '24k-right': '24k.Right',
  '2pillz': '2Pillz',
  '7dnight': '7dnight',
  'ban-nhac': 'Bạn Nhạc.',
  'thanh-hung': 'Thành Hưng',
  'hoang-green': 'Hoàng Green',
};

const VIETNAMESE_TITLE_DICTIONARY: Record<
  string,
  { title: string; artist?: string; genre?: string }
> = {
  'du cho mai ve sau': { title: 'Dù Cho Mai Về Sau', artist: 'buitruonglinh', genre: 'V-Pop' },
  'du cho mai ve sau acoustic version': {
    title: 'Dù Cho Mai Về Sau (Acoustic Version)',
    artist: 'buitruonglinh',
    genre: 'Ballad',
  },
  'du cho mai ve sau instrumental': {
    title: 'Dù Cho Mai Về Sau (Instrumental)',
    artist: 'buitruonglinh',
    genre: 'Ballad',
  },
  'tung buoc cham 100 buoc': {
    title: 'Từng Bước Chậm 100 Bước',
    artist: 'buitruonglinh',
    genre: 'V-Pop',
  },
  'em a': { title: 'Em À', artist: 'buitruonglinh', genre: 'V-Pop' },
  'cho em gan anh them chut nua feat. hoai sa': {
    title: 'Cho Em Gần Anh Thêm Chút Nữa (feat. Hoài Sa)',
    artist: 'Lệ Quyên',
    genre: 'Ballad',
  },
  'cho em gan anh them chut nua feat hoai sa': {
    title: 'Cho Em Gần Anh Thêm Chút Nữa (feat. Hoài Sa)',
    artist: 'Lệ Quyên',
    genre: 'Ballad',
  },
  'cho em gan anh them chut nua': {
    title: 'Cho Em Gần Anh Thêm Chút Nữa',
    artist: 'Lệ Quyên',
    genre: 'Ballad',
  },
  'giac mo co that': { title: 'Giấc Mơ Có Thật', artist: 'Lệ Quyên', genre: 'Ballad' },
  'tinh lo': { title: 'Tình Lỡ', artist: 'Lệ Quyên', genre: 'Ballad' },
  'e nho mot thoi ta a yeu': {
    title: 'Để Nhớ Một Thời Ta Đã Yêu',
    artist: 'Bằng Kiều',
    genre: 'Ballad',
  },
  'de nho mot thoi ta da yeu': {
    title: 'Để Nhớ Một Thời Ta Đã Yêu',
    artist: 'Bằng Kiều',
    genre: 'Ballad',
  },
  'sau tim thiep hong': {
    title: 'Sầu Tím Thiệp Hồng',
    artist: 'Lệ Quyên, Quang Lê',
    genre: 'Ballad',
  },
  'duyen phan': { title: 'Duyên Phận', artist: 'Lệ Quyên', genre: 'Ballad' },
  'vung la me bay': { title: 'Vùng Lá Me Bay', genre: 'Ballad' },
  'nhu mot nguoi dung': { title: 'Như Một Người Dưng', genre: 'V-Pop' },
  'nhu mot nguoi rung': { title: 'Như Một Người Dưng', genre: 'V-Pop' },
  'thien menh': { title: 'Thiên Mệnh', genre: 'V-Pop' },
  'anh van o day': { title: 'Anh Vẫn Ở Đây', genre: 'V-Pop' },
  'anh van o ay': { title: 'Anh Vẫn Ở Đây', genre: 'V-Pop' },
  'de danh khi thuc giac': { title: 'Để Dành Khi Thức Giấc', genre: 'Indie' },
  'e danh khi thuc giac': { title: 'Để Dành Khi Thức Giấc', genre: 'Indie' },
  'de danh cho em': { title: 'để dành cho em', genre: 'Hip-Hop' },
  'e danh cho em': { title: 'để dành cho em', genre: 'Hip-Hop' },
  'the gioi cua anh': { title: 'thế giới của anh', genre: 'Hip-Hop' },
  'nhung lo au ay': { title: 'Những Lo Âu Ấy', artist: 'Đạt G', genre: 'Lo-Fi & Chill' },
  'den da khong duong': { title: 'Đen Đá Không Đường', artist: 'AMEE', genre: 'V-Pop' },
  'anh nha o dau the': { title: 'Anh Nhà Ở Đâu Thế', artist: 'AMEE', genre: 'V-Pop' },
  'yeu thi yeu khong yeu thi yeu': {
    title: 'Yêu Thì Yêu Không Yêu Thì Yêu',
    artist: 'AMEE',
    genre: 'V-Pop',
  },
  'mama boy': { title: 'Mama Boy', artist: 'AMEE', genre: 'V-Pop' },
  'dreamee intro': { title: 'Dreamee (Intro)', artist: 'AMEE', genre: 'V-Pop' },
  'du tien': { title: 'Đủ Tiền', artist: 'B Ray', genre: 'Hip-Hop' },
  'do for love': { title: 'Do For Love', artist: 'B Ray, AMEE', genre: 'Hip-Hop' },
  'guong mat la lam': { title: 'Gương Mặt Lạ Lẫm', artist: 'Mr. Siro', genre: 'Ballad' },
  'chi co mot nguoi de yeu tren the gian': {
    title: 'Chỉ Có Một Người Để Yêu Trên Thế Gian',
    artist: 'Mr. Siro',
    genre: 'Ballad',
  },
  'me hieu con khong': { title: 'Mẹ Hiểu Con Không', artist: 'Mr. Siro', genre: 'Ballad' },
  'nguyen lam tri ky': { title: 'Nguyện Làm Tri Kỷ', artist: 'Mr. Siro', genre: 'Ballad' },
  'catch me if you can': { title: 'Catch Me If You Can', genre: 'V-Pop' },
};

const VERSION_SUFFIX_LABELS: Array<{ slug: string; label: string; genreHint?: string }> = [
  { slug: 'lofi-version', label: '(Lo-Fi Ver.)', genreHint: 'Lo-Fi & Chill' },
  { slug: 'lofi-ver', label: '(Lo-Fi Ver.)', genreHint: 'Lo-Fi & Chill' },
  { slug: 'lo-fi-ver', label: '(Lo-Fi Ver.)', genreHint: 'Lo-Fi & Chill' },
  { slug: 'lofi', label: '(Lo-Fi)', genreHint: 'Lo-Fi & Chill' },
  { slug: 'acoustic-version', label: '(Acoustic Version)', genreHint: 'Ballad' },
  { slug: 'acoustic-ver', label: '(Acoustic Ver.)', genreHint: 'Ballad' },
  { slug: 'acoustic', label: '(Acoustic)', genreHint: 'Ballad' },
  { slug: 'piano-version', label: '(Piano Version)', genreHint: 'Ballad' },
  { slug: 'piano-ver', label: '(Piano Ver.)', genreHint: 'Ballad' },
  { slug: 'instrumental', label: '(Instrumental)', genreHint: 'Ballad' },
  { slug: 'explicit-ver', label: '(Explicit Ver.)' },
  { slug: 'remix', label: '(Remix)', genreHint: 'EDM / Electronic' },
  { slug: 'beat', label: '(Beat)' },
  { slug: 'live', label: '(Live)' },
];

const LOWERCASE_TITLE_WORDS = new Set(['of', 'the', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'a', 'an']);

function toSmartTitleCase(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, idx) => {
      if (word.toUpperCase() === word && word.length >= 2 && word.length <= 5 && /^[A-Z0-9]+$/.test(word)) {
        return word;
      }
      const lower = word.toLowerCase();
      if (idx > 0 && LOWERCASE_TITLE_WORDS.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export function buildArtistSlugDictionaryFromTracks(
  tracks: Array<{ artist?: string }>
): Record<string, string> {
  const map: Record<string, string> = { ...VIETNAMESE_ARTIST_DICTIONARY };
  for (const t of tracks) {
    const rawArtist = (t.artist || '').trim();
    if (!rawArtist || isRawSlugDisplayText(rawArtist)) continue;
    const parts = rawArtist
      .split(/(?:,|&|;|\/|\bfeat\.?\b|\bft\.?\b)/i)
      .map(s => s.trim())
      .filter(Boolean);
    for (const part of parts) {
      const slug = slugifyArtistLookup(part);
      if (slug && slug.length >= 3 && !map[slug]) {
        map[slug] = part;
      }
    }
  }
  return map;
}

export function parseAndCleanSlugTrack(
  rawTitle: string,
  rawArtist: string,
  artistDict: Record<string, string> = VIETNAMESE_ARTIST_DICTIONARY
): { title: string; artist: string; genreHint?: string } {
  let cleanTitleInput = (rawTitle || '').replace(/\.(mp3|wav|flac|m4a|ogg|aac|opus)$/i, '').trim();
  cleanTitleInput = cleanTitleInput.replace(/-\d{10,}$/, '').replace(/-[0-9a-f]{8}$/i, '').trim();

  const currentArtist = (rawArtist || '').trim();
  const hasPlaceholderArtist =
    !currentArtist ||
    PLACEHOLDER_ARTISTS.has(normalizeAsciiText(currentArtist)) ||
    isRawSlugDisplayText(currentArtist);

  const spaceKey = cleanTitleInput
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const spaceKeyAlpha = spaceKey.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  const directDictMatch =
    VIETNAMESE_TITLE_DICTIONARY[spaceKey] ||
    VIETNAMESE_TITLE_DICTIONARY[spaceKeyAlpha];

  if (directDictMatch && isRawSlugDisplayText(cleanTitleInput)) {
    const resolvedArtist = !hasPlaceholderArtist
      ? currentArtist
      : directDictMatch.artist || 'Nghệ sĩ chưa rõ';
    return {
      title: directDictMatch.title,
      artist: resolvedArtist,
      genreHint: directDictMatch.genre,
    };
  }

  if (isHyphenFilenameSlug(cleanTitleInput) || cleanTitleInput.includes('_')) {
    let workingSlug = cleanTitleInput
      .toLowerCase()
      .replace(/_/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    const sortedArtistSlugs = Object.keys(artistDict).sort((a, b) => b.length - a.length);
    const extractedArtists: string[] = [];

    for (let pass = 0; pass < 3; pass++) {
      let matchedPrefix = false;
      for (const aSlug of sortedArtistSlugs) {
        if (workingSlug.startsWith(`${aSlug}-`) && workingSlug.length > aSlug.length + 2) {
          const displayArtist = artistDict[aSlug];
          if (displayArtist && !extractedArtists.includes(displayArtist)) {
            extractedArtists.push(displayArtist);
          }
          workingSlug = workingSlug.slice(aSlug.length + 1);
          matchedPrefix = true;
          break;
        }
      }
      if (!matchedPrefix) break;
    }

    const versionLabels: string[] = [];
    let genreHint: string | undefined;
    let foundVersion = true;
    while (foundVersion) {
      foundVersion = false;
      for (const v of VERSION_SUFFIX_LABELS) {
        if (workingSlug.endsWith(`-${v.slug}`) && workingSlug.length > v.slug.length + 2) {
          versionLabels.unshift(v.label);
          if (v.genreHint && !genreHint) genreHint = v.genreHint;
          workingSlug = workingSlug.slice(0, -(v.slug.length + 1));
          foundVersion = true;
          break;
        }
      }
    }

    let featLabel = '';
    const featIdxMatch = workingSlug.match(/-(?:feat|ft|featuring)-(.+)$/);
    if (featIdxMatch && featIdxMatch[1]) {
      const featSlug = featIdxMatch[1];
      workingSlug = workingSlug.slice(0, featIdxMatch.index);
      const featDisplay =
        artistDict[featSlug] || toSmartTitleCase(featSlug.replace(/-/g, ' '));
      featLabel = `(feat. ${featDisplay})`;
    }

    const coreWords = workingSlug.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    const coreMatch = VIETNAMESE_TITLE_DICTIONARY[coreWords];
    const formattedCore = coreMatch ? coreMatch.title : toSmartTitleCase(coreWords);
    if (coreMatch?.genre && !genreHint) genreHint = coreMatch.genre;

    const finalTitle = [formattedCore, featLabel, ...versionLabels]
      .filter(Boolean)
      .join(' ')
      .trim();

    let finalArtist = currentArtist;
    if (hasPlaceholderArtist) {
      if (extractedArtists.length > 0) {
        finalArtist = extractedArtists.join(', ');
      } else if (coreMatch?.artist) {
        finalArtist = coreMatch.artist;
      } else {
        const artistSlugCheck = slugifyArtistLookup(currentArtist);
        if (artistDict[artistSlugCheck]) {
          finalArtist = artistDict[artistSlugCheck];
        }
      }
    }

    return {
      title: finalTitle || cleanTitleInput,
      artist: finalArtist || 'Nghệ sĩ chưa rõ',
      genreHint,
    };
  }

  let finalTitle = cleanTitleInput;
  if (isRawSlugDisplayText(cleanTitleInput)) {
    finalTitle = directDictMatch ? directDictMatch.title : toSmartTitleCase(spaceKey);
  }

  let finalArtist = currentArtist;
  const artistSlugKey = slugifyArtistLookup(currentArtist);
  if (artistDict[artistSlugKey] && isRawSlugDisplayText(currentArtist)) {
    finalArtist = artistDict[artistSlugKey];
  } else if (directDictMatch?.artist && hasPlaceholderArtist) {
    finalArtist = directDictMatch.artist;
  } else if (!hasPlaceholderArtist && isRawSlugDisplayText(currentArtist)) {
    finalArtist = toSmartTitleCase(currentArtist.replace(/[-_]+/g, ' '));
  }

  return {
    title: finalTitle || rawTitle,
    artist: finalArtist || rawArtist,
    genreHint: directDictMatch?.genre,
  };
}

export function restoreVietnameseMetadataFromSlug(
  rawTitle: string,
  rawArtist: string,
  artistDict: Record<string, string> = VIETNAMESE_ARTIST_DICTIONARY
): { title: string; artist: string; genreHint?: string } {
  return parseAndCleanSlugTrack(rawTitle, rawArtist, artistDict);
}

export function fallbackClassify(
  items: ClassifyInputTrack[]
): ClassifiedTrackResult[] {
  return items.map(item => {
    const rawName = item.title && item.title !== 'Bài hát không tên' ? item.title : item.fileName || 'Bài hát không tên';
    const clean = rawName.replace(/\.[^/.]+$/, '');
    let artist =
      item.artist && item.artist !== 'Chờ AI nhận diện...'
        ? item.artist
        : 'Nghệ sĩ chưa rõ';
    let title = clean;

    if (clean.includes(' - ')) {
      const parts = clean.split(' - ');
      if (parts.length >= 2) {
        const potentialArtist = parts[0].replace(/^[0-9.\s]+/, '').trim();
        const potentialTitle = parts.slice(1).join(' - ').trim();
        if (potentialArtist && isRawSlugDisplayText(artist)) {
          artist = potentialArtist;
        }
        if (potentialTitle) title = potentialTitle;
      }
    }

    const restored = parseAndCleanSlugTrack(title, artist);
    title = restored.title;
    artist = restored.artist;

    const lower = (title + ' ' + artist).toLowerCase();
    let genre = restored.genreHint || 'Pop';
    if (
      lower.includes('rap') ||
      lower.includes('hiphop') ||
      lower.includes('trap') ||
      lower.includes('đọc rap') ||
      lower.includes('b ray') ||
      lower.includes('mck') ||
      lower.includes('hieuthuhai')
    ) {
      genre = 'Hip-Hop';
    } else if (
      lower.includes('lofi') ||
      lower.includes('lo-fi') ||
      lower.includes('chill') ||
      lower.includes('sleep') ||
      lower.includes('thư giãn') ||
      lower.includes('nhẹ nhàng')
    ) {
      genre = 'Lo-Fi & Chill';
    } else if (
      lower.includes('ballad') ||
      lower.includes('acoustic') ||
      lower.includes('piano') ||
      lower.includes('mr. siro') ||
      lower.includes('lệ quyên') ||
      lower.includes('bằng kiều') ||
      lower.includes('quang lê') ||
      lower.includes('buitruonglinh') ||
      lower.includes('buồn') ||
      lower.includes('suy') ||
      lower.includes('tình lỡ') ||
      lower.includes('đau') ||
      lower.includes('khóc') ||
      lower.includes('mưa') ||
      lower.includes('đêm') ||
      lower.includes('nhớ') ||
      lower.includes('tự sự')
    ) {
      genre = 'Ballad';
    } else if (lower.includes('rock') || lower.includes('metal') || lower.includes('guitar điện')) {
      genre = 'Rock';
    } else if (
      lower.includes('edm') ||
      lower.includes('remix') ||
      lower.includes('dance') ||
      lower.includes('house') ||
      lower.includes('bass')
    ) {
      genre = 'EDM / Electronic';
    } else if (lower.includes('r&b') || lower.includes('soul') || lower.includes('rnb')) {
      genre = 'R&B';
    } else if (lower.includes('jazz')) {
      genre = 'Jazz';
    } else if (lower.includes('classical') || lower.includes('không lời')) {
      genre = 'Classical';
    } else if (lower.includes('indie') || lower.includes('folk') || lower.includes('underground')) {
      genre = 'Indie';
    } else if (lower.includes('vpop') || lower.includes('nhạc trẻ')) {
      genre = 'V-Pop';
    }

    return {
      id: item.id,
      genre,
      mood: 'Thư giãn & Dễ chịu',
      bpm: 110,
      suggestedTitle: title,
      suggestedArtist: artist,
      reason: 'Phân loại tự động & khôi phục dấu tiếng Việt thông minh Soundly AI.',
    };
  });
}

export async function classifyBatchWithGemini(
  items: ClassifyInputTrack[]
): Promise<ClassifiedTrackResult[]> {
  const ai = getGeminiClient();
  if (!ai) {
    return fallbackClassify(items);
  }

  try {
    const allowedGenresList = SPOTIFY_GENRE_NAMES.join(', ');

    const processedItems = items.map(item => {
      const parsed = parseAndCleanSlugTrack(
        item.title && item.title !== 'Bài hát không tên' ? item.title : item.fileName || '',
        item.artist || ''
      );
      const cleanTitle = parsed.title || item.title || '';
      const artist =
        parsed.artist && parsed.artist !== 'Nghệ sĩ chưa rõ' ? parsed.artist : '';
      const searchQuery = artist ? `${artist} - ${cleanTitle}` : cleanTitle;
      return {
        id: item.id,
        searchQuery,
        artistHint: artist,
        album: item.album || '',
      };
    });

    const prompt = `Bạn là chuyên gia phân loại âm nhạc (Music Curator AI) am hiểu sâu sắc nhạc Việt Nam (V-Pop, Ballad, Bolero, Indie, Rap Việt) và nhạc quốc tế.
Hãy phân tích danh sách bài hát bên dưới dựa trên 'searchQuery' (tên bài hát và nghệ sĩ đã làm sạch) và 'artistHint' bằng cách sử dụng Google Search Grounding để xác minh chính xác:
1. Tên bài hát gốc chuẩn có dấu tiếng Việt và viết hoa đúng (suggestedTitle).
2. Tên nghệ sĩ chính xác có dấu (suggestedArtist).
3. Thể loại chuẩn (genre) trong danh sách cho phép.
4. Tâm trạng (mood), nhịp độ (bpm), và lý do (reason).

LƯU Ý QUAN TRỌNG:
- Nếu searchQuery vẫn chưa có dấu tiếng Việt đầy đủ (ví dụ: "buitruonglinh - Tung Buoc Cham 100 Buoc" hoặc "Mr. Siro - Guong Mat La Lam"), hãy tra cứu để trả về tên bài hát có dấu tiếng Việt chuẩn xác ("Từng Bước Chậm 100 Bước", "Gương Mặt Lạ Lẫm").
- Giữ định dạng gọn đẹp cho phiên bản nếu có: "(feat. ...)", "(Lo-Fi Ver.)", "(Acoustic Version)", "(Piano Version)", "(Remix)", "(Beat)".

DANH SÁCH THỂ LOẠI CHUẨN BẮT BUỘC (chỉ chọn 1 trong các giá trị sau cho trường genre):
[${allowedGenresList}]

Yêu cầu cho từng bài hát:
1. "id": Giữ nguyên id gốc của bài hát.
2. "genre": Chọn chính xác 1 thể loại phù hợp nhất trong danh sách ở trên.
3. "suggestedArtist": Tên nghệ sĩ/tác giả có đầy đủ dấu tiếng Việt chuẩn.
4. "suggestedTitle": Tên bài hát sạch đẹp, chuẩn có dấu tiếng Việt.
5. "mood": Tâm trạng ngắn gọn bằng tiếng Việt (ví dụ: "Sâu lắng & Tự sự", "Thư giãn & Chill", "Lãng mạn", "Sôi động").
6. "bpm": Ước lượng nhịp BPM (số nguyên từ 60 đến 180).
7. "reason": Giải thích ngắn gọn 1 câu bằng tiếng Việt lý do chọn thể loại này.

Danh sách bài hát cần phân loại:
${JSON.stringify(processedItems, null, 2)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction:
          'You are a precise Spotify music genre classifier and metadata parser with real-time Google Search grounding. Use Google Search to verify song title diacritics, artist, and genre whenever needed. Always return valid JSON matching the schema and strictly pick genres from the provided allowlist.',
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              genre: { type: Type.STRING },
              mood: { type: Type.STRING },
              bpm: { type: Type.INTEGER },
              suggestedTitle: { type: Type.STRING },
              suggestedArtist: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: [
              'id',
              'genre',
              'mood',
              'bpm',
              'suggestedTitle',
              'suggestedArtist',
              'reason',
            ],
          },
        },
      },
    });

    const rawText = (response.text ?? '[]').trim();
    const parsed = JSON.parse(rawText) as ClassifiedTrackResult[];

    return parsed.map(item => {
      const matchedGenre =
        SPOTIFY_GENRE_NAMES.find(
          g => g.toLowerCase() === (item.genre || '').toLowerCase()
        ) || 'Pop';
      return {
        ...item,
        genre: matchedGenre,
        bpm: Number.isFinite(item.bpm) ? item.bpm : 110,
        suggestedTitle: item.suggestedTitle || 'Bài hát',
        suggestedArtist: item.suggestedArtist || 'Nghệ sĩ chưa rõ',
      };
    });
  } catch (err) {
    console.warn(
      'Gemini AI classification encountered error, using smart fallback:',
      err
    );
    return fallbackClassify(items);
  }
}
