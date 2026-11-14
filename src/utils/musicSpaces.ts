import { Track } from '../types/music';

export type MusicSpaceId = 'all' | 'vn' | 'us-uk' | 'kpop' | 'chill';

export interface MusicSpaceMeta {
  id: MusicSpaceId;
  title: string;
  shortTitle: string;
  subtitle: string;
  description: string;
  accentGradient: string;
}

export const MUSIC_SPACES: MusicSpaceMeta[] = [
  {
    id: 'all',
    title: 'Tất cả không gian',
    shortTitle: 'Tất cả',
    subtitle: 'Toàn bộ kho nhạc',
    description: 'Khám phá trọn vẹn mọi giai điệu Việt Nam, US-UK và quốc tế trên Soundly.',
    accentGradient: 'from-[#1d2d6b] via-[#141d3d] to-[#0d142c]',
  },
  {
    id: 'vn',
    title: 'Không gian Nhạc Việt',
    shortTitle: 'Nhạc Việt',
    subtitle: 'V-Pop • Ballad • Indie Việt',
    description: 'Giai điệu tiếng Việt sâu lắng, V-Pop thịnh hành, Rap Việt và Acoustic.',
    accentGradient: 'from-[#7c2d3b] via-[#2b1734] to-[#0d142c]',
  },
  {
    id: 'us-uk',
    title: 'Không gian US-UK & Quốc Tế',
    shortTitle: 'US-UK & Quốc Tế',
    subtitle: 'Âu Mỹ • Nhạc Nước Ngoài',
    description: 'Thế giới nhạc Âu Mỹ, US-UK Pop, R&B, Indie và những bản hit quốc tế chọn lọc.',
    accentGradient: 'from-[#16427a] via-[#12264d] to-[#0d142c]',
  },
  {
    id: 'kpop',
    title: 'Không gian K-Pop & Châu Á',
    shortTitle: 'K-Pop & Châu Á',
    subtitle: 'K-Pop • Asian Vibe',
    description: 'Sôi động cùng K-Pop, K-Indie, J-Pop và các nghệ sĩ nổi bật Châu Á.',
    accentGradient: 'from-[#6b215e] via-[#281642] to-[#0d142c]',
  },
  {
    id: 'chill',
    title: 'Không gian Chill & Tập Trung',
    shortTitle: 'Chill & Lo-Fi',
    subtitle: 'Lo-Fi • Acoustic • Thư giãn',
    description: 'Âm thanh êm dịu, không gian thư giãn, học tập và làm việc tập trung.',
    accentGradient: 'from-[#1f4d57] via-[#13293d] to-[#0d142c]',
  },
];

