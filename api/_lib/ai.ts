import { GoogleGenAI, Type } from '@google/genai';

const SPOTIFY_GENRE_NAMES = [
  'Pop',
  'V-Pop',
  'US-UK',
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
  region?: 'vn' | 'us-uk' | 'kpop' | 'other';
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
  'w-n': 'W/N',
  'mlee': 'MLee',
  'marzuz': 'marzuz',
  'youngpuppy': 'YoungPuppy',
  'ronboogz': 'Ronboogz',
  'wean': 'WEAN',
  'evy': 'EVY',
  'dec-ao': 'Dec.ao',
  'wokeup': 'WOKEUP',
  'emceedan': 'EmceeDan',
  '52hz': '52Hz',
  'vstra': 'VSTRA',
  'coldzy': 'Coldzy',
  'khoi-vu': 'Khôi Vũ',
  'slimv': 'SlimV',
  'rhymastic': 'Rhymastic',
  'touliver': 'Touliver',
  'cukak': 'Cukak',
  'tinle': 'TINLE',
  'dj-gin': 'DJ Gin',
  'charles': 'CHARLES.',
  'kriss-ngo': 'Kriss Ngo',
  'spideyboy': 'SpideyBoy',
  'teuyungboy': 'TeuYungBoy',
  'mr-lanh': 'MR LANH',
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
  'sivan': 'SIVAN',
  'fishy': 'Fishy',
  'trid-minh': 'Trid Minh',
  'christopher-wong': 'Christopher Wong',
  'ian-rees': 'Ian Rees',
  // Major US-UK / International Artists
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
  'adela': 'ADÉLA',
  'rihanna': 'Rihanna',
  'adele': 'Adele',
  'lady-gaga': 'Lady Gaga',
  'katy-perry': 'Katy Perry',
  'olivia-rodrigo': 'Olivia Rodrigo',
  'sabrina-carpenter': 'Sabrina Carpenter',
  'sza': 'SZA',
  'kendrick-lamar': 'Kendrick Lamar',
  'drake': 'Drake',
  'travis-scott': 'Travis Scott',
  'eminem': 'Eminem',
  'post-malone': 'Post Malone',
  'sam-smith': 'Sam Smith',
  'john-legend': 'John Legend',
  'michael-jackson': 'Michael Jackson',
  'backstreet-boys': 'Backstreet Boys',
  'westlife': 'Westlife',
  'linkin-park': 'Linkin Park',
  'onerepublic': 'OneRepublic',
  'the-chainsmokers': 'The Chainsmokers',
  'avicii': 'Avicii',
  'calvin-harris': 'Calvin Harris',
  'david-guetta': 'David Guetta',
  'martin-garrix': 'Martin Garrix',
  'marshmello': 'Marshmello',
  'lauv': 'Lauv',
  'jeremy-zucker': 'Jeremy Zucker',
  'jvke': 'JVKE',
  'd4vd': 'd4vd',
  'cigarettes-after-sex': 'Cigarettes After Sex',
  'arctic-monkeys': 'Arctic Monkeys',
  'lana-del-rey': 'Lana Del Rey',
  'stephen-sanchez': 'Stephen Sanchez',
  'benson-boone': 'Benson Boone',
  'teddy-swims': 'Teddy Swims',
  'hozier': 'Hozier',
  'gracie-abrams': 'Gracie Abrams',
  'tate-mcrae': 'Tate McRae',
  'chappell-roan': 'Chappell Roan',
  'camila-cabello': 'Camila Cabello',
  'selena-gomez': 'Selena Gomez',
  'miley-cyrus': 'Miley Cyrus',
  'frank-ocean': 'Frank Ocean',
  'daniel-caesar': 'Daniel Caesar',
  'joji': 'Joji',
  'khalid': 'Khalid',
  'troye-sivan': 'Troye Sivan',
  'conan-gray': 'Conan Gray',
  'lewis-capaldi': 'Lewis Capaldi',
  'james-arthur': 'James Arthur',
  'clean-bandit': 'Clean Bandit',
  'one-direction': 'One Direction',
  'doja-cat': 'Doja Cat',
  'chris-brown': 'Chris Brown',
  'jason-derulo': 'Jason Derulo',
  'lany': 'LANY',
  'honne': 'HONNE',
  'laufey': 'Laufey',
  'beabadoobee': 'beabadoobee',
  'clairo': 'Clairo',
  'blackpink': 'BLACKPINK',
  'bts': 'BTS',
  'newjeans': 'NewJeans',
  'wave-to-earth': 'wave to earth',
  'le-sserafim': 'LE SSERAFIM',
  'stray-kids': 'Stray Kids',
  'seventeen': 'SEVENTEEN',
  'aespa': 'aespa',
};

