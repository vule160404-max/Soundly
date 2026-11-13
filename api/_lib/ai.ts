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

const VIETNAMESE_ARTIST_DICTIONARY: Record<string, string> = {
  'buitruonglinh': 'buitruonglinh',
  'bui truong linh': 'Bùi Trường Linh',
  'le quyen': 'Lệ Quyên',
  'bang kieu': 'Bằng Kiều',
  'quang le': 'Quang Lê',
  'le quyen quang le': 'Lệ Quyên, Quang Lê',
  'hoai sa': 'Hoài Sa',
  'son tung m tp': 'Sơn Tùng M-TP',
  'den vau': 'Đen Vâu',
  'vu': 'Vũ.',
  'hoang dung': 'Hoàng Dũng',
  'phan manh quynh': 'Phan Mạnh Quỳnh',
  'ha anh tuan': 'Hà Anh Tuấn',
  'my tam': 'Mỹ Tâm',
  'noo phuoc thinh': 'Noo Phước Thịnh',
  'bich phuong': 'Bích Phương',
  'min': 'MIN',
  'erik': 'ERIK',
  'duc phuc': 'Đức Phúc',
  'hoa minzy': 'Hòa Minzy',
  'van mai huong': 'Văn Mai Hương',
  '중 quan idol': 'Trung Quân',
  'trung quan': 'Trung Quân',
  'chillies': 'Chillies',
  'dalab': 'Da LAB',
  'da lab': 'Da LAB',
  'justatee': 'JustaTee',
  'binz': 'Binz',
  'soobin': 'SOOBIN',
  'soobin hoang son': 'SOOBIN',
  'tlinh': 'tlinh',
  'mck': 'RPT MCK',
  'rpt mck': 'RPT MCK',
  'wren evans': 'Wren Evans',
  'mono': 'MONO',
  'grey d': 'GREY D',
  'amee': 'AMEE',
  'hieuthuhai': 'HIEUTHUHAI',
  'obito': 'Obito',
  'low g': 'Low G',
  'phuong ly': 'Phương Ly',
  'thinh suy': 'Thịnh Suy',
  'ngot': 'Ngọt',
  'ca hoi hoang': 'Cá Hồi Hoang',
  'quan a p': 'Quân A.P',
  'hai dang doo': 'Hải Đăng Doo',
  'quang dang tran': 'Quang Đăng Trần',
  'dangrangto': 'Dangrangto',
  'osad': 'OSAD',
  'ha an huy': 'Hà An Huy',
  'karik': 'Karik',
  'only c': 'Only C',
  'lou hoang': 'Lou Hoàng',
  '미u le': 'Miu Lê',
  'miu le': 'Miu Lê',
  'trinh thang binh': 'Trịnh Thăng Bình',
  'le bao binh': 'Lê Bảo Bình',
  'jack': 'Jack - J97',
  'k icm': 'K-ICM',
  'ho quang hieu': 'Hồ Quang Hiếu',
  'ung hoang phuc': 'Ưng Hoàng Phúc',
  'dan truong': 'Đan Trường',
  'cam ly': 'Cẩm Ly',
  'dam vinh hung': 'Đàm Vĩnh Hưng',
  'nhu quynh': 'Như Quỳnh',
  'manh quynh': 'Mạnh Quỳnh',
  'phi nhung': 'Phi Nhung',
  'dan nguyen': 'Đan Nguyên',
  'tuan vu': 'Tuấn Vũ',
  'che linh': 'Chế Linh',
  'khanh ly': 'Khánh Ly',
  'tuan ngoc': 'Tuấn Ngọc',
  'ngoc son': 'Ngọc Sơn',
};

