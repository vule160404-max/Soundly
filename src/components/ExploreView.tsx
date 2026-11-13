import React, { useMemo } from 'react';
import { Music, Sparkles, Mic2, ArrowRight } from 'lucide-react';
import { Track, GenreCategory, ArtistProfile } from '../types/music';
import { TrackTable } from './TrackTable';
import { ArtistAvatar } from './ArtistAvatar';
import { normalizeSearchText } from '../utils/artistSync';

interface ExploreViewProps {
  tracks: Track[];
  genres: GenreCategory[];
  artists: ArtistProfile[];
  searchQuery: string;
  activeGenre: string;
  setActiveGenre: (genre: string) => void;
  onSelectArtist: (artist: ArtistProfile) => void;
  onSelectArtistByName: (artistName: string) => void;
  onOpenArtists: () => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  tracks,
  genres,
  artists,
  searchQuery,
  activeGenre,
  setActiveGenre,
  onSelectArtist,
  onSelectArtistByName,
  onOpenArtists,
}) => {
  const filteredTracks =
    activeGenre === 'all'
      ? tracks
      : tracks.filter(t => t.genre.toLowerCase() === activeGenre.toLowerCase());

  const matchingArtists = useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    if (!q) return [];
    return artists
      .filter(a => normalizeSearchText(a.name).includes(q))
      .slice(0, 6);
  }, [artists, searchQuery]);

  // Soundly Curated Genre Palette (Harmonized Navy, Coral, Plum, Slate, Indigo tones)
  const getCardBg = (index: number) => {
    const colors = [
      'bg-[#1e3264]', // Navy Blue
      'bg-[#c4513d]', // Warm Terracotta Coral
      'bg-[#3d2c6d]', // Royal Indigo
      'bg-[#1b4965]', // Nordic Teal
      'bg-[#7b2cbf]', // Deep Violet
      'bg-[#2b4570]', // Steel Navy
      'bg-[#9e3b52]', // Berry Rose
      'bg-[#26547c]', // Ocean Slate
      'bg-[#503750]', // Muted Plum
      'bg-[#b55239]', // Burnt Coral
      'bg-[#2e4057]', // Midnight Slate
      'bg-[#476c9b]', // Sky Navy
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-8 pb-12 text-[#f7f5f0]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#f7f5f0] tracking-tight">
            {searchQuery.trim()
              ? `Kết quả tìm kiếm: “${searchQuery.trim()}”`
              : 'Duyệt tìm tất cả'}
          </h2>
          <p className="text-xs sm:text-sm text-[#a3aed0] mt-1">
            Khám phá 12 thể loại âm nhạc và danh sách nghệ sĩ trên Soundly.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenArtists}
          className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-full bg-[#141d3d] hover:bg-[#1c2852] border border-[#222f5e] text-xs font-bold text-[#f7f5f0] transition-colors self-start sm:self-auto whitespace-nowrap shrink-0"
        >
          <Mic2 className="w-4 h-4 text-[#f47b64]" />
          <span>Xem tất cả Nghệ sĩ ({artists.length})</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#a3aed0]" />
        </button>
      </div>

      {/* Matching Artists when searching */}
      {matchingArtists.length > 0 && (
        <section>
          <h3 className="text-lg font-bold text-[#f7f5f0] tracking-tight mb-3">
            Nghệ sĩ phù hợp
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {matchingArtists.map(artist => (
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
                className="group p-3.5 rounded-2xl bg-[#141d3d]/85 hover:bg-[#1c2852] border border-[#1e2a54] transition-all cursor-pointer flex flex-col items-center text-center"
              >
                <ArtistAvatar
                  artist={artist}
                  sizeClass="w-20 h-20 sm:w-24 sm:h-24"
                  textSizeClass="text-xl"
                  className="group-hover:scale-105 transition-transform"
                />
                <p className="mt-2.5 text-xs sm:text-sm font-bold text-[#f7f5f0] truncate w-full">
                  {artist.name}
                </p>
                <p className="text-[11px] text-[#a3aed0] mt-0.5 tabular-nums">
                  {artist.trackCount} bài hát
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Soundly Genre Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* All Tab */}
        <button
          onClick={() => setActiveGenre('all')}
          className={`p-4 rounded-xl text-left transition-all flex flex-col justify-between h-28 sm:h-32 relative overflow-hidden group shadow-md ${
            activeGenre === 'all'
              ? 'bg-[#f47b64] text-[#070b1a] ring-2 ring-[#f7f5f0]'
              : 'bg-[#141d3d] border border-[#222f5e] text-[#f7f5f0] hover:scale-[1.02]'
          }`}
        >
          <span className="text-base font-bold tracking-tight">Tất cả bài hát</span>
          <div className="text-xs opacity-85 tabular-nums">{tracks.length} bản nhạc</div>
          <Sparkles className="w-16 h-16 absolute -right-2 -bottom-2 opacity-20 transform rotate-12 group-hover:scale-110 transition-transform" />
        </button>

        {genres.map((genre, idx) => {
          const isSelected = activeGenre.toLowerCase() === genre.name.toLowerCase();
          const count = tracks.filter(
            t => t.genre.toLowerCase() === genre.name.toLowerCase()
          ).length;
          const bgClass = getCardBg(idx);

          return (
            <button
              key={genre.id}
              onClick={() => setActiveGenre(genre.name)}
              className={`p-4 rounded-xl text-left transition-all flex flex-col justify-between h-28 sm:h-32 relative overflow-hidden group shadow-md ${bgClass} text-[#f7f5f0] ${
                isSelected ? 'ring-2 ring-[#f47b64] scale-[1.02]' : 'hover:scale-[1.02]'
              }`}
            >
              <span className="text-base font-bold tracking-tight leading-snug pr-4">
                {genre.name}
              </span>
              <div className="text-xs opacity-85 font-medium tabular-nums">
                {count} bài hát
              </div>
              <Music className="w-16 h-16 absolute -right-2 -bottom-2 opacity-25 transform rotate-12 group-hover:scale-110 transition-transform" />
            </button>
          );
        })}
      </div>

      {/* Filtered Tracks Table */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-[#f7f5f0] tracking-tight">
            {activeGenre === 'all' ? 'Tất cả bài hát' : `Thể loại: ${activeGenre}`}
          </h3>
          <span className="text-xs text-[#a3aed0] font-mono tabular-nums">
            {filteredTracks.length} bài hát
          </span>
        </div>

        <div className="bg-[#0d142c] rounded-xl p-2">
          <TrackTable
            tracks={filteredTracks}
            onSelectArtist={onSelectArtistByName}
          />
        </div>
      </section>
    </div>
  );
};