const US_UK_ARTIST_SLUG_SET = new Set([
  'taylor-swift',
  'the-weeknd',
  'justin-bieber',
  'bruno-mars',
  'ariana-grande',
  'ed-sheeran',
  'coldplay',
  'imagine-dragons',
  'billie-eilish',
  'keshi',
  'charlie-puth',
  'shawn-mendes',
  'dua-lipa',
  'maroon-5',
  'alan-walker',
  'harry-styles',
  'latto',
  'adela',
  'bbno',
  'rihanna',
  'adele',
  'lady-gaga',
  'katy-perry',
  'olivia-rodrigo',
  'sabrina-carpenter',
  'sza',
  'kendrick-lamar',
  'drake',
  'travis-scott',
  'eminem',
  'post-malone',
  'sia',
  'sam-smith',
  'john-legend',
  'michael-jackson',
  'backstreet-boys',
  'westlife',
  'linkin-park',
  'onerepublic',
  'the-chainsmokers',
  'avicii',
  'calvin-harris',
  'david-guetta',
  'martin-garrix',
  'kygo',
  'zedd',
  'marshmello',
  'lauv',
  'jeremy-zucker',
  'jvke',
  'd4vd',
  'cigarettes-after-sex',
  'arctic-monkeys',
  'lana-del-rey',
  'stephen-sanchez',
  'benson-boone',
  'teddy-swims',
  'hozier',
  'gracie-abrams',
  'tate-mcrae',
  'chappell-roan',
  'camila-cabello',
  'selena-gomez',
  'miley-cyrus',
  'frank-ocean',
  'daniel-caesar',
  'giveon',
  'joji',
  'niki',
  'khalid',
  'troye-sivan',
  'conan-gray',
  'pink-sweat',
  'alec-benjamin',
  'lewis-capaldi',
  'james-arthur',
  'passenger',
  'clean-bandit',
  'zayn',
  'one-direction',
  'lorde',
  'doja-cat',
  'nicki-minaj',
  'cardi-b',
  'chris-brown',
  'jason-derulo',
  'lany',
  'honne',
  'laufey',
  'beabadoobee',
  'clairo',
  'beyonce',
  'shakira',
  'usher',
  'alicia-keys',
  'mariah-carey',
  'celine-dion',
  'elton-john',
  'queen',
  'the-beatles',
  'abba',
]);

const KPOP_ARTIST_SLUG_SET = new Set([
  'bts',
  'blackpink',
  'jung-kook',
  'jungkook',
  'lisa',
  'jennie',
  'rose',
  'jisoo',
  'twice',
  'exo',
  'seventeen',
  'stray-kids',
  'newjeans',
  'aespa',
  'ive',
  'le-sserafim',
  'wave-to-earth',
  'aoa',
  'bigbang',
  'iu',
  'taeyeon',
  'hyo',
  'g-dragon',
  'babymonster',
  'illit',
  'enhypen',
  'txt',
  'nct',
  'itzy',
  'red-velvet',
  'cortis',
  'ji-yeon',
]);

function isUsUkArtistSlugged(artistText?: string): boolean {
  if (!artistText) return false;
  const parts = artistText
    .split(/(?:,|&|;|\s+\/\s+|\bfeat\.?\b|\bft\.?\b|\bx\b)/i)
    .map(p => slugifyArtistLookup(p))
    .filter(Boolean);
  return parts.some(p => US_UK_ARTIST_SLUG_SET.has(p));
}

