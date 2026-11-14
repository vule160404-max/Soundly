import { Track } from '../types/music';

const PLACEHOLDER_ARTISTS = new Set([
  'nghe si chua ro',
  'nghe si spotflow',
  'cho ai nhan dien',
  'unknown artist',
  'various artists',
]);

export function normalizeVietnameseText(raw?: string | null): string {
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

export function extractFeaturedFromTitle(rawTitle?: string | null): {
  cleanTitle: string;
  featuredArtists: string[];
} {
  const title = (rawTitle || '').trim();
  if (!title) return { cleanTitle: '', featuredArtists: [] };

  const featuredArtists: string[] = [];
  const featRegex = /(?:\(|\[)?\b(?:feat\.?|ft\.?|featuring)\s+([^)\]]+)(?:\)|\])?/gi;
  let match: RegExpExecArray | null;
  while ((match = featRegex.exec(title)) !== null) {
    if (match[1]) {
      featuredArtists.push(match[1].trim());
    }
  }

  const withoutFeat = title
    .replace(/(?:\(|\[)?\b(?:feat\.?|ft\.?|featuring)\s+[^)\]]+(?:\)|\])?/gi, ' ')
    .replace(/\b(?:official\s+mv|official\s+music\s+video|official\s+video|official\s+audio|lyric\s+video|lyrics\s+video|audio|mv|320kbps|128kbps)\b/gi, ' ')
    .replace(/\.(mp3|wav|flac|m4a|ogg|aac|opus)$/i, ' ')
    .replace(/^[0-9]{1,3}[\s._-]+/, '');

  return {
    cleanTitle: normalizeVietnameseText(withoutFeat),
    featuredArtists,
  };
}

export function normalizeTrackTitle(rawTitle?: string | null): string {
  const { cleanTitle } = extractFeaturedFromTitle(rawTitle);
  return cleanTitle || normalizeVietnameseText(rawTitle);
}

export function extractNormalizedArtistTokens(
  rawArtist?: string | null,
  rawTitle?: string | null
): string[] {
  const { featuredArtists } = extractFeaturedFromTitle(rawTitle);
  const combined = [rawArtist || '', ...featuredArtists].join(', ');

  const parts = combined
    .split(/(?:,|&|;|\/|\bx\b|\bvs\.?\b|\bfeat\.?\b|\bft\.?\b|\bwith\b|\band\b|\bva\b)/i)
    .map(p => normalizeVietnameseText(p))
    .filter(p => p.length > 0 && !PLACEHOLDER_ARTISTS.has(p));

  return Array.from(new Set(parts)).sort();
}

export function isR2AudioUrl(audioUrl?: string | null): boolean {
  if (!audioUrl || typeof audioUrl !== 'string') return false;
  const trimmed = audioUrl.trim();
  return (
    trimmed.includes('/api/r2/stream') ||
    trimmed.includes('.r2.dev/') ||
    trimmed.includes('.r2.cloudflarestorage.com/')
  );
}

export function isExpiredExternalAudioUrl(audioUrl?: string | null): boolean {
  if (!audioUrl || typeof audioUrl !== 'string') return false;
  const trimmed = audioUrl.trim();
  return (
    trimmed.startsWith('blob:') ||
    trimmed.includes('/api/download/file/') ||
    trimmed.includes('onrender.com')
  );
}

export function areArtistListsCompatible(
  tokensA: string[],
  tokensB: string[]
): boolean {
  if (tokensA.length === 0 || tokensB.length === 0) {
    return true;
  }
  if (tokensA.join('|') === tokensB.join('|')) {
    return true;
  }
  for (const a of tokensA) {
    for (const b of tokensB) {
      if (a === b) return true;
      if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) {
        return true;
      }
    }
  }
  return false;
}