const VIETNAMESE_TITLE_DICTIONARY: Record<string, { title: string; artist?: string; genre?: string }> = {
  'du cho mai ve sau': { title: 'Dù Cho Mai Về Sau', artist: 'buitruonglinh', genre: 'V-Pop' },
  'du cho mai ve sau acoustic version': { title: 'Dù Cho Mai Về Sau (Acoustic Version)', artist: 'buitruonglinh', genre: 'Ballad' },
  'du cho mai ve sau instrumental': { title: 'Dù Cho Mai Về Sau (Instrumental)', artist: 'buitruonglinh', genre: 'Ballad' },
  'em a': { title: 'Em À', artist: 'buitruonglinh', genre: 'V-Pop' },
  'cho em gan anh them chut nua feat. hoai sa': { title: 'Cho Em Gần Anh Thêm Chút Nữa (feat. Hoài Sa)', artist: 'Lệ Quyên', genre: 'Ballad' },
  'cho em gan anh them chut nua feat hoai sa': { title: 'Cho Em Gần Anh Thêm Chút Nữa (feat. Hoài Sa)', artist: 'Lệ Quyên', genre: 'Ballad' },
  'cho em gan anh them chut nua': { title: 'Cho Em Gần Anh Thêm Chút Nữa', artist: 'Lệ Quyên', genre: 'Ballad' },
  'giac mo co that': { title: 'Giấc Mơ Có Thật', artist: 'Lệ Quyên', genre: 'Ballad' },
  'tinh lo': { title: 'Tình Lỡ', artist: 'Lệ Quyên', genre: 'Ballad' },
  'e nho mot thoi ta a yeu': { title: 'Để Nhớ Một Thời Ta Đã Yêu', artist: 'Bằng Kiều', genre: 'Ballad' },
  'de nho mot thoi ta da yeu': { title: 'Để Nhớ Một Thời Ta Đã Yêu', artist: 'Bằng Kiều', genre: 'Ballad' },
  'sau tim thiep hong': { title: 'Sầu Tím Thiệp Hồng', artist: 'Lệ Quyên, Quang Lê', genre: 'Ballad' },
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
};