function isKPopArtistSlugged(artistText?: string): boolean {
  if (!artistText) return false;
  const parts = artistText
    .split(/(?:,|&|;|\s+\/\s+|\bfeat\.?\b|\bft\.?\b|\bx\b)/i)
    .map(p => slugifyArtistLookup(p))
    .filter(Boolean);
  return parts.some(p => KPOP_ARTIST_SLUG_SET.has(p));
}

const VN_UNIQUE_CHARS_REGEX =
  /[ăâêôơưđằắẳẵặầấẩẫậềếểễệỉĩịồốổỗộờớởỡợủũụừứửữựỳỷỹỵ]/i;

function isVietnameseArtistSlugged(artistText?: string): boolean {
  if (!artistText) return false;
  if (VN_UNIQUE_CHARS_REGEX.test(artistText)) {
    return true;
  }
  const parts = artistText
    .split(/(?:,|&|;|\s+\/\s+|\bfeat\.?\b|\bft\.?\b|\bx\b)/i)
    .map(p => slugifyArtistLookup(p))
    .filter(Boolean);
  return parts.some(p => p in VIETNAMESE_ARTIST_DICTIONARY && !US_UK_ARTIST_SLUG_SET.has(p) && !KPOP_ARTIST_SLUG_SET.has(p));
}

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