const CLIENT_VIETNAMESE_ARTIST_MAP: Record<string, string> = {
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
  'taylor-swift': 'Taylor Swift',
  'the-weeknd': 'The Weeknd',
  'justin-bieber': 'Justin Bieber',
  'bruno-mars': 'Bruno Mars',
  'ariana-grande': 'Ariana Grande',
  'ed-sheeran': 'Ed Sheeran',
  'coldplay': 'Coldplay',
  'imagine-dragons': 'Imagine Dragons',
  'billie-eilish': 'Billie Eilish',
  'keshi': 'keshi',
  'charlie-puth': 'Charlie Puth',
  'shawn-mendes': 'Shawn Mendes',
  'dua-lipa': 'Dua Lipa',
  'maroon-5': 'Maroon 5',
  'alan-walker': 'Alan Walker',
  'harry-styles': 'Harry Styles',
  'christopher-wong': 'Christopher Wong',
  'ian-rees': 'Ian Rees',
  'sabrina-carpenter': 'Sabrina Carpenter',
  'olivia-rodrigo': 'Olivia Rodrigo',
  'post-malone': 'Post Malone',
  'cigarettes-after-sex': 'Cigarettes After Sex',
  'lana-del-rey': 'Lana Del Rey',
  'benson-boone': 'Benson Boone',
  'stephen-sanchez': 'Stephen Sanchez',
  'blackpink': 'BLACKPINK',
  'newjeans': 'NewJeans',
  'wave-to-earth': 'wave to earth',
  'adela': 'ADÉLA',
  'khoi-vu': 'Khôi Vũ',
  'duy-tuan': 'Duy Tuấn',
  'diep-lam-anh': 'Diệp Lâm Anh',
  'sony-tran': 'Sony Trần',
  'thuy-chi': 'Thùy Chi',
  'linh-cao': 'Linh Cáo',
  'quang-trung': 'Quang Trung',
  'tri-dung': 'Trí Dũng',
  'anh-phan': 'Anh Phan',
  'ngo-kien-huy': 'Ngô Kiến Huy',
  'dieu-nhi': 'Diệu Nhi',
  'son-lam': 'Sơn Lâm',
  'toc-tien': 'Tóc Tiên',
  'mai-tien-dung': 'Mai Tiến Dũng',
  'phuong-my-chi': 'Phương Mỹ Chi',
  'dong-nhi': 'Đông Nhi',
  'thu-minh': 'Thu Minh',
  'w-n': 'W/N',
  'marzuz': 'marzuz',
  'ronboogz': 'Ronboogz',
  'wean': 'WEAN',
  'vstra': 'VSTRA',
  '52hz': '52Hz',
  'coldzy': 'Coldzy',
};

const CLIENT_VIETNAMESE_TITLE_MAP: Record<
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
  'tung buoc cham 100 buoc': { title: 'Từng Bước Chậm 100 Bước', artist: 'buitruonglinh', genre: 'V-Pop' },
  'em a': { title: 'Em À', artist: 'buitruonglinh', genre: 'V-Pop' },
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
  'nhu mot nguoi dung': { title: 'Như Một Người Dưng', genre: 'V-Pop' },
  'nhu mot nguoi rung': { title: 'Như Một Người Dưng', genre: 'V-Pop' },
  'thien menh': { title: 'Thiên Mệnh', genre: 'V-Pop' },
  'anh van o day': { title: 'Anh Vẫn Ở Đây', genre: 'V-Pop' },
  'anh van o ay': { title: 'Anh Vẫn Ở Đây', genre: 'V-Pop' },
  'de danh khi thuc giac': { title: 'Để Dành Khi Thức Giấc', genre: 'Indie' },
  'e danh khi thuc giac': { title: 'Để Dành Khi Thức Giấc', genre: 'Indie' },
  'nhung lo au ay': { title: 'Những Lo Âu Ấy', artist: 'Đạt G', genre: 'Lo-Fi & Chill' },
  'den da khong duong': { title: 'Đen Đá Không Đường', artist: 'AMEE', genre: 'V-Pop' },
  'anh nha o dau the': { title: 'Anh Nhà Ở Đâu Thế', artist: 'AMEE', genre: 'V-Pop' },
  'yeu thi yeu khong yeu thi yeu': { title: 'Yêu Thì Yêu Không Yêu Thì Yêu', artist: 'AMEE', genre: 'V-Pop' },
  'mama boy': { title: 'Mama Boy', artist: 'AMEE', genre: 'V-Pop' },
  'dreamee intro': { title: 'Dreamee (Intro)', artist: 'AMEE', genre: 'V-Pop' },
  'du tien': { title: 'Đủ Tiền', artist: 'B Ray', genre: 'Hip-Hop' },
  'do for love': { title: 'Do For Love', artist: 'B Ray, AMEE', genre: 'Hip-Hop' },
  'guong mat la lam': { title: 'Gương Mặt Lạ Lẫm', artist: 'Mr. Siro', genre: 'Ballad' },
  'chi co mot nguoi de yeu tren the gian': { title: 'Chỉ Có Một Người Để Yêu Trên Thế Gian', artist: 'Mr. Siro', genre: 'Ballad' },
  'me hieu con khong': { title: 'Mẹ Hiểu Con Không', artist: 'Mr. Siro', genre: 'Ballad' },
  'nguyen lam tri ky': { title: 'Nguyện Làm Tri Kỷ', artist: 'Mr. Siro', genre: 'Ballad' },
  'catch me if you can': { title: 'Catch Me If You Can', genre: 'V-Pop' },
  'vut tan': { title: 'Vụt Tan', artist: 'SOOBIN', genre: 'V-Pop' },
  'vui di em': { title: 'Vui Đi Em', artist: 'SOOBIN', genre: 'V-Pop' },
  've khoi': { title: 'Vẽ Khói', artist: 'SOOBIN', genre: 'V-Pop' },
  'vai lan don dua': { title: 'Vài Lần Đón Đưa', artist: 'SOOBIN', genre: 'V-Pop' },
  'tim lai reu phong': { title: 'Tìm Lại Rêu Phong', artist: 'SOOBIN', genre: 'Rock' },
  'di va yeu': { title: 'Đi Và Yêu', artist: 'SOOBIN', genre: 'V-Pop' },
  'chuyen chang co don': { title: 'Chuyện Chẳng Cô Đơn', artist: 'SOOBIN', genre: 'Ballad' },
  'chi toi': { title: 'Chị Tôi', artist: 'SOOBIN', genre: 'Ballad' },
  'ai kho vi ai': { title: 'Ai Khổ Vì Ai', artist: 'SOOBIN', genre: 'Ballad' },
  'lang tham': { title: 'Lặng Thầm', artist: 'Thùy Chi', genre: 'Ballad' },
  'gan ngay truoc mat': { title: 'Gần Ngay Trước Mặt', artist: 'Thùy Chi', genre: 'Ballad' },
  'chac co le': { title: 'Chắc Có Lẽ', artist: 'Thùy Chi', genre: 'Ballad' },
  'chim sau': { title: 'Chìm Sâu', artist: 'Sony Trần', genre: 'Hip-Hop' },
  'ngay tho': { title: 'Ngây Thơ', genre: 'V-Pop' },
  'xmas day em dau': { title: 'Xmas Day, Em Đâu', genre: 'V-Pop' },
  'vut': { title: 'Vụt', genre: 'Hip-Hop' },
  'lam lanh chua tinh': { title: 'Làm Lành Chữa Tình', genre: 'V-Pop' },
  'that qua dang de yeu': { title: 'Thật Quá Đáng.. Để Yêu', genre: 'V-Pop' },
  'doi it thoi om de': { title: 'Dỗi Ít Thôi Ôm Đê', genre: 'V-Pop' },
  'ngongiodemquatrangsangdemnay': { title: 'Ngọn Gió Đêm Qua Trăng Sáng Đêm Nay', artist: 'RPT MCK, marzuz', genre: 'V-Pop' },
  'haydeanhduoccungemdau': { title: 'Hãy Để Anh Được Cùng Em Đau', artist: 'SIVAN, Kai Đinh', genre: 'Lo-Fi & Chill' },
  'toidaidot': { title: 'Tôi Dại Dột', artist: 'GREY D', genre: 'Ballad' },
  'van': { title: 'Vẫn', artist: 'Bích Phương', genre: 'Ballad' },
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

