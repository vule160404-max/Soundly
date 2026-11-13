export interface LyricLine {
  time: number; // in seconds
  text: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  audioUrl: string;
  duration: number; // in seconds
  genre: string;
  releaseYear: number;
  lyrics: LyricLine[];
  bpm?: number;
  mood?: string;
  plays?: number;
  aiClassified?: boolean;
  aiReason?: string;
  spotifyTrackId?: string;
  spotifyUrl?: string;
  r2AudioKey?: string;
  r2CoverKey?: string;
  syncedLyrics?: string;
  plainLyrics?: string;
  lyricsMode?: 'synced' | 'plain' | 'none';
}

export interface Playlist {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  trackIds: string[];
  isCustom?: boolean;
  createdAt?: string;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface GenreCategory {
  id: string;
  name: string;
  accentColor: string;
  iconName: string;
  trackCount: number;
}

export interface ArtistProfile {
  id: string;
  name: string;
  normalizedKey: string;
  avatarUrl: string;
  isDefaultAvatar: boolean;
  tracks: Track[];
  trackCount: number;
  totalPlays: number;
  totalDuration: number;
  genres: string[];
  albums: string[];
  collaborators: string[];
  accentGradient: string;
}