export function restoreVietnameseMetadataFromSlug(
  rawTitle: string,
  rawArtist: string
): { title: string; artist: string; genreHint?: string } {
  const cleanTitleKey = (rawTitle || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const cleanArtistKey = (rawArtist || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let restoredTitle = rawTitle.trim();
  let restoredArtist = rawArtist.trim();
  let genreHint: string | undefined;

  const titleMatch =
    VIETNAMESE_TITLE_DICTIONARY[cleanTitleKey] ||
    VIETNAMESE_TITLE_DICTIONARY[cleanTitleKey.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()];

  if (titleMatch) {
    restoredTitle = titleMatch.title;
    if (titleMatch.genre) genreHint = titleMatch.genre;
    if (
      titleMatch.artist &&
      (!restoredArtist ||
        restoredArtist === 'Nghệ sĩ chưa rõ' ||
        restoredArtist === restoredArtist.toLowerCase())
    ) {
      restoredArtist = titleMatch.artist;
    }
  }

  if (VIETNAMESE_ARTIST_DICTIONARY[cleanArtistKey]) {
    restoredArtist = VIETNAMESE_ARTIST_DICTIONARY[cleanArtistKey];
  }

  return { title: restoredTitle, artist: restoredArtist, genreHint };
}

export function fallbackClassify(
  items: ClassifyInputTrack[]
): ClassifiedTrackResult[] {
  return items.map(item => {
    const rawName = item.fileName || item.title || 'Bài hát không tên';
    const clean = rawName.replace(/\.[^/.]+$/, '');
    let artist =
      item.artist && item.artist !== 'Chờ AI nhận diện...'
        ? item.artist
        : 'Nghệ sĩ chưa rõ';
    let title = item.title && item.title !== rawName ? item.title : clean;

    if (clean.includes(' - ')) {
      const parts = clean.split(' - ');
      if (parts.length >= 2) {
        const potentialArtist = parts[0].replace(/^[0-9.\s]+/, '').trim();
        const potentialTitle = parts.slice(1).join(' - ').trim();
        if (potentialArtist && (artist === 'Nghệ sĩ chưa rõ' || artist === artist.toLowerCase())) {
          artist = potentialArtist;
        }
        if (potentialTitle) title = potentialTitle;
      }
    }

    const restored = restoreVietnameseMetadataFromSlug(title, artist);
    title = restored.title;
    artist = restored.artist;

    const lower = (title + ' ' + artist).toLowerCase();
    let genre = restored.genreHint || 'Pop';
    if (
      lower.includes('rap') ||
      lower.includes('hiphop') ||
      lower.includes('trap') ||
      lower.includes('đọc rap')
    ) {
      genre = 'Hip-Hop';
    } else if (
      lower.includes('lofi') ||
      lower.includes('chill') ||
      lower.includes('sleep') ||
      lower.includes('thư giãn') ||
      lower.includes('nhẹ nhàng')
    ) {
      genre = 'Lo-Fi & Chill';
    } else if (
      lower.includes('ballad') ||
      lower.includes('acoustic') ||
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
    } else if (
      lower.includes('r&b') ||
      lower.includes('soul') ||
      lower.includes('rnb')
    ) {
      genre = 'R&B';
    } else if (lower.includes('jazz')) {
      genre = 'Jazz';
    } else if (lower.includes('classical') || lower.includes('piano') || lower.includes('không lời')) {
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

    const prompt = `Bạn là chuyên gia phân loại âm nhạc (Music Curator AI) am hiểu sâu sắc nhạc Việt Nam (V-Pop, Ballad, Bolero, Indie, Rap Việt) và nhạc quốc tế.
Hãy phân tích danh sách bài hát bên dưới dựa trên tên tệp (fileName), tiêu đề hiện tại và nghệ sĩ để:
1. Khôi phục ĐẦY ĐỦ DẤU TIẾNG VIỆT và viết hoa chuẩn xác cho tên bài hát (suggestedTitle) và tên nghệ sĩ (suggestedArtist) nếu đầu vào bị mất dấu hoặc viết thường (ví dụ: "du cho mai ve sau" -> "Dù Cho Mai Về Sau", "e nho mot thoi ta a yeu" bị mất chữ đ -> "Để Nhớ Một Thời Ta Đã Yêu", "le quyen" -> "Lệ Quyên", "bang kieu" -> "Bằng Kiều", "le quyen quang le" -> "Lệ Quyên, Quang Lê").
2. Phân loại chính xác thể loại nhạc.

LƯU Ý QUAN TRỌNG:
- Định dạng tên file thường là "Nghệ sĩ - Tên bài hát". Phải tách đúng: suggestedArtist là Nghệ sĩ, suggestedTitle là Tên bài hát.
- Nếu bài hát có chữ "feat." hoặc "acoustic version" / "instrumental", hãy định dạng đẹp (ví dụ: "Cho Em Gần Anh Thêm Chút Nữa (feat. Hoài Sa)", "Dù Cho Mai Về Sau (Acoustic Version)").

DANH SÁCH THỂ LOẠI CHUẨN BẮT BUỘC (chỉ chọn 1 trong các giá trị sau cho trường genre):
[${allowedGenresList}]

Yêu cầu cho từng bài hát:
1. "id": Giữ nguyên id gốc của bài hát.
2. "genre": Chọn chính xác 1 thể loại phù hợp nhất trong danh sách ở trên.
3. "suggestedArtist": Tên nghệ sĩ/tác giả có đầy đủ dấu tiếng Việt chuẩn.
4. "suggestedTitle": Tên bài hát có đầy đủ dấu tiếng Việt chuẩn, sạch đẹp.
5. "mood": Tâm trạng ngắn gọn bằng tiếng Việt (ví dụ: "Sôi động", "Sâu lắng", "Thư giãn", "Lãng mạn").
6. "bpm": Ước lượng nhịp BPM (số nguyên từ 60 đến 180).
7. "reason": Giải thích ngắn gọn 1 câu bằng tiếng Việt lý do chọn thể loại này.

Danh sách bài hát cần phân loại:
${JSON.stringify(items, null, 2)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction:
          'You are a precise Spotify music genre classifier and metadata parser. Always return valid JSON matching the schema and strictly pick genres from the provided allowlist.',
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