export function isHyphenFilenameSlug(text?: string | null): boolean {
  if (!text) return false;
  const t = text.trim();
  if (!t || /\s/.test(t)) return false;
  if (/[^\u0000-\u007f]/.test(t)) return false;
  const segments = t.split('-').filter(Boolean);
  return segments.length >= 2;
}

export function isRawSlugDisplayText(text?: string | null): boolean {
  if (!text || !text.trim()) return true;
  const t = text.trim();
  if (PLACEHOLDER_ARTISTS.has(normalizeVietnameseText(t))) return true;
  if (t.includes('_') || isHyphenFilenameSlug(t)) return true;
  return !/[^\u0000-\u007f]/.test(t) && t === t.toLowerCase();
}

export function buildArtistSlugDictionary(tracks: Track[]): Record<string, string> {
  const map: Record<string, string> = { ...CLIENT_VIETNAMESE_ARTIST_MAP };
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
  artistDict: Record<string, string> = CLIENT_VIETNAMESE_ARTIST_MAP
): { title: string; artist: string; genreHint?: string } {
  let cleanTitleInput = (rawTitle || '').replace(/\.(mp3|wav|flac|m4a|ogg|aac|opus)$/i, '').trim();
  cleanTitleInput = cleanTitleInput.replace(/-\d{10,}$/, '').replace(/-[0-9a-f]{8}$/i, '').trim();

  let currentArtist = (rawArtist || '').trim();
  const hasPlaceholderArtist =
    !currentArtist || PLACEHOLDER_ARTISTS.has(normalizeVietnameseText(currentArtist)) || isRawSlugDisplayText(currentArtist);

  // Fast space-separated lookup first (non-hyphenated titles)
  const spaceKey = cleanTitleInput
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const spaceKeyAlpha = spaceKey.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  const directDictMatch =
    CLIENT_VIETNAMESE_TITLE_MAP[spaceKey] ||
    CLIENT_VIETNAMESE_TITLE_MAP[spaceKeyAlpha];

  if (directDictMatch && isRawSlugDisplayText(cleanTitleInput)) {
    const resolvedArtist =
      !hasPlaceholderArtist
        ? currentArtist
        : directDictMatch.artist || 'Nghệ sĩ chưa rõ';
    return {
      title: directDictMatch.title,
      artist: resolvedArtist,
      genreHint: directDictMatch.genre,
    };
  }

  // Handle hyphenated filename slugs like:
  // "anh-trai-say-hi-quang-hung-masterd-catch-me-if-you-can-feat-quang-hung-m"
  // "mr-siro-guong-mat-la-lam-beat"
  // "b-ray-amee-do-for-love-feat-amee-lofi"
  if (isHyphenFilenameSlug(cleanTitleInput) || cleanTitleInput.includes('_')) {
    let workingSlug = cleanTitleInput
      .toLowerCase()
      .replace(/_/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    const sortedArtistSlugs = Object.keys(artistDict).sort((a, b) => b.length - a.length);
    const extractedArtists: string[] = [];

    // Greedily extract up to 3 artist prefixes from the front of the slug
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

    // Extract trailing version tags
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

    // Extract -feat- / -ft- inside slug
    let featLabel = '';
    const featIdxMatch = workingSlug.match(/-(?:feat|ft|featuring)-(.+)$/);
    if (featIdxMatch && featIdxMatch[1]) {
      const featSlug = featIdxMatch[1];
      workingSlug = workingSlug.slice(0, featIdxMatch.index);
      const featDisplay =
        artistDict[featSlug] ||
        toSmartTitleCase(featSlug.replace(/-/g, ' '));
      featLabel = `(feat. ${featDisplay})`;
    }

    const coreWords = workingSlug.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    const coreMatch = CLIENT_VIETNAMESE_TITLE_MAP[coreWords];
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

  // Non-hyphen lowercase title/artist cleanup
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

export function healArtistDisplayString(
  rawArtist: string,
  artistDict: Record<string, string> = CLIENT_VIETNAMESE_ARTIST_MAP
): string {
  const trimmed = (rawArtist || '').trim();
  if (!trimmed) return rawArtist;

  const wholeSlug = slugifyArtistLookup(trimmed);
  if (
    artistDict[wholeSlug] &&
    (isRawSlugDisplayText(trimmed) ||
      (!/[^\u0000-\u007f]/.test(trimmed) && /[^\u0000-\u007f]/.test(artistDict[wholeSlug])))
  ) {
    return artistDict[wholeSlug];
  }

  // Split preserving separators so multi-artist strings like "Wren Evans, Duy Tuan" -> "Wren Evans, Duy Tuấn"
  const tokens = trimmed.split(/(\s*,\s*|\s*&\s*|\s+ft\.?\s+|\s+feat\.?\s+)/i);
  let changed = false;
  const rebuilt = tokens.map(part => {
    if (!part || /^(\s*,\s*|\s*&\s*|\s+ft\.?\s+|\s+feat\.?\s+)$/i.test(part)) {
      return part;
    }
    const slug = slugifyArtistLookup(part);
    const mapped = artistDict[slug];
    if (!mapped) {
      if (isRawSlugDisplayText(part)) {
        changed = true;
        return toSmartTitleCase(part.replace(/[-_]+/g, ' '));
      }
      return part;
    }
    const partHasAccents = /[^\u0000-\u007f]/.test(part);
    const mappedHasAccents = /[^\u0000-\u007f]/.test(mapped);
    if ((!partHasAccents && mappedHasAccents) || isRawSlugDisplayText(part)) {
      if (mapped !== part) {
        changed = true;
        return mapped;
      }
    }
    return part;
  });

  return changed ? rebuilt.join('') : rawArtist;
}

function extractTrailingTitleQualifier(cleanTitle: string): {
  core: string;
  qualifier: string;
} {
  const suffixPatterns = [
    /\s+(-\s+(?:Original|Beat|Live|Remix|Lofi|Lo-Fi(?:\s+Ver(?:sion)?)?|Acoustic(?:\s+Version)?|Piano\s+Version|Ballad\s+Version|Instrumental|Sped\s+Up|Slowed|Chinese\s+Version|English\s+Version|EDM\s+Version|Unplugged|Duzme\s+Remix|Cukak\s+Remix|KProx\s+Remix|TB\s+Remix|Duy\s+Tuan\s+Remix))$/i,
    /\s+(\((?:Original|Beat|Live|Remix|Lofi|Lo-Fi(?:\s+Ver(?:sion)?)?|Acoustic(?:\s+Version)?|Piano\s+Version|Instrumental|Sped\s+Up|Slowed|Chinese\s+Version|English\s+Version|Unplugged)\))$/i,
  ];
  let working = cleanTitle.trim();
  const collected: string[] = [];
  let matched = true;
  while (matched) {
    matched = false;
    for (const pat of suffixPatterns) {
      const m = working.match(pat);
      if (m && m[1]) {
        collected.unshift(m[1].trim());
        working = working.slice(0, m.index).trim();
        matched = true;
        break;
      }
    }
  }
  return {
    core: working,
    qualifier: collected.join(' '),
  };
}

function isVietnameseArtistContext(artist: string): boolean {
  if (!artist) return false;
  if (/[ăâêôơưđàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i.test(artist)) {
    return true;
  }
  const lower = artist.toLowerCase();
  return /\b(soobin|b\s*ray|amee|buitruonglinh|bich\s*phuong|thuy\s*chi|mr\.?\s*siro|wren\s*evans|mono|tlinh|rpt\s*mck|hieuthuhai|low\s*g|grey\s*d|da\s*lab|ronboogz|dangrangto|hoang\s*dung|trung\s*quan|tang\s*duy\s*tan|kai\s*dinh|sivan)\b/i.test(lower);
}

export function healTrackVietnameseDisplay(
  track: Track,
  artistDict: Record<string, string> = CLIENT_VIETNAMESE_ARTIST_MAP
): Track {
  const healedArtist = healArtistDisplayString(track.artist || '', artistDict);
  const rawTitle = (track.title || '').trim();

  // 1) Check direct or version-stripped title dictionary match even if Title-Cased (e.g. "Vai Lan Don Dua", "Lang Tham - Original")
  const { core, qualifier } = extractTrailingTitleQualifier(rawTitle);
  const coreNorm = normalizeVietnameseText(core);
  const dictEntry = CLIENT_VIETNAMESE_TITLE_MAP[coreNorm];
  const isAmbiguousShortKey = coreNorm === 'van' || coreNorm === 'vut';
  const canApplyDictEntry =
    Boolean(dictEntry) &&
    (!isAmbiguousShortKey || isVietnameseArtistContext(healedArtist));

  if (canApplyDictEntry && dictEntry) {
    const nextTitle = qualifier ? `${dictEntry.title} ${qualifier}`.trim() : dictEntry.title;
    const isPlaceholderArtist =
      !healedArtist || PLACEHOLDER_ARTISTS.has(normalizeVietnameseText(healedArtist));
    const nextArtist =
      isPlaceholderArtist && dictEntry.artist ? dictEntry.artist : healedArtist || track.artist;
    const nextGenre =
      dictEntry.genre && (!track.genre || track.genre === 'Pop') ? dictEntry.genre : track.genre;

    if (
      nextTitle !== track.title ||
      nextArtist !== track.artist ||
      nextGenre !== track.genre
    ) {
      return {
        ...track,
        title: nextTitle,
        artist: nextArtist,
        genre: nextGenre,
      };
    }
    return track;
  }

  // 2) Normalize all-lowercase Vietnamese accented titles like "làm lành chữa tình" or "dỗi ít thôi ôm đê"
  if (
    rawTitle &&
    /[^\u0000-\u007f]/.test(rawTitle) &&
    rawTitle === rawTitle.toLowerCase() &&
    rawTitle.length >= 4
  ) {
    const titled = rawTitle
      .split(/\s+/)
      .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ');
    if (titled !== track.title || healedArtist !== track.artist) {
      return {
        ...track,
        title: titled,
        artist: healedArtist || track.artist,
      };
    }
  }

  // 3) Fallback slug parser when title or artist is raw slug/lowercase
  const needsTitleHeal = isRawSlugDisplayText(track.title);
  const needsArtistHeal = isRawSlugDisplayText(healedArtist);
  if (!needsTitleHeal && !needsArtistHeal) {
    if (healedArtist !== track.artist) {
      return { ...track, artist: healedArtist };
    }
    return track;
  }

  const parsed = parseAndCleanSlugTrack(track.title || '', healedArtist || '', artistDict);
  const nextTitle = parsed.title || track.title;
  const nextArtist = healArtistDisplayString(parsed.artist || healedArtist || track.artist || '', artistDict);
  const nextGenre =
    parsed.genreHint && (!track.genre || track.genre === 'Pop')
      ? parsed.genreHint
      : track.genre;

  if (
    nextTitle === track.title &&
    nextArtist === track.artist &&
    nextGenre === track.genre
  ) {
    return track;
  }

  return {
    ...track,
    title: nextTitle,
    artist: nextArtist,
    genre: nextGenre,
  };
}

const UNACCENTED_VN_TONE_WORDS_REGEX =
  /\b(nguoi|tinh|buon|nho|thuong|duyen|mua|dem|tuoi|minh|nhung|truoc|muon|giac|hoai|khuc|nhe|biet|quen|chac|phut|giay|thang|xuan|nang|troi|bien|trang|dau|lang\s+tham|gan\s+ngay|duoc|cung|khong|noi|duong|tien|guong|chuyen|chang|reu|don\s+dua|vut\s+tan|vui\s+di|kho\s+vi|ngay\s+tho|hanh\s+phuc|nuoc\s+mat|trai\s+tim|ky\s+uc|hoi\s+tiec|loi\s+xin|canh\s+cua|ngu\s+thuc|bao\s+gio|tam\s+trang|giac\s+mo|chim\s+sau|vai\s+lan)\b/i;

const UNACCENTED_VN_ARTIST_NAME_REGEX =
  /\b(phuc\s+du|khoi\s+vu|duy\s+tuan|diep\s+lam\s+anh|sony\s+tran|thuy\s+chi|bui\s+truong\s+linh|quang\s+hung|son\s+tung|hoa\s+minzy|bich\s+phuong|duc\s+phuc|hoang\s+dung|phan\s+manh\s+quynh|ha\s+anh\s+tuan|van\s+mai\s+huong|trung\s+quan|phuong\s+my\s+chi|tang\s*duy\s*tan|hoang\s+thuy\s+linh|truc\s+nhan)\b/i;

const ENGLISH_CONTRACTION_REGEX =
  /\b(?:don|won|can|ain|isn|aren|wasn|weren|haven|hasn|hadn|doesn|didn|wouldn|shouldn|couldn|mustn)['’]t\b/gi;

export function isUnaccentedVietnameseSuspicion(track: Pick<Track, 'title' | 'artist'>): boolean {
  const title = (track.title || '').trim();
  const artist = (track.artist || '').trim();

  const titleNoVnAccents =
    !/[ăâêôơưđàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i.test(title);
  const artistNoVnAccents =
    !/[ăâêôơưđàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i.test(artist);

  if (artistNoVnAccents && UNACCENTED_VN_ARTIST_NAME_REGEX.test(artist)) {
    return true;
  }
  if (titleNoVnAccents && (/haydeanhduoc|ngongiodemqua|toidaidot/i.test(title))) {
    return true;
  }
  const titleWithoutContractions = title.replace(ENGLISH_CONTRACTION_REGEX, ' ');
  if (
    titleNoVnAccents &&
    isVietnameseArtistContext(artist) &&
    UNACCENTED_VN_TONE_WORDS_REGEX.test(titleWithoutContractions)
  ) {
    return true;
  }
  return false;
}

function pickBetterDisplayString(a?: string, b?: string): string {
  const cleanA = (a || '').trim();
  const cleanB = (b || '').trim();
  if (!cleanA) return cleanB;
  if (!cleanB) return cleanA;

  const aHasDiacritics = /[^\u0000-\u007f]/.test(cleanA);
  const bHasDiacritics = /[^\u0000-\u007f]/.test(cleanB);
  if (aHasDiacritics && !bHasDiacritics) return cleanA;
  if (bHasDiacritics && !aHasDiacritics) return cleanB;

  const aIsSlug = isRawSlugDisplayText(cleanA);
  const bIsSlug = isRawSlugDisplayText(cleanB);
  if (!aIsSlug && bIsSlug) return cleanA;
  if (!bIsSlug && aIsSlug) return cleanB;

  return cleanA;
}

export function areTracksDuplicate(
  a: {
    id?: string;
    title?: string;
    artist?: string;
    audioUrl?: string;
    spotifyTrackId?: string;
  },
  b: {
    id?: string;
    title?: string;
    artist?: string;
    audioUrl?: string;
    spotifyTrackId?: string;
  }
): boolean {
  if (a.id && b.id && a.id === b.id) return true;
  if (
    a.spotifyTrackId &&
    b.spotifyTrackId &&
    a.spotifyTrackId.trim() === b.spotifyTrackId.trim()
  ) {
    return true;
  }
  if (
    a.audioUrl &&
    b.audioUrl &&
    !a.audioUrl.startsWith('blob:') &&
    a.audioUrl.trim() === b.audioUrl.trim()
  ) {
    return true;
  }

  const titleA = normalizeTrackTitle(a.title);
  const titleB = normalizeTrackTitle(b.title);
  if (!titleA || !titleB) return false;

  const exactTitleMatch = titleA === titleB;
  const dStrippedTitleMatch =
    !exactTitleMatch &&
    titleA.length >= 6 &&
    titleB.length >= 6 &&
    titleA.replace(/\bd/g, '').replace(/\s+/g, ' ').trim() ===
      titleB.replace(/\bd/g, '').replace(/\s+/g, ' ').trim();

  if (!exactTitleMatch && !dStrippedTitleMatch) {
    return false;
  }

  const artistsA = extractNormalizedArtistTokens(a.artist, a.title);
  const artistsB = extractNormalizedArtistTokens(b.artist, b.title);
  return areArtistListsCompatible(artistsA, artistsB);
}

export function findDuplicateTrack(
  candidate: {
    id?: string;
    title?: string;
    artist?: string;
    audioUrl?: string;
    spotifyTrackId?: string;
  },
  existingTracks: Track[]
): Track | null {
  let matchedFallback: Track | null = null;
  for (const existing of existingTracks) {
    if (areTracksDuplicate(candidate, existing)) {
      if (isR2AudioUrl(existing.audioUrl)) {
        return existing;
      }
      if (!matchedFallback) {
        matchedFallback = existing;
      }
    }
  }
  return matchedFallback;
}

export function mergeDuplicateTrackPair(primary: Track, secondary: Track): Track {
  const healedPrimary = healTrackVietnameseDisplay(primary);
  const healedSecondary = healTrackVietnameseDisplay(secondary);

  const primaryOnR2 = isR2AudioUrl(healedPrimary.audioUrl);
  const secondaryOnR2 = isR2AudioUrl(healedSecondary.audioUrl);

  const bestAudioTrack =
    primaryOnR2 || !secondaryOnR2 ? healedPrimary : healedSecondary;
  const otherTrack = bestAudioTrack === healedPrimary ? healedSecondary : healedPrimary;

  const hasBetterLyrics = (t: Track) =>
    Boolean(t.syncedLyrics?.trim()) ||
    Boolean(t.plainLyrics?.trim()) ||
    (Array.isArray(t.lyrics) &&
      t.lyrics.length > 2 &&
      !t.lyrics.every(l => l.text.startsWith('Đang phát bản nhạc') || l.text.startsWith('Đang phát:')));

  const lyricsSource = hasBetterLyrics(bestAudioTrack)
    ? bestAudioTrack
    : hasBetterLyrics(otherTrack)
      ? otherTrack
      : bestAudioTrack;

  const isDefaultCover = (url?: string) =>
    !url || url.includes('photo-1511671782779-c97d3d27a1d4') || url.includes('soundly-default-cover.svg');

  const bestCover = !isDefaultCover(bestAudioTrack.coverUrl)
    ? bestAudioTrack.coverUrl
    : !isDefaultCover(otherTrack.coverUrl)
      ? otherTrack.coverUrl
      : bestAudioTrack.coverUrl || otherTrack.coverUrl;

  const metaScore = (t: Track) =>
    (t.aiClassified ? 2 : 0) +
    (t.id3Checked ? 2 : 0) +
    (t.aiReason !== 'Khôi phục tự động từ Cloudflare R2' ? 1 : 0);

  const metaPrimary =
    metaScore(otherTrack) > metaScore(bestAudioTrack) ? otherTrack : bestAudioTrack;
  const metaSecondary = metaPrimary === bestAudioTrack ? otherTrack : bestAudioTrack;

  const bestTitle = pickBetterDisplayString(metaPrimary.title, metaSecondary.title);
  const bestArtist = pickBetterDisplayString(metaPrimary.artist, metaSecondary.artist);
  const bestAlbum =
    metaPrimary.album && metaPrimary.album !== 'Kho nhạc Cloudflare R2'
      ? metaPrimary.album
      : metaSecondary.album || metaPrimary.album;
  const bestDuration =
    metaPrimary.duration && metaPrimary.duration !== 210
      ? metaPrimary.duration
      : metaSecondary.duration && metaSecondary.duration !== 210
        ? metaSecondary.duration
        : metaPrimary.duration || metaSecondary.duration || 210;
  const bestGenre =
    metaPrimary.genre && metaPrimary.genre !== 'Pop'
      ? metaPrimary.genre
      : metaSecondary.genre || metaPrimary.genre || 'Pop';

  return {
    ...otherTrack,
    ...bestAudioTrack,
    id: bestAudioTrack.id || otherTrack.id,
    title: bestTitle || metaPrimary.title || metaSecondary.title,
    artist: bestArtist || metaPrimary.artist || metaSecondary.artist,
    album: bestAlbum,
    genre: bestGenre,
    ...(metaPrimary.region || metaSecondary.region || bestAudioTrack.region || otherTrack.region
      ? {
          region:
            metaPrimary.region ||
            metaSecondary.region ||
            bestAudioTrack.region ||
            otherTrack.region,
        }
      : {}),
    duration: bestDuration,
    audioUrl: bestAudioTrack.audioUrl || otherTrack.audioUrl,
    coverUrl: bestCover,
    plays: Math.max(Number(healedPrimary.plays) || 0, Number(healedSecondary.plays) || 0),
    aiClassified: Boolean(bestAudioTrack.aiClassified || otherTrack.aiClassified),
    id3Checked: Boolean(bestAudioTrack.id3Checked || otherTrack.id3Checked),
    lyrics: lyricsSource.lyrics || bestAudioTrack.lyrics,
    syncedLyrics: lyricsSource.syncedLyrics || bestAudioTrack.syncedLyrics,
    plainLyrics: lyricsSource.plainLyrics || bestAudioTrack.plainLyrics,
    lyricsMode: lyricsSource.lyricsMode || bestAudioTrack.lyricsMode,
    spotifyTrackId: bestAudioTrack.spotifyTrackId || otherTrack.spotifyTrackId,
    spotifyUrl: bestAudioTrack.spotifyUrl || otherTrack.spotifyUrl,
  };
}

/**
 * O(N) Hash-indexed deduplication + Vietnamese slug healing.
 * Processes 2,500+ tracks in ~5ms instead of O(N^2) multi-minute stalls.
 */
export function deduplicateTracksList(tracks: Track[]): {
  deduped: Track[];
  removedIds: string[];
} {
  const artistDict = buildArtistSlugDictionary(tracks);
  const deduped: Track[] = [];
  const removedIds: string[] = [];

  const byId = new Map<string, number>();
  const bySpotifyId = new Map<string, number>();
  const byAudioUrl = new Map<string, number>();
  const byNormTitle = new Map<string, number[]>();
  const byDStrippedTitle = new Map<string, number[]>();
  const artistTokensByIndex: string[][] = [];

  const indexTrackAt = (idx: number, t: Track, normTitle: string, dTitle: string, artists: string[]) => {
    if (t.id) byId.set(t.id, idx);
    if (t.spotifyTrackId) bySpotifyId.set(t.spotifyTrackId.trim(), idx);
    if (t.audioUrl && !t.audioUrl.startsWith('blob:')) {
      byAudioUrl.set(t.audioUrl.trim(), idx);
    }
    if (normTitle) {
      const bucket = byNormTitle.get(normTitle);
      if (bucket) {
        if (!bucket.includes(idx)) bucket.push(idx);
      } else {
        byNormTitle.set(normTitle, [idx]);
      }
    }
    if (dTitle && dTitle.length >= 6) {
      const bucket = byDStrippedTitle.get(dTitle);
      if (bucket) {
        if (!bucket.includes(idx)) bucket.push(idx);
      } else {
        byDStrippedTitle.set(dTitle, [idx]);
      }
    }
    artistTokensByIndex[idx] = artists;
  };

  for (const rawTrack of tracks) {
    if (!rawTrack || !rawTrack.id) continue;
    const track = healTrackVietnameseDisplay(rawTrack, artistDict);

    const normTitle = normalizeTrackTitle(track.title);
    const dTitle =
      normTitle.length >= 6
        ? normTitle.replace(/\bd/g, '').replace(/\s+/g, ' ').trim()
        : '';
    const artists = extractNormalizedArtistTokens(track.artist, track.title);

    let dupIdx: number | undefined = byId.get(track.id);
    if (dupIdx === undefined && track.spotifyTrackId) {
      dupIdx = bySpotifyId.get(track.spotifyTrackId.trim());
    }
    if (dupIdx === undefined && track.audioUrl && !track.audioUrl.startsWith('blob:')) {
      dupIdx = byAudioUrl.get(track.audioUrl.trim());
    }

    if (dupIdx === undefined && normTitle) {
      const candidates = byNormTitle.get(normTitle);
      if (candidates) {
        for (const candIdx of candidates) {
          if (areArtistListsCompatible(artistTokensByIndex[candIdx], artists)) {
            dupIdx = candIdx;
            break;
          }
        }
      }
    }

    if (dupIdx === undefined && dTitle) {
      const candidates = byDStrippedTitle.get(dTitle);
      if (candidates) {
        for (const candIdx of candidates) {
          if (areArtistListsCompatible(artistTokensByIndex[candIdx], artists)) {
            dupIdx = candIdx;
            break;
          }
        }
      }
    }

    if (dupIdx === undefined) {
      const newIdx = deduped.length;
      deduped.push(track);
      indexTrackAt(newIdx, track, normTitle, dTitle, artists);
    } else {
      const prev = deduped[dupIdx];
      const merged = mergeDuplicateTrackPair(prev, track);
      const discardedId = merged.id === prev.id ? track.id : prev.id;
      if (discardedId && discardedId !== merged.id) {
        removedIds.push(discardedId);
      }
      deduped[dupIdx] = merged;
      const mergedNormTitle = normalizeTrackTitle(merged.title);
      const mergedDTitle =
        mergedNormTitle.length >= 6
          ? mergedNormTitle.replace(/\bd/g, '').replace(/\s+/g, ' ').trim()
          : '';
      const mergedArtists = extractNormalizedArtistTokens(merged.artist, merged.title);
      indexTrackAt(dupIdx, merged, mergedNormTitle, mergedDTitle, mergedArtists);
    }
  }

  return { deduped, removedIds };
}