const VIETNAMESE_SPECIFIC_CHARS_REGEX =
  /[ăâêôơưđàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;

const KOREAN_JAPANESE_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/;

const US_UK_ARTIST_KEYS = new Set([
  'taylor swift',
  'the weeknd',
  'justin bieber',
  'bruno mars',
  'ariana grande',
  'ed sheeran',
  'coldplay',
  'imagine dragons',
  'billie eilish',
  'keshi',
  'charlie puth',
  'shawn mendes',
  'dua lipa',
  'maroon 5',
  'alan walker',
  'harry styles',
  'latto',
  'adéla',
  'adela',
  'bbno$',
  'bbno',
  'rihanna',
  'adele',
  'lady gaga',
  'katy perry',
  'olivia rodrigo',
  'sabrina carpenter',
  'sza',
  'kendrick lamar',
  'drake',
  'travis scott',
  'eminem',
  'post malone',
  'sia',
  'sam smith',
  'john legend',
  'michael jackson',
  'backstreet boys',
  'westlife',
  'linkin park',
  'onerepublic',
  'the chainsmokers',
  'avicii',
  'calvin harris',
  'david guetta',
  'martin garrix',
  'kygo',
  'zedd',
  'marshmello',
  'lauv',
  'jeremy zucker',
  'jvke',
  'd4vd',
  'cigarettes after sex',
  'arctic monkeys',
  'lana del rey',
  'stephen sanchez',
  'benson boone',
  'teddy swims',
  'hozier',
  'gracie abrams',
  'tate mcrae',
  'chappell roan',
  'camila cabello',
  'selena gomez',
  'miley cyrus',
  'frank ocean',
  'daniel caesar',
  'giveon',
  'joji',
  'niki',
  'khalid',
  'troye sivan',
  'conan gray',
  'pink sweat$',
  'pink sweats',
  'alec benjamin',
  'lewis capaldi',
  'james arthur',
  'passenger',
  'clean bandit',
  'zayn',
  'one direction',
  'lorde',
  'doja cat',
  'nicki minaj',
  'cardi b',
  '21 savage',
  'future',
  'metro boomin',
  'tyler, the creator',
  'tyler the creator',
  'childish gambino',
  'kanye west',
  'beyonce',
  'shakira',
  'pitbull',
  'jason derulo',
  'flo rida',
  'ne-yo',
  'usher',
  'chris brown',
  'alicia keys',
  'mariah carey',
  'whitney houston',
  'celine dion',
  'elton john',
  'queen',
  'the beatles',
  'abba',
  'adele',
  'bruno major',
  'rex orange county',
  'mac ayres',
  'tory lanez',
  'brent faiyaz',
  'summer walker',
  'kehlani',
  'halsey',
  'bebe rexha',
  'anne-marie',
  'ellie goulding',
  'rita ora',
  'charli xcx',
  'carly rae jepsen',
  'meghan trainor',
  'kelly clarkson',
  'pink',
  'p!nk',
  'avril lavigne',
  'demi lovato',
  'niall horan',
  'louis tomlinson',
  'liam payne',
  'jonas brothers',
  '5 seconds of summer',
  'panic! at the disco',
  'fall out boy',
  'twenty one pilots',
  'green day',
  'nirvana',
  'radiohead',
  'oasis',
  'muse',
  'the 1975',
  'tame impala',
  'glass animals',
  'foster the people',
  'bastille',
  'kodaline',
  'the script',
  'the fray',
  'snow patrol',
  'keane',
  'jason mraz',
  'john mayer',
  'jack johnson',
  'norah jones',
  'lany',
  'honne',
  'prep',
  'men i trust',
  'clairo',
  'beabadoobee',
  'laufey',
  'boygenius',
  'phoebe bridgers',
  'mitski',
  'mac demarco',
  'sasha alex sloan',
  'dhruv',
  'rina sawayama',
  'pinkpantheress',
  'central cee',
  'fred again..',
  'illenium',
  'gryffin',
  'porter robinson',
  'madeon',
  'galantis',
  'major lazer',
  'dj snake',
  'diplo',
  'skrillex',
  'disclosure',
  'flume',
  'odesza',
  'rufus du sol',
]);

const KPOP_ARTIST_KEYS = new Set([
  'bts',
  'blackpink',
  'jung kook',
  'jungkook',
  'jimin',
  'v',
  'suga',
  'rm',
  'j-hope',
  'jin',
  'lisa',
  'jennie',
  'rose',
  'jisoo',
  'twice',
  'exo',
  'seventeen',
  'stray kids',
  'newjeans',
  'aespa',
  'ive',
  'le sserafim',
  'wave to earth',
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
  'nct 127',
  'nct dream',
  'itzy',
  'red velvet',
  'cortis',
  'ji yeon',
  'psy',
  'twice',
  'mamamoo',
  'gidle',
  '(g)i-dle',
  'kiss of life',
  'treasure',
  'riize',
  'boynextdoor',
  'zerobaseone',
  'stayc',
  'nmixx',
  'ateez',
  'got7',
  'monsta x',
  'shinee',
  'super junior',
  'girls generation',
  '2ne1',
  'winner',
  'ikon',
  'day6',
  'the rose',
  'dean',
  'crush',
  'zion.t',
  'heize',
  'bol4',
  'akmu',
  '10cm',
  'dpr ian',
  'dpr live',
  'yoasobi',
  'kenshi yonezu',
  'fujii kaze',
  'shurkn pap',
  'ado',
  'imase',
]);

const VIETNAMESE_ASCII_ARTIST_KEYS = new Set([
  'soobin',
  'soobin hoang son',
  'b ray',
  'b-ray',
  'bray',
  'rpt mck',
  'mck',
  'min',
  'mr. siro',
  'mr siro',
  'amee',
  'low g',
  'wren evans',
  'mono',
  'hieuthuhai',
  'dangrangto',
  'donal',
  'da lab',
  'dalab',
  'tlinh',
  'youngpuppy',
  'sony tran',
  'marzuz',
  'justatee',
  'bigdaddy',
  'binz',
  'grey d',
  'w/n',
  'lyly',
  'khoi vu',
  'slimv',
  'rhymastic',
  'touliver',
  'mlee',
  'ronboogz',
  'wean',
  'k-icm',
  'evy',
  'dec.ao',
  'obito',
  'wokeup',
  '2pillz',
  'masew',
  'cukak',
  'emceedan',
  '52hz',
  'my anh',
  'vstra',
  'coldzy',
  'hooligan',
  'hooligan.',
  'buitruonglinh',
  'bui truong linh',
  'orange',
  'osad',
  'jsol',
  'erik',
  'hurrykng',
  'rhyder',
  'captain',
  'captain boy',
  'negav',
  'chillies',
  'freak d',
  'yanbi',
  'mr. t',
  'mr t',
  'jack - j97',
  'jack j97',
  'madihu',
  'kimmese',
  'kien',
  'andree right hand',
  'baby sam',
  'coolkid',
  '24k.right',
  '7dnight',
  'manbo',
  'sol7',
  'dcod',
  'machiot',
  'tgsn',
  'itsnk',
  'rein',
  'onionn',
  'onionn.',
  'yuno bigboi',
  'mpakk',
  'jgkid',
  'jgkid (da lab)',
  'dbaola',
  'tinle',
  'dj gin',
  'charles',
  'charles.',
  'kriss ngo',
  'slick',
  'trungng',
  'young h',
  'rpt orijinn',
  'thanhdraw',
  'lope pham',
  'spideyboy',
  'teuyungboy',
  'mr lanh',
  'phap kieu',
  'duong domic',
  'quang hung masterd',
  'son tung m-tp',
  'hoa minzy',
  'duc phuc',
  'bich phuong',
  'ha anh tuan',
  'phan manh quynh',
  'hoang dung',
  'den',
  'den vau',
  'thinh suy',
  'ngot',
  'ca hoi hoang',
  'vu',
  'vu.',
  'kai dinh',
  'thai dinh',
  'phuong ly',
  'juky san',
  'tang duy tan',
  'hoang thuy linh',
  'truc nhan',
  'van mai huong',
  'trung quan',
  'quan a.p',
  'le quyen',
  'bang kieu',
  'quang le',
  'huong tram',
  'bao anh',
  'khac viet',
  'dat g',
  'du uyen',
  'my tam',
  'noo phuoc thinh',
  'anh trai say hi',
  'anh trai "say hi"',
  'anh trai vuot ngan chong gai',
  'xuan nghi',
  'trang',
  'suboi',
  'karik',
  'phuc du',
  'karik',
  'vu cat tuong',
  'tien tien',
  'bui anh tuan',
  'hoai lam',
  'only c',
  'lou hoang',
  'miu le',
  'vy jacko',
  'tyo ly',
  'kidsai',
  'whenitsasunniday',
  'quanium',
  'gotez',
  'mason nguyen',
  'fogii',
  '[pink hapless]',
  'pink hapless',
  'garrett crosby',
  'christopher wong',
  'ian rees',
  'sivan',
  'fishy',
  'trid minh',
  'duy tuan',
  'duy tuấn',
  'diep lam anh',
  'diệp lâm anh',
  'thuy chi',
  'thùy chi',
  'sony trần',
  'phúc du',
  'phuc du',
  'khôi vũ',
  'linh cao',
  'linh cáo',
  'quang trung',
  'tlinh',
  'lam',
  'lâm',
  'nicky',
  'pialinh',
  'tri minh',
  'thanh lam',
  'phuong my chi',
  'phương mỹ chi',
  'mai tien dung',
  'mai tiến dũng',
  'toc tien',
  'tóc tiên',
  'dong nhi',
  'đông nhi',
  'thu minh',
  'ngoc khue',
  'dtap',
  'zeaplee',
  '1 9 6 7',
  '1967',
]);

const VIETNAMESE_ASCII_TITLE_HINT_REGEX =
  /\b(nguoi|tinh|yeu|anh|em|khong|phai|thoi|buon|nho|mai|doi|duyen|mua|dem|cho|thuong|ve|mot|tuoi|gio|chuyen|long|minh|cua|nhung|nay|day|sau|truoc|muon|can|dau|the|gi|sao|vi|nhu|chung\s+ta|co\s+ay|bay\s+gio|tam\s+trang|giac\s+mo|hoai\s+niem|loi\s+hua|tim\s+lai|khuc\s+hat|ben\s+em|ben\s+anh|nhe|nha|oi|ha|di|dung|lam|biet|quen|chac|phut|giay|nam|thang|ngay|xuan|ha|thu|dong|hoa|la|may|troi|bien|nang|gio|trang|sao)\b/i;

const PLACEHOLDER_ARTIST_KEYS = new Set([
  'nghe si chua ro',
  'nghe si spotflow',
  'cho ai nhan dien',
  'cho ai nhan dien...',
  'unknown artist',
  'unknown',
  'various artists',
]);

function splitNormalizedArtists(artist?: string | null): string[] {
  if (!artist) return [];
  return artist
    .split(/\s*(?:,|;|、)\s*|\s+\/\s+|\s+(?:ft\.?|feat\.?|featuring|with|x|&)\s+/i)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isUsUkArtistName(artist?: string | null): boolean {
  const parts = splitNormalizedArtists(artist);
  return parts.some(p => US_UK_ARTIST_KEYS.has(p));
}

export function isKPopArtistName(artist?: string | null): boolean {
  const parts = splitNormalizedArtists(artist);
  return parts.some(p => KPOP_ARTIST_KEYS.has(p));
}

const VIETNAMESE_UNIQUE_DIACRITICS_REGEX =
  /[ăâêôơưđằắẳẵặầấẩẫậềếểễệỉĩịồốổỗộờớởỡợủũụừứửữựỳỷỹỵ]/i;

export function isVietnameseArtistName(artist?: string | null): boolean {
  const raw = artist || '';
  if (VIETNAMESE_UNIQUE_DIACRITICS_REGEX.test(raw)) return true;
  const parts = splitNormalizedArtists(raw);
  return parts.some(p => VIETNAMESE_ASCII_ARTIST_KEYS.has(p));
}

export function detectTrackRegion(
  track: Pick<Track, 'title' | 'artist' | 'album' | 'genre' | 'region'>
): 'vn' | 'us-uk' | 'kpop' | 'other' {
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

  // Known Vietnamese artists take priority (including VN artists with English stage names/titles)
  if (
    VIETNAMESE_UNIQUE_DIACRITICS_REGEX.test(title) ||
    VIETNAMESE_UNIQUE_DIACRITICS_REGEX.test(artist) ||
    isVietnameseArtistName(artist)
  ) {
    return 'vn';
  }

  // Verified K-Pop / Asian script or artists
  if (KOREAN_JAPANESE_REGEX.test(title) || KOREAN_JAPANESE_REGEX.test(artist) || isKPopArtistName(artist)) {
    return 'kpop';
  }

  // Verified US-UK / Western international artists ONLY (never guess from English title or unknown ASCII stage name)
  if (isUsUkArtistName(artist)) {
    return 'us-uk';
  }

  // General Vietnamese diacritics (àáèé... excluding verified foreign artists already checked above)
  if (
    VIETNAMESE_SPECIFIC_CHARS_REGEX.test(title) ||
    VIETNAMESE_SPECIFIC_CHARS_REGEX.test(artist) ||
    (album && album !== 'Kho nhạc Soundly' && album !== 'Kho nhạc Cloudflare R2' && VIETNAMESE_SPECIFIC_CHARS_REGEX.test(album))
  ) {
    return 'vn';
  }

  // Unaccented Vietnamese title check
  if (VIETNAMESE_ASCII_TITLE_HINT_REGEX.test(title)) {
    return 'vn';
  }

  // Do NOT classify unknown English titles or English stage names as 'us-uk' without verification
  return 'other';
}

export function isUsUkTrack(track: Pick<Track, 'title' | 'artist' | 'album' | 'genre' | 'region'>): boolean {
  return detectTrackRegion(track) === 'us-uk';
}

export function isVietnameseTrack(track: Pick<Track, 'title' | 'artist' | 'album' | 'genre' | 'region'>): boolean {
  return detectTrackRegion(track) === 'vn';
}

export function isKPopTrack(track: Pick<Track, 'title' | 'artist' | 'album' | 'genre' | 'region'>): boolean {
  return detectTrackRegion(track) === 'kpop';
}

export function isChillSpaceTrack(track: Pick<Track, 'title' | 'artist' | 'album' | 'genre' | 'mood'>): boolean {
  const titleGenreMood = `${track.title || ''} ${track.genre || ''} ${track.mood || ''}`.toLowerCase();
  return (
    track.genre.toLowerCase() === 'lo-fi & chill' ||
    /\b(chill|lofi|lo-fi|acoustic|piano|sleep|study|ambient)\b|nhẹ nhàng|êm dịu|sâu lắng/i.test(titleGenreMood)
  );
}

export function isTrackInSpace(
  track: Pick<Track, 'title' | 'artist' | 'album' | 'genre' | 'mood' | 'region'>,
  spaceId: MusicSpaceId
): boolean {
  if (spaceId === 'all') return true;
  if (spaceId === 'vn') return isVietnameseTrack(track);
  if (spaceId === 'us-uk') return isUsUkTrack(track);
  if (spaceId === 'kpop') return isKPopTrack(track);
  if (spaceId === 'chill') return isChillSpaceTrack(track);
  return true;
}

export function filterTracksBySpace<T extends Pick<Track, 'title' | 'artist' | 'album' | 'genre' | 'mood' | 'region'>>(
  tracks: T[],
  spaceId: MusicSpaceId
): T[] {
  if (spaceId === 'all') return tracks;
  return tracks.filter(t => isTrackInSpace(t, spaceId));
}

export function matchesGenreFilter(
  track: Pick<Track, 'title' | 'artist' | 'album' | 'genre' | 'region'>,
  genreName: string
): boolean {
  if (!genreName || genreName === 'all') return true;
  const target = genreName.trim().toLowerCase();
  if (track.genre.toLowerCase() === target) return true;
  if (target === 'us-uk' || target === 'us/uk' || target === 'us uk') {
    return isUsUkTrack(track);
  }
  if (target === 'k-pop' || target === 'kpop') {
    return isKPopTrack(track);
  }
  if (target === 'v-pop' || target === 'vpop') {
    return isVietnameseTrack(track) && track.genre.toLowerCase() === 'pop';
  }
  return false;
}
