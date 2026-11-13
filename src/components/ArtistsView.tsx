import React, { useMemo, useState } from 'react';
import { Play, Pause, Search, X, Mic2 } from 'lucide-react';
import { ArtistProfile } from '../types/music';
import { ArtistAvatar } from './ArtistAvatar';
import { usePlayer } from '../context/PlayerContext';
import { normalizeSearchText } from '../utils/artistSync';

interface ArtistsViewProps {
  artists: ArtistProfile[];
  onSelectArtist: (artist: ArtistProfile) => void;
}

type SortMode = 'tracks' | 'plays' | 'az';

export const ArtistsView: React.FC<ArtistsViewProps> = ({
  artists,
  onSelectArtist,
}) => {
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [filterQuery, setFilterQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('tracks');

  const totalUniqueSongs = useMemo(() => {
    const ids = new Set<string>();
    artists.forEach(a => a.tracks.forEach(t => ids.add(t.id)));
    return ids.size;
  }, [artists]);

  const visibleArtists = useMemo(() => {
    const q = normalizeSearchText(filterQuery);
    const filtered = q
      ? artists.filter(
          a =>
            normalizeSearchText(a.name).includes(q) ||
            a.genres.some(g => normalizeSearchText(g).includes(q)) ||
            a.tracks.some(t => normalizeSearchText(t.title).includes(q))
        )
      : [...artists];

    if (sortMode === 'az') {
      filtered.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    } else if (sortMode === 'plays') {
      filtered.sort(
        (a, b) =>
          b.totalPlays - a.totalPlays ||
          b.trackCount - a.trackCount ||
          a.name.localeCompare(b.name, 'vi')
      );
    } else {
      filtered.sort(
        (a, b) =>
          b.trackCount - a.trackCount ||
          b.totalPlays - a.totalPlays ||
          a.name.localeCompare(b.name, 'vi')
      );
    }

    return filtered;
  }, [artists, filterQuery, sortMode]);

  const handlePlayArtist = (artist: ArtistProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (artist.tracks.length === 0) return;

    const isPlayingThisArtist =
      isPlaying &&
      currentTrack &&
      artist.tracks.some(t => t.id === currentTrack.id);

    if (isPlayingThisArtist) {
      togglePlay();
    } else {
      playTrack(artist.tracks[0], artist.tracks);
    }
  };

  return (
    <div className="space-y-6 pb-12 text-[#f7f5f0]">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pt-1">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#f7f5f0]">
            Danh sách Nghệ sĩ
          </h2>
          <p className="text-xs sm:text-sm text-[#a3aed0] mt-1 tabular-nums">
            {artists.length} nghệ sĩ được đồng bộ tự động
            <span className="mx-1.5" aria-hidden="true">
              ·
            </span>
            {totalUniqueSongs} bài hát trong kho Soundly
          </p>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#a3aed0] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              placeholder="Lọc tên ca sĩ hoặc bài hát..."
              className="w-full min-h-[40px] pl-9.5 pr-8 py-2 bg-[#141d3d] hover:bg-[#1a254d] focus:bg-[#1a254d] text-xs text-[#f7f5f0] placeholder-[#7f8bb3] rounded-full border border-[#222f5e] focus:border-[#f47b64]/60 outline-none transition-colors"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#a3aed0] hover:text-[#f7f5f0]"
                aria-label="Xóa lọc nghệ sĩ"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#141d3d] border border-[#222f5e] rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSortMode('tracks')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                sortMode === 'tracks'
                  ? 'bg-[#f47b64] text-[#070b1a] font-bold'
                  : 'text-[#a3aed0] hover:text-[#f7f5f0]'
              }`}
            >
              Nhiều bài nhất
            </button>
            <button
              type="button"
              onClick={() => setSortMode('plays')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                sortMode === 'plays'
                  ? 'bg-[#f47b64] text-[#070b1a] font-bold'
                  : 'text-[#a3aed0] hover:text-[#f7f5f0]'
              }`}
            >
              Phổ biến
            </button>
            <button
              type="button"
              onClick={() => setSortMode('az')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                sortMode === 'az'
                  ? 'bg-[#f47b64] text-[#070b1a] font-bold'
                  : 'text-[#a3aed0] hover:text-[#f7f5f0]'
              }`}
            >
              A – Z
            </button>
          </div>
        </div>
      </div>

      {/* Spotify-Style Circular Artists Grid */}
      {visibleArtists.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-[#141d3d]/40 border border-[#1e2a54] text-[#a3aed0]">
          <Mic2 className="w-10 h-10 mx-auto mb-3 text-[#f47b64]/50" />
          <p className="text-sm font-bold text-[#f7f5f0]">
            Không tìm thấy nghệ sĩ phù hợp
          </p>
          <p className="text-xs text-[#8d99be] mt-1">
            Thử từ khóa khác hoặc tải thêm bài hát để đồng bộ danh sách ca sĩ.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4">
          {visibleArtists.map(artist => {
            const isArtistActive =
              currentTrack &&
              artist.tracks.some(t => t.id === currentTrack.id);
            const isArtistPlaying = Boolean(isArtistActive && isPlaying);

            return (
              <div
                key={artist.id}
                onClick={() => onSelectArtist(artist)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectArtist(artist);
                  }
                }}
                className={`group p-3.5 sm:p-4 rounded-2xl border hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 ease-out cursor-pointer flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f47b64] ${
                  isArtistActive
                    ? 'bg-[#1a254d] border-[#f47b64]/45'
                    : 'bg-[#121a3a]/80 hover:bg-[#19244f] border-[#1e2a54]'
                }`}
              >
                {/* Circular Avatar + Floating Play Button */}
                <div className="relative mx-auto w-full aspect-square max-w-[168px]">
                  <ArtistAvatar
                    artist={artist}
                    sizeClass="w-full h-full"
                    textSizeClass="text-2xl sm:text-3xl"
                    className="group-hover:scale-[1.02] transition-transform duration-200"
                  />

                  <button
                    type="button"
                    onClick={e => handlePlayArtist(artist, e)}
                    aria-label={
                      isArtistPlaying
                        ? `Tạm dừng nhạc của ${artist.name}`
                        : `Phát nhạc của ${artist.name}`
                    }
                    className={`absolute right-1.5 bottom-1.5 w-11 h-11 rounded-full bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 ${
                      isArtistPlaying
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0'
                    }`}
                  >
                    {isArtistPlaying ? (
                      <Pause className="w-5 h-5 fill-[#070b1a]" />
                    ) : (
                      <Play className="w-5 h-5 fill-[#070b1a] ml-0.5" />
                    )}
                  </button>
                </div>

                {/* Artist Name + Unboxed Metadata */}
                <div className="mt-3.5 text-center min-w-0">
                  <h3
                    className={`text-sm font-bold truncate ${
                      isArtistActive ? 'text-[#f47b64]' : 'text-[#f7f5f0]'
                    }`}
                  >
                    {artist.name}
                  </h3>
                  <p className="text-xs text-[#a3aed0] mt-1 truncate tabular-nums">
                    Nghệ sĩ
                    <span className="mx-1.5" aria-hidden="true">
                      ·
                    </span>
                    {artist.trackCount} bài hát
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
