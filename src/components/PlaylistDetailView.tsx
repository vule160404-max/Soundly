import React from 'react';
import { Play, Pause, Shuffle, Music2, Trash2 } from 'lucide-react';
import { Playlist, Track } from '../types/music';
import { TrackTable } from './TrackTable';
import { usePlayer } from '../context/PlayerContext';

interface PlaylistDetailViewProps {
  playlist: Playlist;
  allTracks: Track[];
  onBackToHome: () => void;
}

export const PlaylistDetailView: React.FC<PlaylistDetailViewProps> = ({
  playlist,
  allTracks,
  onBackToHome
}) => {
  const {
    playTrack,
    toggleShuffle,
    isShuffle,
    deletePlaylist,
    currentTrack,
    isPlaying,
    togglePlay,
    openConfirmDialog,
  } = usePlayer();

  const playlistTracks = playlist.trackIds
    .map((id) => allTracks.find((t) => t.id === id))
    .filter((t): t is Track => t !== undefined);

  const totalSeconds = playlistTracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  const totalMinutes = Math.floor(totalSeconds / 60);

  const isCurrentPlaylistPlaying =
    playlistTracks.some((t) => t.id === currentTrack?.id) && isPlaying;

  const handlePlayAll = () => {
    if (playlistTracks.length === 0) return;
    if (isCurrentPlaylistPlaying) {
      togglePlay();
    } else {
      playTrack(playlistTracks[0], playlistTracks);
    }
  };

  const handleShufflePlay = () => {
    if (playlistTracks.length === 0) return;
    if (!isShuffle) toggleShuffle();
    const randomIdx = Math.floor(Math.random() * playlistTracks.length);
    playTrack(playlistTracks[randomIdx], playlistTracks);
  };

  const handleDelete = () => {
    openConfirmDialog({
      title: 'Xóa album khỏi thư viện',
      description: 'Thao tác này sẽ xóa album cá nhân',
      highlight: playlist.title,
      confirmLabel: 'Xóa album',
      cancelLabel: 'Giữ lại',
      tone: 'danger',
      onConfirm: () => {
        deletePlaylist(playlist.id);
        onBackToHome();
      },
    });
  };

  return (
    <div className="space-y-6 pb-12 text-[#f7f5f0]">
      {/* Soundly Navy Gradient Hero Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 p-6 sm:p-8 rounded-xl bg-gradient-to-b from-[#1d2d6b] via-[#131e48] to-[#0d142c] border border-[#222f5e] shadow-2xl">
        <img
          src={playlist.coverUrl}
          alt={playlist.title}
          referrerPolicy="no-referrer"
          className="w-44 h-44 sm:w-56 sm:h-56 rounded-xl object-cover shadow-2xl shrink-0"
        />

        <div className="flex-1 text-center sm:text-left min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-[#f47b64] mb-1">
            {playlist.isCustom ? 'Album cá nhân trong thư viện' : 'Playlist tuyển tập'}
          </p>
          <h2 className="text-2xl sm:text-5xl font-black text-[#f7f5f0] tracking-tight break-words py-1">
            {playlist.title}
          </h2>
          <p className="text-xs sm:text-sm text-[#a3aed0] mt-2 line-clamp-2 leading-relaxed">
            {playlist.description}
          </p>

          <div className="flex items-center justify-center sm:justify-start gap-2 mt-4 text-xs text-[#f7f5f0] font-medium">
            <span className="font-bold text-[#f7f5f0]">Soundly</span>
            <span>•</span>
            <span className="text-[#a3aed0]">{playlistTracks.length} bài hát</span>
            <span>•</span>
            <span className="text-[#a3aed0] font-mono tabular-nums">
              khoảng {totalMinutes} phút
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="flex items-center justify-between px-2 py-2">
        <div className="flex items-center gap-4">
          {/* Big Soundly Coral Play Button */}
          <button
            onClick={handlePlayAll}
            disabled={playlistTracks.length === 0}
            className="w-14 h-14 rounded-full bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 disabled:opacity-40 transition-all"
            title={isCurrentPlaylistPlaying ? 'Tạm dừng' : 'Phát album'}
          >
            {isCurrentPlaylistPlaying ? (
              <Pause className="w-6 h-6 fill-[#070b1a]" />
            ) : (
              <Play className="w-6 h-6 fill-[#070b1a] ml-1" />
            )}
          </button>

          <button
            onClick={handleShufflePlay}
            disabled={playlistTracks.length === 0}
            title="Phát ngẫu nhiên"
            className="p-3 text-[#a3aed0] hover:text-[#f7f5f0] transition-colors disabled:opacity-40"
          >
            <Shuffle className="w-6 h-6" />
          </button>
        </div>

        {playlist.isCustom && (
          <button
            type="button"
            onClick={handleDelete}
            title="Xóa album này"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Xóa album</span>
          </button>
        )}
      </div>

      {/* Tracks Table */}
      <div className="bg-[#0d142c] rounded-xl p-2">
        {playlistTracks.length > 0 ? (
          <TrackTable
            tracks={playlistTracks}
            customPlaylistId={playlist.isCustom ? playlist.id : undefined}
            onPlayList={(list, idx) => playTrack(list[idx], list)}
          />
        ) : (
          <div className="py-16 text-center text-[#a3aed0] space-y-3">
            <Music2 className="w-10 h-10 mx-auto text-[#f47b64]/45" />
            <p className="text-sm font-bold text-[#f7f5f0]">Album này chưa có bài hát nào</p>
            <p className="text-xs text-[#8d99be] max-w-sm mx-auto leading-relaxed">
              Nhấn nút <strong>Thêm / biểu tượng thư mục (+)</strong> trên mỗi bài hát ở Trang chủ hoặc Khám phá để thêm nhạc vào album này.
            </p>
            <button
              type="button"
              onClick={onBackToHome}
              className="px-4 py-2 rounded-full bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] font-bold text-xs transition-colors"
            >
              Chọn bài hát ngay
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
