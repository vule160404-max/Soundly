import React from 'react';
import { Music, Sparkles } from 'lucide-react';
import { Track, GenreCategory } from '../types/music';
import { TrackTable } from './TrackTable';

interface ExploreViewProps {
  tracks: Track[];
  genres: GenreCategory[];
  activeGenre: string;
  setActiveGenre: (genre: string) => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  tracks,
  genres,
  activeGenre,
  setActiveGenre,
}) => {
  const filteredTracks =
    activeGenre === 'all'
      ? tracks
      : tracks.filter(t => t.genre.toLowerCase() === activeGenre.toLowerCase());

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
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#f7f5f0] tracking-tight">
          Duyệt tìm tất cả
        </h2>
        <p className="text-xs sm:text-sm text-[#a3aed0] mt-1">
          Khám phá 12 thể loại âm nhạc chọn lọc, nghe hoàn toàn miễn phí trên Soundly.
        </p>
      </div>

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
          <div className="text-xs opacity-85">{tracks.length} bản nhạc</div>
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
              <div className="text-xs opacity-85 font-medium">{count} bài hát</div>
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
          <TrackTable tracks={filteredTracks} />
        </div>
      </section>
    </div>
  );
};
