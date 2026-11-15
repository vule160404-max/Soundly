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
  region?: 'vn' | 'us-uk' | 'kpop' | 'other';
  spotifyTrackId?: string;
  spotifyUrl?: string;
  r2AudioKey?: string;
  r2CoverKey?: string;
  id3Checked?: boolean;
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
  isPublic?: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  spotifyUrl?: string;
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

export type TrendingChartRegion = 'vn' | 'global';

export interface TrendingChartEntry {
  trackId: string;
  spotifyRank: number;
  previousRank?: number | null;
  rankDelta: number;
  isNew?: boolean;
  peakRank?: number | null;
  spotifyTrackId?: string;
  spotifyTitle?: string;
  spotifyArtist?: string;
}

export interface TrendingChartMissingEntry {
  spotifyRank: number;
  title: string;
  artist: string;
  spotifyTrackId?: string;
  spotifyUrl?: string;
  rankDelta?: number;
  isNew?: boolean;
}

export interface TrendingChartSnapshot {
  id: string;
  region: TrendingChartRegion;
  title: string;
  sourceLabel: string;
  sourceUrl: string;
  customSpotifyUrl?: string;
  updatedAt: string;
  nextAutoSyncAt: string;
  totalSpotifyEntries: number;
  matchedCount: number;
  entries: TrendingChartEntry[];
  missingEntries: TrendingChartMissingEntry[];
}

