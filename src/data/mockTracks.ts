import { Track, Playlist, GenreCategory } from '../types/music';

// All initial mock tracks removed per user request — Admin uploads real tracks via file batch upload.
export const INITIAL_TRACKS: Track[] = [];

// All initial mock playlists removed.
export const INITIAL_PLAYLISTS: Playlist[] = [];

// Authentic Spotify-style Music Genres
export const INITIAL_GENRES: GenreCategory[] = [
  { id: 'pop', name: 'Pop', accentColor: 'bg-[#8400e7] text-white', iconName: 'Sparkles', trackCount: 0 },
  { id: 'v-pop', name: 'V-Pop', accentColor: 'bg-[#e91429] text-white', iconName: 'Music', trackCount: 0 },
  { id: 'us-uk', name: 'US-UK', accentColor: 'bg-[#1d4ed8] text-white', iconName: 'Globe', trackCount: 0 },
  { id: 'hip-hop', name: 'Hip-Hop', accentColor: 'bg-[#e13300] text-white', iconName: 'Mic2', trackCount: 0 },
  { id: 'rnb', name: 'R&B', accentColor: 'bg-[#1e3264] text-white', iconName: 'Heart', trackCount: 0 },
  { id: 'rock', name: 'Rock', accentColor: 'bg-[#b02897] text-white', iconName: 'Flame', trackCount: 0 },
  { id: 'edm-electronic', name: 'EDM / Electronic', accentColor: 'bg-[#0d73ec] text-white', iconName: 'Zap', trackCount: 0 },
  { id: 'indie', name: 'Indie', accentColor: 'bg-[#148a08] text-white', iconName: 'Compass', trackCount: 0 },
  { id: 'ballad', name: 'Ballad', accentColor: 'bg-[#27856a] text-white', iconName: 'Headphones', trackCount: 0 },
  { id: 'lofi-chill', name: 'Lo-Fi & Chill', accentColor: 'bg-[#503750] text-white', iconName: 'Coffee', trackCount: 0 },
  { id: 'k-pop', name: 'K-Pop', accentColor: 'bg-[#dc148c] text-white', iconName: 'Star', trackCount: 0 },
  { id: 'jazz', name: 'Jazz', accentColor: 'bg-[#bc5900] text-white', iconName: 'Disc', trackCount: 0 },
  { id: 'classical', name: 'Classical', accentColor: 'bg-[#477d95] text-white', iconName: 'Music', trackCount: 0 },
];

export const SPOTIFY_GENRE_NAMES: string[] = INITIAL_GENRES.map(g => g.name);
