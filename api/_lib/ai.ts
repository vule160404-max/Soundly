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
    let title = clean;

    if (clean.includes('-')) {
      const parts = clean.split('-');
      if (parts.length >= 2) {
        const potentialArtist = parts[0].replace(/^[0-9.\s]+/, '').trim();
        const potentialTitle = parts.slice(1).join('-').trim();
        if (potentialArtist) artist = potentialArtist;
        if (potentialTitle) title = potentialTitle;
      }
    }

    const lower = (title + ' ' + artist).toLowerCase();
    let genre = 'Pop';
    if (
      lower.includes('rap') ||
      lower.includes('hiphop') ||
      lower.includes('trap')
    ) {
      genre = 'Hip-Hop';
    } else if (
      lower.includes('lofi') ||
      lower.includes('chill') ||
      lower.includes('sleep')
    ) {
      genre = 'Lo-Fi & Chill';
    } else if (lower.includes('ballad') || lower.includes('acoustic')) {
      genre = 'Ballad';
    } else if (lower.includes('rock') || lower.includes('metal')) {
      genre = 'Rock';
    } else if (
      lower.includes('edm') ||
      lower.includes('remix') ||
      lower.includes('dance') ||
      lower.includes('house')
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
    } else if (lower.includes('classical') || lower.includes('piano')) {
      genre = 'Classical';
    } else if (lower.includes('indie') || lower.includes('folk')) {
      genre = 'Indie';
    }

    return {
      id: item.id,
      genre,
      mood: 'Thư giãn & Dễ chịu',
      bpm: 110,
      suggestedTitle: title,
      suggestedArtist: artist,
      reason: 'Phân loại tự động thông minh Soundly AI.',
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

    const prompt = `Bạn là chuyên gia phân loại âm nhạc (Music Curator AI).
Hãy phân tích danh sách bài hát bên dưới dựa trên tên tệp (fileName), tiêu đề hiện tại và nghệ sĩ để phân loại chính xác thể loại nhạc và tách chuẩn xác tên tác giả/nghệ sĩ và tên bài hát.
LƯU Ý QUAN TRỌNG:
- Định dạng tên file thường là "Nghệ sĩ - Tên bài hát". Phải tách đúng: suggestedArtist là Nghệ sĩ, suggestedTitle là Tên bài hát (không được nhầm lẫn ngược lại).
- Nếu tên file chỉ có 1 vế, hãy phân tích kỹ để gán đúng nghệ sĩ và tên bài hát.

DANH SÁCH THỂ LOẠI CHUẨN BẮT BUỘC (chỉ chọn 1 trong các giá trị sau cho trường genre):
[${allowedGenresList}]

Yêu cầu cho từng bài hát:
1. "id": Giữ nguyên id gốc của bài hát.
2. "genre": Chọn chính xác 1 thể loại phù hợp nhất trong danh sách ở trên.
3. "suggestedArtist": Tên nghệ sĩ/tác giả (trích xuất chuẩn từ tên file hoặc tiêu đề).
4. "suggestedTitle": Tên bài hát sạch đẹp (loại bỏ tên nghệ sĩ, ký tự rác như [Official MV], (320kbps), .mp3).
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
