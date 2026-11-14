import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  ListPlus,
  Pause,
  Play,
  Search,
  Shuffle,
  X,
  Check,
} from 'lucide-react';
import { ArtistProfile } from '../types/music';
import { ArtistAvatar } from './ArtistAvatar';
import { TrackTable } from './TrackTable';
import { usePlayer } from '../context/PlayerContext';
import { findArtistByNameOrId, normalizeSearchText } from '../utils/artistSync';

interface ArtistDetailViewProps {
  artist: ArtistProfile;
  allArtists: ArtistProfile[];
  onBackToArtists: () => void;
  onSelectArtist: (artist: ArtistProfile) => void;
}

export const ArtistDetailView: React.FC<ArtistDetailViewProps> = ({
  artist,
  allArtists,
  onBackToArtists,
  onSelectArtist,
}) => {
  const {
    playTrack,
    currentTrack,
    isPlaying,
    togglePlay,
    toggleShuffle,
    isShuffle,
    addToQueue,
  } = usePlayer();

  const [localSearch, setLocalSearch] = useState('');
  const [queuedNotice, setQueuedNotice] = useState(false);

  const visibleTracks = useMemo(() => {
    const q = normalizeSearchText(localSearch);
    if (!q) return artist.tracks;
    return artist.tracks.filter(
      t =>
        normalizeSearchText(t.title).includes(q) ||
        normalizeSearchText(t.album || '').includes(q) ||
        normalizeSearchText(t.genre || '').includes(q)
    );
  }, [artist.tracks, localSearch]);

  const totalMinutes = Math.max(1, Math.round(artist.totalDuration / 60));

  const isPlayingThisArtist =
    isPlaying &&
    currentTrack &&
    artist.tracks.some(t => t.id === currentTrack.id);

  const handlePlayAll = () => {
    if (artist.tracks.length === 0) return;
    if (isPlayingThisArtist) {
      togglePlay();
    } else {
      playTrack(artist.tracks[0], artist.tracks);
    }
  };

  const handleShufflePlay = () => {
    if (artist.tracks.length === 0) return;
    if (!isShuffle) toggleShuffle();
    const isPlayingThisArtist = currentTrack && artist.tracks.some(t => t.id === currentTrack.id);
    if (!isPlayingThisArtist) {
      const randomIdx = Math.floor(Math.random() * artist.tracks.length);
      playTrack(artist.tracks[randomIdx], artist.tracks);
    }
  };

  const handleQueueAll = () => {
    if (artist.tracks.length === 0) return;
    artist.tracks.forEach(t => addToQueue(t));
    setQueuedNotice(true);
    setTimeout(() => setQueuedNotice(false), 2200);
  };

  const handleSelectArtistByName = (name: string) => {
    const found = findArtistByNameOrId(allArtists, name);
    if (found) onSelectArtist(found);
  };

  const relatedArtists = useMemo(() => {
    const picked: ArtistProfile[] = [];
    const seenIds = new Set<string>([artist.id]);

    for (const collabName of artist.collaborators) {
      const match = findArtistByNameOrId(allArtists, collabName);
      if (match && !seenIds.has(match.id)) {
        seenIds.add(match.id);
        picked.push(match);
      }
    }

    if (picked.length < 6) {
      for (const candidate of allArtists) {
        if (seenIds.has(candidate.id)) continue;
        const sharesGenre = candidate.genres.some(g => artist.genres.includes(g));
        if (sharesGenre) {
          seenIds.add(candidate.id);
          picked.push(candidate);
          if (picked.length >= 6) break;
        }
      }
    }

    return picked.slice(0, 6);
  }, [artist, allArtists]);

  return (
    <div className="space-y-7 pb-12 text-[#f7f5f0]">
      {/* Back Breadcrumb */}
      <div>
        <button
          type="button"
          onClick={onBackToArtists}
          className="inline-flex items-center gap-2 min-h-[40px] px-3 py-1.5 rounded-full bg-[#141d3d] hover:bg-[#1c2852] border border-[#222f5e] text-xs font-bold text-[#a3aed0] hover:text-[#f7f5f0] transition-colors whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Danh sách nghệ sĩ</span>
        </button>
      </div>

      {/* Spotify-Style Artist Hero Banner */}
      <div
        className={`flex flex-col sm:flex-row items-center sm:items-end gap-6 p-6 sm:p-8 rounded-2xl bg-gradient-to-b ${artist.accentGradient} border border-[#222f5e] shadow-2xl relative overflow-hidden`}
      >
        <ArtistAvatar
          artist={artist}
          sizeClass="w-36 h-36 sm:w-48 sm:h-48"
          textSizeClass="text-4xl sm:text-5xl"
          className="ring-2 ring-white/15 shadow-2xl"
        />

        <div className="flex-1 text-center sm:text-left min-w-0">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#f47b64] mb-1.5">
            <BadgeCheck className="w-4 h-4 shrink-0" />
            <span>Nghệ sĩ trên Soundly</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-[#f7f5f0] tracking-tight break-words leading-tight">
            {artist.name}
          </h2>

          {/* Unboxed Clean Metadata */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-4 text-xs sm:text-sm text-[#a3aed0] tabular-nums">
            <span className="font-semibold text-[#f7f5f0]">
              {artist.trackCount} bài hát đã đồng bộ
            </span>
            <span aria-hidden="true">·</span>
            <span>khoảng {totalMinutes} phút</span>
            {artist.genres.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>{artist.genres.slice(0, 3).join(', ')}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePlayAll}
            disabled={artist.tracks.length === 0}
            aria-label={isPlayingThisArtist ? 'Tạm dừng' : `Phát nhạc của ${artist.name}`}
            className="w-14 h-14 rounded-full bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 disabled:opacity-40 transition-all shrink-0"
          >
            {isPlayingThisArtist ? (
              <Pause className="w-6 h-6 fill-[#070b1a]" />
            ) : (
              <Play className="w-6 h-6 fill-[#070b1a] ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleShufflePlay}
            disabled={artist.tracks.length === 0}
            className="min-h-[44px] px-4 py-2 rounded-full bg-[#141d3d] hover:bg-[#1c2852] border border-[#222f5e] text-xs font-bold text-[#f7f5f0] flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
          >
            <Shuffle className="w-4 h-4 text-[#f47b64]" />
            <span>Phát ngẫu nhiên</span>
          </button>

          <button
            type="button"
            onClick={handleQueueAll}
            disabled={artist.tracks.length === 0}
            className="min-h-[44px] px-4 py-2 rounded-full bg-[#141d3d] hover:bg-[#1c2852] border border-[#222f5e] text-xs font-bold text-[#a3aed0] hover:text-[#f7f5f0] flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
          >
            {queuedNotice ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300">Đã thêm vào hàng đợi</span>
              </>
            ) : (
              <>
                <ListPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Thêm vào hàng đợi</span>
              </>
            )}
          </button>
        </div>

        {artist.tracks.length > 4 && (
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#a3aed0] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              placeholder={`Tìm trong nhạc của ${artist.name}...`}
              className="w-full min-h-[40px] pl-9.5 pr-8 py-2 bg-[#141d3d] focus:bg-[#1a254d] text-xs text-[#f7f5f0] placeholder-[#7f8bb3] rounded-full border border-[#222f5e] focus:border-[#f47b64]/60 outline-none"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#a3aed0] hover:text-[#f7f5f0]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Synchronized Songs Table */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-lg sm:text-xl font-bold text-[#f7f5f0] tracking-tight">
            Bài hát của {artist.name}
          </h3>
          <span className="text-xs text-[#a3aed0] font-mono tabular-nums">
            {visibleTracks.length} bài hát
          </span>
        </div>

        <div className="bg-[#0d142c] rounded-xl p-2">
          <TrackTable
            tracks={visibleTracks}
            onPlayList={(list, idx) => playTrack(list[idx], list)}
            onSelectArtist={handleSelectArtistByName}
          />
        </div>
      </section>

      {/* Related / Collaborating Artists */}
      {relatedArtists.length > 0 && (
        <section>
          <h3 className="text-lg sm:text-xl font-bold text-[#f7f5f0] tracking-tight mb-3.5 px-1">
            Nghệ sĩ hợp tác & cùng phong cách
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {relatedArtists.map(rel => (
              <div
                key={rel.id}
                onClick={() => onSelectArtist(rel)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectArtist(rel);
                  }
                }}
                className="group p-3.5 rounded-2xl bg-[#121a3a]/80 hover:bg-[#19244f] border border-[#1e2a54] transition-all cursor-pointer flex flex-col items-center text-center"
              >
                <ArtistAvatar
                  artist={rel}
                  sizeClass="w-24 h-24 sm:w-28 sm:h-28"
                  textSizeClass="text-xl"
                  className="group-hover:scale-105 transition-transform"
                />
                <p className="mt-3 text-xs sm:text-sm font-bold text-[#f7f5f0] truncate w-full">
                  {rel.name}
                </p>
                <p className="text-[11px] text-[#a3aed0] mt-0.5 tabular-nums">
                  {rel.trackCount} bài hát
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