function extractTrailingTitleQualifierServer(cleanTitle: string): {
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

function healArtistDisplayStringServer(
  rawArtist: string,
  artistDict: Record<string, string> = VIETNAMESE_ARTIST_DICTIONARY
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

export function parseAndCleanSlugTrack(
  rawTitle: string,
  rawArtist: string,
  artistDict: Record<string, string> = VIETNAMESE_ARTIST_DICTIONARY
): { title: string; artist: string; genreHint?: string } {
  let cleanTitleInput = (rawTitle || '').replace(/\.(mp3|wav|flac|m4a|ogg|aac|opus)$/i, '').trim();
  cleanTitleInput = cleanTitleInput.replace(/-\d{10,}$/, '').replace(/-[0-9a-f]{8}$/i, '').trim();

  const currentArtist = (rawArtist || '').trim();
  const healedArtist = healArtistDisplayStringServer(currentArtist, artistDict);
  const hasPlaceholderArtist =
    !healedArtist ||
    PLACEHOLDER_ARTISTS.has(normalizeAsciiText(healedArtist)) ||
    isRawSlugDisplayText(healedArtist);

  const { core, qualifier } = extractTrailingTitleQualifierServer(cleanTitleInput);
  const coreNorm = normalizeAsciiText(core);
  const qualifierMatch = VIETNAMESE_TITLE_DICTIONARY[coreNorm];
  const isAmbiguousShortKey = coreNorm === 'van' || coreNorm === 'vut';
  const hasVnArtistContext =
    /[ăâêôơưđàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i.test(healedArtist) ||
    isVietnameseArtistSlugged(healedArtist);

  if (qualifierMatch && (!isAmbiguousShortKey || hasVnArtistContext)) {
    const resolvedTitle = qualifier
      ? `${qualifierMatch.title} ${qualifier}`.trim()
      : qualifierMatch.title;
    const resolvedArtist = !hasPlaceholderArtist
      ? healedArtist
      : qualifierMatch.artist || 'Nghệ sĩ chưa rõ';
    return {
      title: resolvedTitle,
      artist: resolvedArtist,
      genreHint: qualifierMatch.genre,
    };
  }

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
      ? healedArtist
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

    let finalArtist = healedArtist;
    if (hasPlaceholderArtist) {
      if (extractedArtists.length > 0) {
        finalArtist = extractedArtists.join(', ');
      } else if (coreMatch?.artist) {
        finalArtist = coreMatch.artist;
      } else {
        const artistSlugCheck = slugifyArtistLookup(healedArtist);
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
  } else if (
    /[^\u0000-\u007f]/.test(cleanTitleInput) &&
    cleanTitleInput === cleanTitleInput.toLowerCase() &&
    cleanTitleInput.length >= 4
  ) {
    finalTitle = cleanTitleInput
      .split(/\s+/)
      .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ');
  }

  let finalArtist = healedArtist;
  const artistSlugKey = slugifyArtistLookup(healedArtist);
  if (artistDict[artistSlugKey] && isRawSlugDisplayText(healedArtist)) {
    finalArtist = artistDict[artistSlugKey];
  } else if (directDictMatch?.artist && hasPlaceholderArtist) {
    finalArtist = directDictMatch.artist;
  } else if (!hasPlaceholderArtist && isRawSlugDisplayText(healedArtist)) {
    finalArtist = toSmartTitleCase(healedArtist.replace(/[-_]+/g, ' '));
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

    if (clean.includes(' - ') && isRawSlugDisplayText(artist)) {
      const suffixTagGuard =
        /\s+-\s+(?:Original|Beat|Live|Remix|Lofi|Lo-Fi|Acoustic|Piano|Instrumental|Explicit|Unplugged|Sped Up|Slowed|Chinese Version|English Version)/i;
      if (!suffixTagGuard.test(clean)) {
        const parts = clean.split(' - ');
        if (parts.length >= 2) {
          const potentialArtist = parts[0].replace(/^[0-9.\s]+/, '').trim();
          const potentialTitle = parts.slice(1).join(' - ').trim();
          if (potentialArtist) artist = potentialArtist;
          if (potentialTitle) title = potentialTitle;
        }
      }
    }

    const restored = parseAndCleanSlugTrack(title, artist);
    title = restored.title;
    artist = restored.artist;

    const lower = (title + ' ' + artist).toLowerCase();
    const isUsUkArtist = isUsUkArtistSlugged(artist);
    const isKPopArtist = isKPopArtistSlugged(artist);
    const isVnArtist = isVietnameseArtistSlugged(artist);
    const hasVnChars =
      VN_UNIQUE_CHARS_REGEX.test(title + ' ' + artist) ||
      (!isUsUkArtist &&
        !isKPopArtist &&
        /[ăâêôơưđàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i.test(title + ' ' + artist));
    const hasVnAsciiWords = /\b(nguoi|tinh|yeu|anh|em|khong|phai|thoi|buon|nho|mai|doi|duyen|mua|dem|cho|thuong|ve|mot|tuoi|gio|chuyen|long|minh|cua|nhung|nay|day|sau|truoc|muon|can|dau|the|gi|sao|vi|nhu)\b/i.test(title);

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
    } else if (isKPopArtist || /[\uac00-\ud7af]/.test(title + artist)) {
      genre = 'K-Pop';
    } else if (isUsUkArtist && !isVnArtist) {
      genre = 'US-UK';
    } else if (lower.includes('vpop') || lower.includes('nhạc trẻ') || hasVnChars || hasVnAsciiWords || isVnArtist) {
      genre = 'V-Pop';
    }

    const detectedRegion: 'vn' | 'us-uk' | 'kpop' | 'other' =
      genre === 'US-UK'
        ? 'us-uk'
        : genre === 'K-Pop'
          ? 'kpop'
          : hasVnChars || hasVnAsciiWords || isVnArtist || genre === 'V-Pop'
            ? 'vn'
            : 'other';

    return {
      id: item.id,
      genre,
      mood: genre === 'US-UK' ? 'Quốc tế & Cuốn hút' : 'Thư giãn & Dễ chịu',
      bpm: 110,
      suggestedTitle: title,
      suggestedArtist: artist,
      region: detectedRegion,
      reason: 'Phân loại tự động & nhận diện nguồn gốc thận trọng Soundly AI.',
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

    const prompt = `Bạn là chuyên gia phân loại âm nhạc (Music Curator AI) có công cụ Google Search Grounding.
Hãy tra cứu từng bài hát trong danh sách bên dưới để xác minh CHÍNH XÁC:
1. Tên bài hát chuẩn gốc (suggestedTitle) và Tên nghệ sĩ chuẩn gốc (suggestedArtist).
2. Nguồn gốc thực tế của nghệ sĩ & bài hát (region: "vn" | "us-uk" | "kpop" | "other").
3. Thể loại chuẩn (genre) trong danh sách cho phép.
4. Tâm trạng (mood), nhịp độ (bpm), và lý do (reason).

QUY TẮC BẮT BUỘC VỀ PHÂN LOẠI NHẠC NƯỚC NGOÀI (US-UK) — TUYỆT ĐỐI KHÔNG SUY ĐOÁN:
- **KHÔNG BAO GIỜ** kết luận là "US-UK" chỉ vì tên bài hát là tiếng Anh hoặc nghệ danh ca sĩ viết bằng tiếng Anh/không dấu!
- Rất nhiều nghệ sĩ Việt Nam đặt nghệ danh tiếng Anh và/hoặc hát bài tên tiếng Anh (ví dụ: SIVAN, Wren Evans, AMEE, SOOBIN, MONO, tlinh, RPT MCK, HIEUTHUHAI, Low G, GREY D, Orange, VSTRA, 52Hz, Coldzy, Fishy, Trid Minh, Baby Sam, Ronboogz...), hoặc nghệ sĩ K-Pop/Châu Á (BTS, BLACKPINK, wave to earth, Jung Kook, LISA...), hoặc nhạc phim Việt Nam do nhạc sĩ nước ngoài soạn (ví dụ: *Mắt Biếc* OST của Christopher Wong, Garrett Crosby, Ian Rees — đây là nhạc phim Việt Nam, KHÔNG phải nhạc US-UK!).
- Chỉ gán **"region": "us-uk"** (và chọn **"genre": "US-UK"** nếu là Pop/Ballad/R&B Âu Mỹ) KHI VÀ CHỈ KHI bạn đã **tra cứu Google Search xác minh chắc chắn** nghệ sĩ đó thực sự thuộc thị trường Âu Mỹ / phương Tây (Mỹ, Anh, Canada, Úc, châu Âu... ví dụ: Taylor Swift, Harry Styles, The Weeknd, Billie Eilish, keshi, ADÉLA, Ed Sheeran, Bruno Mars...).
- Nếu chưa xác minh chắc chắn được quốc tịch/thị trường của nghệ sĩ qua Google Search, KHÔNG được gán "US-UK" — hãy đặt "region": "other" và chọn thể loại âm nhạc trung tính (Pop, Ballad, EDM / Electronic, Classical...).
- Nếu đã xác minh là nghệ sĩ/bài hát Việt Nam (kể cả tựa tiếng Anh như *Exit Sign*, *In Love*, *Cause I Love You*, *Making My Way*) hoặc nhạc phim Việt Nam: đặt **"region": "vn"** và chọn thể loại phù hợp ("V-Pop", "Ballad", "Hip-Hop", "Indie", "Lo-Fi & Chill", "Classical"...).
- Nếu là nhạc Hàn Quốc/Nhật Bản/Châu Á: đặt **"region": "kpop"** và chọn **"K-Pop"** (hoặc thể loại phù hợp).

QUY TẮC BẮT BUỘC KHÔI PHỤC DẤU TIẾNG VIỆT (SẮC, HUYỀN, HỎI, NGÃ, NẶNG, Ă, Â, Ê, Ô, Ơ, Ư, Đ):
- Rất nhiều bài hát Việt Nam trong dữ liệu đầu vào bị mất hết dấu thanh (sắc, huyền, hỏi, ngã, nặng) hoặc dấu chữ cái tiếng Việt trên CẢ tên bài hát lẫn tên nghệ sĩ, hoặc bị viết dính liền không dấu.
- Ví dụ thực tế:
  • "Vai Lan Don Dua" -> "Vài Lần Đón Đưa"
  • "Tim Lai Reu Phong" -> "Tìm Lại Rêu Phong"
  • "Chuyen Chang Co Don" -> "Chuyện Chẳng Cô Đơn"
  • "Ai Kho Vi Ai" -> "Ai Khổ Vì Ai"
  • "Vut Tan" -> "Vụt Tan" | "Vui Di Em" -> "Vui Đi Em" | "Ve Khoi" -> "Vẽ Khói" | "Di Va Yeu" -> "Đi Và Yêu" | "Chi Toi" -> "Chị Tôi"
  • "Lang Tham" -> "Lặng Thầm" | "Gan Ngay Truoc Mat" -> "Gần Ngay Trước Mặt" | "Chac Co Le" -> "Chắc Có Lẽ"
  • "Ngay Tho" -> "Ngây Thơ" | "Chim Sau" -> "Chìm Sâu"
  • "NGONGIODEMQUATRANGSANGDEMNAY" -> "Ngọn Gió Đêm Qua Trăng Sáng Đêm Nay"
  • "Haydeanhduoccungemdau" -> "Hãy Để Anh Được Cùng Em Đau"
  • Tên nghệ sĩ: "Duy Tuan" -> "Duy Tuấn", "Diep Lam Anh" -> "Diệp Lâm Anh", "Phuc Du" -> "Phúc Du", "Khoi Vu" -> "Khôi Vũ", "Sony Tran" -> "Sony Trần", "Thuy Chi" -> "Thùy Chi".
- **LƯU Ý QUAN TRỌNG**: Tra cứu Google Search tên bài hát gốc để KHÔNG thêm sai dấu đối với những bài vốn không có dấu thanh hoặc cố tình viết như vậy (ví dụ: *"Sau Tan Ca"* của Quang Hùng MasterD, *"Do Ai"* của Vũ., *"Mong Cho Anh"* của Vũ Cát Tường, *"Trao"* của Wren Evans, *"Lan Man"* của Ronboogz, *"Anh Em Ca"* của Da LAB) và **KHÔNG BAO GIỜ** thêm dấu tiếng Việt vào bài hát tiếng Anh/US-UK/K-Pop.
- Giữ định dạng gọn đẹp cho phiên bản nếu có: "(feat. ...)", "(Lo-Fi Ver.)", "(Acoustic Version)", "(Piano Version)", "(Remix)", "(Beat)", "(Original)".

DANH SÁCH THỂ LOẠI CHUẨN BẮT BUỘC (chỉ chọn 1 trong các giá trị sau cho trường genre):
[${allowedGenresList}]

Danh sách bài hát cần phân loại:
${JSON.stringify(processedItems, null, 2)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction:
          'You are a precise music curator with real-time Google Search grounding. Never assume a song is US-UK just from an English title or English artist stage name—always verify the artist nationality/market and song origin via Google Search first. For Vietnamese songs and artists missing Vietnamese tone marks (sắc, huyền, hỏi, ngã, nặng) or vowel diacritics, use Google Search to restore exact official Vietnamese spelling. Always return valid JSON matching the schema.',
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              genre: { type: Type.STRING },
              region: { type: Type.STRING },
              mood: { type: Type.STRING },
              bpm: { type: Type.INTEGER },
              suggestedTitle: { type: Type.STRING },
              suggestedArtist: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: [
              'id',
              'genre',
              'region',
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
      const rawGenreLower = (item.genre || '').trim().toLowerCase();
      let matchedGenre =
        SPOTIFY_GENRE_NAMES.find(g => g.toLowerCase() === rawGenreLower) || '';
      if (!matchedGenre) {
        if (
          rawGenreLower.includes('us-uk') ||
          rawGenreLower.includes('us uk') ||
          rawGenreLower.includes('us/uk') ||
          rawGenreLower.includes('nước ngoài') ||
          rawGenreLower.includes('quốc tế') ||
          rawGenreLower.includes('international') ||
          rawGenreLower.includes('western')
        ) {
          matchedGenre = 'US-UK';
        } else if (rawGenreLower.includes('v-pop') || rawGenreLower.includes('vpop')) {
          matchedGenre = 'V-Pop';
        } else if (rawGenreLower.includes('k-pop') || rawGenreLower.includes('kpop')) {
          matchedGenre = 'K-Pop';
        } else if (rawGenreLower.includes('lo-fi') || rawGenreLower.includes('lofi')) {
          matchedGenre = 'Lo-Fi & Chill';
        } else if (rawGenreLower.includes('edm') || rawGenreLower.includes('electronic')) {
          matchedGenre = 'EDM / Electronic';
        } else {
          matchedGenre = 'Pop';
        }
      }
      const rawRegion = String(item.region || '').trim().toLowerCase();
      const verifiedRegion: 'vn' | 'us-uk' | 'kpop' | 'other' =
        rawRegion === 'us-uk' || rawRegion === 'vn' || rawRegion === 'kpop' || rawRegion === 'other'
          ? rawRegion
          : matchedGenre === 'US-UK'
            ? 'us-uk'
            : matchedGenre === 'K-Pop'
              ? 'kpop'
              : matchedGenre === 'V-Pop'
                ? 'vn'
                : 'other';

      // Guard against mismatch: if region isn't verified as us-uk, never force US-UK genre
      if (matchedGenre === 'US-UK' && verifiedRegion !== 'us-uk') {
        matchedGenre = verifiedRegion === 'vn' ? 'V-Pop' : 'Pop';
      }

      return {
        ...item,
        genre: matchedGenre,
        region: verifiedRegion,
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

export function detectTrackRegionServer(track: {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  region?: 'vn' | 'us-uk' | 'kpop' | 'other';
}): 'vn' | 'us-uk' | 'kpop' | 'other' {
  if (track.region === 'vn' || track.region === 'us-uk' || track.region === 'kpop') {
    return track.region;
  }

  const genreLower = (track.genre || '').trim().toLowerCase();
  const title = (track.title || '').trim();
  const artist = (track.artist || '').trim();
  const album = (track.album || '').trim();

  if (genreLower === 'us-uk' || genreLower === 'us/uk' || genreLower === 'us uk') {
    return 'us-uk';
  }
  if (genreLower === 'k-pop' || genreLower === 'kpop') {
    return 'kpop';
  }
  if (genreLower === 'v-pop' || genreLower === 'vpop') {
    return 'vn';
  }

  if (
    VN_UNIQUE_CHARS_REGEX.test(title) ||
    VN_UNIQUE_CHARS_REGEX.test(artist) ||
    isVietnameseArtistSlugged(artist)
  ) {
    return 'vn';
  }

  if (
    /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(title + artist) ||
    isKPopArtistSlugged(artist)
  ) {
    return 'kpop';
  }

  if (isUsUkArtistSlugged(artist)) {
    return 'us-uk';
  }

  const vnCharsRegex =
    /[ăâêôơưđàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;
  if (
    vnCharsRegex.test(title) ||
    vnCharsRegex.test(artist) ||
    (album && album !== 'Kho nhạc Soundly' && album !== 'Kho nhạc Cloudflare R2' && vnCharsRegex.test(album))
  ) {
    return 'vn';
  }

  if (
    /\b(nguoi|tinh|yeu|anh|em|khong|phai|thoi|buon|nho|mai|doi|duyen|mua|dem|cho|thuong|ve|mot|tuoi|gio|chuyen|long|minh|cua|nhung|nay|day|sau|truoc|muon|can|dau|the|gi|sao|vi|nhu)\b/i.test(
      title
    )
  ) {
    return 'vn';
  }

  return 'other';
}

export function matchesTrackGenreFilter(
  track: {
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
    region?: 'vn' | 'us-uk' | 'kpop' | 'other';
  },
  genreName: string
): boolean {
  if (!genreName || genreName === 'all') return true;
  const target = genreName.trim().toLowerCase();
  if ((track.genre || '').toLowerCase() === target) return true;
  if (target === 'us-uk' || target === 'us/uk' || target === 'us uk') {
    return detectTrackRegionServer(track) === 'us-uk';
  }
  if (target === 'k-pop' || target === 'kpop') {
    return detectTrackRegionServer(track) === 'kpop';
  }
  if (target === 'v-pop' || target === 'vpop') {
    return detectTrackRegionServer(track) === 'vn' && (track.genre || '').toLowerCase() === 'pop';
  }
  return false;
}

