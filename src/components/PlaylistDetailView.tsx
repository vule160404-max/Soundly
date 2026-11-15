import React, { useMemo, useState, useEffect } from 'react';
import { Play, Pause, Shuffle, Music2, Trash2, Search } from 'lucide-react';
import { Playlist, Track } from '../types/music';
import { TrackTable } from './TrackTable';
import { usePlayer } from '../context/PlayerContext';

interface PlaylistDetailViewProps {
  playlist: Playlist;
  allTracks: Track[];
  onBackToHome: () => void;
  onSelectArtist?: (artistName: string) => void;
}

export const PlaylistDetailView: React.FC<PlaylistDetailViewProps> = ({
  playlist,
  allTracks,
  onBackToHome,
  onSelectArtist,
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

  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [coverFailed, setCoverFailed] = useState<boolean>(false);

  useEffect(() => {
    setSelectedGenre('all');
    setSearchText('');
    setCoverFailed(false);
  }, [playlist.id]);

  const playlistTracks = useMemo(() => {
    const byId = new Map<string, Track>();
    const bySpotifyId = new Map<string, Track>();
    for (const t of allTracks) {
      byId.set(t.id, t);
      if (t.spotifyTrackId) {
        bySpotifyId.set(t.spotifyTrackId, t);
      }
    }
    return playlist.trackIds
      .map(
        (id) =>
          byId.get(id) ||
          bySpotifyId.get(id) ||
          bySpotifyId.get(id.replace(/^spotflow-/, ''))
      )
      .filter((t): t is Track => t !== undefined);
  }, [playlist.trackIds, allTracks]);

  const genreCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of playlistTracks) {
      const g = (t.genre || 'Pop').trim();
      counts.set(g, (counts.get(g) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [playlistTracks]);

  const visibleTracks = useMemo(() => {
    let list = playlistTracks;
    if (selectedGenre !== 'all') {
      list = list.filter((t) => (t.genre || 'Pop') === selectedGenre);
    }
    const q = searchText.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          (t.genre || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [playlistTracks, selectedGenre, searchText]);

  const totalSeconds = visibleTracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  const totalMinutes = Math.floor(totalSeconds / 60);

  const isCurrentPlaylistPlaying =
    visibleTracks.some((t) => t.id === currentTrack?.id) && isPlaying;

  const handlePlayAll = () => {
    if (visibleTracks.length === 0) return;
    if (isCurrentPlaylistPlaying) {
      togglePlay();
    } else {
      playTrack(visibleTracks[0], visibleTracks);
    }
  };

  const handleShufflePlay = () => {
    if (visibleTracks.length === 0) return;
    if (!isShuffle) toggleShuffle();
    const isPlayingThisPlaylist = currentTrack && visibleTracks.some(t => t.id === currentTrack.id);
    if (!isPlayingThisPlaylist) {
      const randomIdx = Math.floor(Math.random() * visibleTracks.length);
      playTrack(visibleTracks[randomIdx], visibleTracks);
    }
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

  const resolvedCover = coverFailed
    ? '/assets/aistudio/soundly-default-cover.svg'
    : playlist.coverUrl || '/assets/aistudio/soundly-default-cover.svg';

  return (
    <div className="space-y-6 pb-12 text-[#f7f5f0]">
      {/* Soundly Navy Gradient Hero Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 p-6 sm:p-8 rounded-xl bg-gradient-to-b from-[#1d2d6b] via-[#131e48] to-[#0d142c] border border-[#222f5e] shadow-2xl">
        <img
          src={resolvedCover}
          alt={playlist.title}
          referrerPolicy="no-referrer"
          onError={() => setCoverFailed(true)}
          className="w-44 h-44 sm:w-56 sm:h-56 rounded-xl object-cover shadow-2xl shrink-0 bg-[#0d142c]"
        />

        <div className="flex-1 text-center sm:text-left min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-[#f47b64] mb-1">
            {playlist.isPublic
              ? 'Album tuyển chọn trên Soundly'
              : playlist.isCustom
                ? 'Album cá nhân trong thư viện'
                : 'Playlist tuyển tập'}
          </p>
          <h2 className="text-2xl sm:text-5xl font-black text-[#f7f5f0] tracking-tight break-words py-1">
            {playlist.title}
          </h2>
          <p className="text-xs sm:text-sm text-[#a3aed0] mt-2 line-clamp-2 leading-relaxed">
            {playlist.description}
          </p>

          <div className="flex items-center justify-center sm:justify-start gap-2 mt-4 text-xs text-[#f7f5f0] font-medium">
            <span className="font-bold text-[#f7f5f0]">Soundly</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#a3aed0] tabular-nums">{visibleTracks.length} bài hát</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#a3aed0] font-mono tabular-nums">
              khoảng {totalMinutes} phút
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons Row + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 py-1">
        <div className="flex items-center gap-4">
          <button
            onClick={handlePlayAll}
            disabled={visibleTracks.length === 0}
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
            disabled={visibleTracks.length === 0}
            title="Phát ngẫu nhiên"
            className="p-3 text-[#a3aed0] hover:text-[#f7f5f0] transition-colors disabled:opacity-40"
          >
            <Shuffle className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {playlistTracks.length > 0 && (
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-[#7f8bb3] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Tìm bài trong album..."
                className="w-full min-h-[40px] pl-9 pr-3 py-1.5 rounded-lg bg-[#141d3d] border border-[#222f5e] focus:border-[#f47b64] text-xs text-[#f7f5f0] placeholder:text-[#7f8bb3] outline-none transition-colors"
              />
            </div>
          )}

          {playlist.isCustom && !playlist.isPublic && (
            <button
              type="button"
              onClick={handleDelete}
              title="Xóa album này"
              className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa album</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Genre Filter Bar inside Album */}
      {genreCounts.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 px-2">
          <button
            type="button"
            onClick={() => setSelectedGenre('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              selectedGenre === 'all'
                ? 'bg-[#f47b64] text-[#070b1a]'
                : 'bg-[#141d3d] text-[#a3aed0] hover:text-[#f7f5f0] border border-[#1e2a54]'
            }`}
          >
            Tất cả ({playlistTracks.length})
          </button>
          {genreCounts.map(([genreName, count]) => (
            <button
              key={genreName}
              type="button"
              onClick={() => setSelectedGenre(genreName)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap tabular-nums ${
                selectedGenre === genreName
                  ? 'bg-[#f47b64] text-[#070b1a]'
                  : 'bg-[#141d3d] text-[#a3aed0] hover:text-[#f7f5f0] border border-[#1e2a54]'
              }`}
            >
              {genreName} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Tracks Table */}
      <div className="bg-[#0d142c] rounded-xl p-2">
        {visibleTracks.length > 0 ? (
          <TrackTable
            tracks={visibleTracks}
            customPlaylistId={playlist.isCustom && !playlist.isPublic ? playlist.id : undefined}
            onPlayList={(list, idx) => playTrack(list[idx], list)}
            onSelectArtist={onSelectArtist}
          />
        ) : (
          <div className="py-16 text-center text-[#a3aed0] space-y-3">
            <Music2 className="w-10 h-10 mx-auto text-[#f47b64]/45" />
            <p className="text-sm font-bold text-[#f7f5f0]">
              {playlistTracks.length > 0
                ? 'Không tìm thấy bài hát phù hợp với bộ lọc'
                : 'Album này chưa có bài hát nào'}
            </p>
            {playlistTracks.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedGenre('all');
                  setSearchText('');
                }}
                className="px-4 py-2 rounded-lg bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] font-bold text-xs transition-colors"
              >
                Xóa bộ lọc
              </button>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

