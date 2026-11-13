import React from 'react';
import { Heart, Play, Pause } from 'lucide-react';
import { Track } from '../types/music';
import { TrackTable } from './TrackTable';
import { usePlayer } from '../context/PlayerContext';

interface LikedSongsViewProps {
  allTracks: Track[];
  onSelectArtist?: (artistName: string) => void;
}

export const LikedSongsView: React.FC<LikedSongsViewProps> = ({
  allTracks,
  onSelectArtist,
}) => {
  const { likedTrackIds, playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();

  const likedTracks = allTracks.filter(t => likedTrackIds.includes(t.id));
  const isLikedPlaying = likedTracks.some(t => t.id === currentTrack?.id) && isPlaying;

  const handlePlayAll = () => {
    if (likedTracks.length === 0) return;
    if (isLikedPlaying) {
      togglePlay();
    } else {
      playTrack(likedTracks[0], likedTracks);
    }
  };

  return (
    <div className="space-y-6 pb-12 text-[#f7f5f0]">
      {/* Soundly Signature Liked Songs Navy-to-Coral Gradient Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 p-6 sm:p-8 rounded-xl bg-gradient-to-b from-[#1e3278] via-[#131d47] to-[#0d142c] border border-[#222f5e] shadow-2xl">
        <div className="w-44 h-44 sm:w-56 sm:h-56 rounded-xl bg-gradient-to-br from-[#0c1957] via-[#273c8a] to-[#f47b64] flex items-center justify-center text-[#f7f5f0] shadow-2xl shrink-0">
          <Heart className="w-24 h-24 fill-[#f7f5f0]" />
        </div>

        <div className="flex-1 text-center sm:text-left min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-[#f47b64] mb-1">
            Danh sách phát
          </p>
          <h2 className="text-3xl sm:text-5xl font-black text-[#f7f5f0] tracking-tight py-1">
            Bài hát đã thích
          </h2>

          <div className="flex items-center justify-center sm:justify-start gap-2 mt-4 text-xs font-medium text-[#f7f5f0]">
            <span className="font-bold">Thư viện Soundly của bạn</span>
            <span>•</span>
            <span className="font-mono tabular-nums text-[#a3aed0]">{likedTracks.length} bài hát</span>
          </div>
        </div>
      </div>

      {/* Play Action */}
      {likedTracks.length > 0 && (
        <div className="px-2 py-2">
          <button
            onClick={handlePlayAll}
            className="w-14 h-14 rounded-full bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
            title={isLikedPlaying ? 'Tạm dừng' : 'Phát tất cả bài hát đã thích'}
          >
            {isLikedPlaying ? (
              <Pause className="w-6 h-6 fill-[#070b1a]" />
            ) : (
              <Play className="w-6 h-6 fill-[#070b1a] ml-1" />
            )}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#0d142c] rounded-xl p-2">
        {likedTracks.length > 0 ? (
          <TrackTable
            tracks={likedTracks}
            onPlayList={(list, idx) => playTrack(list[idx], list)}
            onSelectArtist={onSelectArtist}
          />
        ) : (
          <div className="py-16 text-center text-[#a3aed0]">
            <Heart className="w-12 h-12 mx-auto mb-3 text-[#f47b64]/45" />
            <p className="text-base font-bold text-[#f7f5f0]">Bạn chưa lưu bài hát nào</p>
            <p className="text-xs text-[#8d99be] mt-1 max-w-sm mx-auto">
              Lưu bài hát bằng cách nhấp vào biểu tượng trái tim.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
