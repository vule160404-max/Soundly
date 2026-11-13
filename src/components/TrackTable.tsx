import React, { useState } from 'react';
import {
  Play,
  Heart,
  MoreVertical,
  MoreHorizontal,
  ListPlus,
  FolderPlus,
  Check,
  Sparkles,
  Trash2
} from 'lucide-react';
import { Track } from '../types/music';
import { usePlayer } from '../context/PlayerContext';

interface TrackTableProps {
  tracks: Track[];
  onPlayList?: (tracks: Track[], startIndex: number) => void;
  showCover?: boolean;
  customPlaylistId?: string;
}

export const TrackTable: React.FC<TrackTableProps> = ({
  tracks,
  onPlayList,
  showCover = true,
  customPlaylistId,
}) => {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
    toggleLike,
    isLiked,
    addToQueue,
    userPlaylists,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    openAlbumPicker,
  } = usePlayer();

  const [activeMenuTrackId, setActiveMenuTrackId] = useState<string | null>(null);
  const [addedPlaylistToast, setAddedPlaylistToast] = useState<string | null>(null);

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleRowClick = (track: Track, index: number) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      if (onPlayList) {
        onPlayList(tracks, index);
      } else {
        playTrack(track, tracks);
      }
    }
  };

  const handleAddToPlaylist = (
    playlistId: string,
    track: Track,
    playlistTitle: string
  ) => {
    addTrackToPlaylist(playlistId, track.id, track.coverUrl);
    setActiveMenuTrackId(null);
    setAddedPlaylistToast(`Đã thêm vào "${playlistTitle}"`);
    setTimeout(() => setAddedPlaylistToast(null), 2500);
  };

  if (tracks.length === 0) {
    return (
      <div className="py-16 text-center text-[#a3aed0]">
        <Sparkles className="w-8 h-8 mx-auto mb-3 text-[#f47b64]/50" />
        <p className="text-sm font-semibold text-[#f7f5f0]">Không tìm thấy bài hát nào phù hợp</p>
        <p className="text-xs text-[#8d99be] mt-1">Thử thay đổi từ khóa tìm kiếm hoặc chọn thể loại khác</p>
      </div>
    );
  }

  return (
    <div className="w-full relative select-none">
      {/* Toast notification */}
      {addedPlaylistToast && (
        <div className="fixed top-16 right-4 md:right-8 z-50 bg-[#f47b64] text-[#070b1a] text-xs font-bold px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-[#070b1a] stroke-[3]" />
          <span>{addedPlaylistToast}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* MOBILE LIST VIEW (Soundly Navy touch layout)             */}
      {/* ======================================================== */}
      <div className="md:hidden divide-y divide-[#1e2a54]">
        {tracks.map((track, idx) => {
          const isCurrent = currentTrack?.id === track.id;
          const isCurrentPlaying = isCurrent && isPlaying;
          const liked = isLiked(track.id);
          const isMenuOpen = activeMenuTrackId === track.id;
          const savedAlbumsCount = userPlaylists.filter((pl) =>
            pl.trackIds.includes(track.id)
          ).length;

          return (
            <div
              key={`mobile-${track.id}`}
              onClick={() => handleRowClick(track, idx)}
              className={`flex items-center justify-between p-2.5 rounded-xl active:bg-[#1c2852] transition-colors ${
                isCurrent ? 'bg-[#1c2852]/75' : ''
              }`}
            >
              {/* Cover Art + Info */}
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                <div className="relative shrink-0 w-12 h-12 rounded-md overflow-hidden bg-[#141d3d]">
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  {isCurrentPlaying && (
                    <div className="absolute inset-0 bg-[#070b1a]/45 flex items-center justify-center">
                      <div className="flex items-end gap-0.5 h-3">
                        <span className="w-0.5 bg-[#f47b64] rounded-full animate-bounce" style={{ height: '100%', animationDelay: '0ms' }} />
                        <span className="w-0.5 bg-[#f47b64] rounded-full animate-bounce" style={{ height: '60%', animationDelay: '150ms' }} />
                        <span className="w-0.5 bg-[#f47b64] rounded-full animate-bounce" style={{ height: '80%', animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-[#f47b64]' : 'text-[#f7f5f0]'}`}>
                    {track.title}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-[#a3aed0] truncate mt-0.5">
                    <span className="truncate">{track.artist}</span>
                    <span>•</span>
                    <span className="font-mono tabular-nums shrink-0">{formatDuration(track.duration)}</span>
                  </div>
                </div>
              </div>

              {/* Mobile Action Buttons (Visible Add-to-Album + Heart + More) */}
              <div className="flex items-center relative shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => openAlbumPicker(track)}
                  title={
                    savedAlbumsCount > 0
                      ? `Đã lưu trong ${savedAlbumsCount} album • Nhấn để chỉnh sửa`
                      : 'Thêm vào album trong thư viện'
                  }
                  className={`min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center transition-colors ${
                    savedAlbumsCount > 0
                      ? 'text-[#f47b64] bg-[#f47b64]/15'
                      : 'text-[#a3aed0] hover:text-[#f7f5f0] active:bg-[#162047]'
                  }`}
                >
                  {savedAlbumsCount > 0 ? (
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  ) : (
                    <FolderPlus className="w-4 h-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => toggleLike(track.id)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#a3aed0] active:scale-125 transition-transform"
                >
                  <Heart className={`w-4 h-4 ${liked ? 'fill-[#f47b64] text-[#f47b64]' : 'text-[#6e7ba8]'}`} />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMenuTrackId(isMenuOpen ? null : track.id)}
                  className="min-h-[40px] min-w-[36px] flex items-center justify-center text-[#a3aed0] active:text-[#f7f5f0]"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* Mobile Dropdown Menu */}
                {isMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 z-30 w-56 bg-[#141d3d] rounded-xl shadow-2xl border border-[#2b3b75] p-2 text-xs text-[#f7f5f0] animate-in fade-in"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenuTrackId(null);
                        openAlbumPicker(track);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#f47b64] font-bold hover:bg-[#1c2852] text-left min-h-[42px]"
                    >
                      <FolderPlus className="w-4 h-4 shrink-0" />
                      <span>Thêm vào album của bạn</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        addToQueue(track);
                        setActiveMenuTrackId(null);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#f7f5f0] hover:bg-[#1c2852] text-left min-h-[42px]"
                    >
                      <ListPlus className="w-4 h-4 text-[#a3aed0]" />
                      <span>Thêm vào hàng đợi</span>
                    </button>

                    {customPlaylistId && (
                      <button
                        type="button"
                        onClick={() => {
                          removeTrackFromPlaylist(customPlaylistId, track.id);
                          setActiveMenuTrackId(null);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-rose-400 hover:bg-[#1c2852] text-left min-h-[42px]"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        <span>Gỡ khỏi album này</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* DESKTOP TABLE VIEW (Soundly Navy Desktop Rows)           */}
      {/* ======================================================== */}
      <div className="hidden md:block">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-3 px-4 py-2.5 text-[11px] font-semibold text-[#a3aed0] uppercase tracking-wider border-b border-[#1e2a54]">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-4">Tiêu đề</div>
          <div className="col-span-3">Album</div>
          <div className="col-span-2">Thể loại</div>
          <div className="col-span-2 text-right">Thao tác</div>
        </div>

        {/* Table Rows */}
        <div className="mt-1">
          {tracks.map((track, idx) => {
            const isCurrent = currentTrack?.id === track.id;
            const isCurrentPlaying = isCurrent && isPlaying;
            const liked = isLiked(track.id);
            const isMenuOpen = activeMenuTrackId === track.id;
            const savedAlbumsCount = userPlaylists.filter((pl) =>
              pl.trackIds.includes(track.id)
            ).length;

            return (
              <div
                key={track.id}
                onClick={() => handleRowClick(track, idx)}
                className={`group grid grid-cols-12 gap-3 px-4 py-2 items-center rounded-lg cursor-pointer transition-colors text-xs ${
                  isCurrent
                    ? 'bg-[#1c2852] text-[#f7f5f0]'
                    : 'hover:bg-[#141d3d] text-[#a3aed0]'
                }`}
              >
                {/* Column 1: Index / Play Icon */}
                <div className="col-span-1 text-center flex items-center justify-center">
                  {isCurrentPlaying ? (
                    <div className="flex items-end gap-0.5 h-3.5">
                      <span className="w-1 bg-[#f47b64] rounded-full animate-bounce" style={{ height: '100%', animationDelay: '0ms' }} />
                      <span className="w-1 bg-[#f47b64] rounded-full animate-bounce" style={{ height: '60%', animationDelay: '150ms' }} />
                      <span className="w-1 bg-[#f47b64] rounded-full animate-bounce" style={{ height: '80%', animationDelay: '300ms' }} />
                    </div>
                  ) : (
                    <>
                      <span className={`group-hover:hidden font-mono tabular-nums ${isCurrent ? 'text-[#f47b64] font-bold' : 'text-[#a3aed0]'}`}>
                        {idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(track, idx);
                        }}
                        className="hidden group-hover:flex items-center justify-center text-[#f7f5f0]"
                      >
                        <Play className="w-3.5 h-3.5 fill-[#f7f5f0] ml-0.5" />
                      </button>
                    </>
                  )}
                </div>

                {/* Column 2: Title & Artist */}
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  {showCover && (
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-md object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className={`truncate font-semibold ${isCurrent ? 'text-[#f47b64]' : 'text-[#f7f5f0]'}`}>
                      {track.title}
                    </p>
                    <p className="truncate text-[#a3aed0] text-[11px] group-hover:text-[#f7f5f0] transition-colors">
                      {track.artist}
                    </p>
                  </div>
                </div>

                {/* Column 3: Album */}
                <div className="col-span-3 text-[#a3aed0] truncate group-hover:text-[#f7f5f0] transition-colors">
                  {track.album}
                </div>

                {/* Column 4: Genre */}
                <div className="col-span-2">
                  <span className="inline-flex items-center text-[11px] text-[#a3aed0] font-medium truncate">
                    {track.genre}
                  </span>
                </div>

                {/* Column 5: Actions (Always-visible Add-to-Album, Heart, Duration, More) */}
                <div className="col-span-2 flex items-center justify-end gap-1.5 relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAlbumPicker(track);
                    }}
                    title={
                      savedAlbumsCount > 0
                        ? `Đã lưu trong ${savedAlbumsCount} album • Nhấn để thêm/gỡ`
                        : 'Thêm vào album trong thư viện'
                    }
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border transition-colors shrink-0 ${
                      savedAlbumsCount > 0
                        ? 'bg-[#f47b64]/15 text-[#f47b64] border-[#f47b64]/45 hover:bg-[#f47b64]/25'
                        : 'bg-[#141d3d] text-[#a3aed0] border-[#222f5e] hover:text-[#f7f5f0] hover:border-[#f47b64]/50'
                    }`}
                  >
                    {savedAlbumsCount > 0 ? (
                      <Check className="w-3 h-3 stroke-[2.5]" />
                    ) : (
                      <FolderPlus className="w-3 h-3" />
                    )}
                    <span className="hidden xl:inline">
                      {savedAlbumsCount > 0 ? 'Đã lưu' : 'Thêm'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLike(track.id);
                    }}
                    title={liked ? 'Xóa khỏi yêu thích' : 'Lưu vào yêu thích'}
                    className={`p-1.5 rounded-md transition-colors ${
                      liked
                        ? 'text-[#f47b64]'
                        : 'text-[#a3aed0] hover:text-[#f7f5f0] opacity-70 group-hover:opacity-100'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-[#f47b64]' : ''}`} />
                  </button>

                  <span className="font-mono tabular-nums text-[#a3aed0] text-right w-10">
                    {formatDuration(track.duration)}
                  </span>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuTrackId(isMenuOpen ? null : track.id);
                      }}
                      title="Tùy chọn khác"
                      className="p-1 rounded-md text-[#a3aed0] hover:text-[#f7f5f0] opacity-70 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {isMenuOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 bottom-full mb-1 z-30 w-56 bg-[#141d3d] rounded-xl shadow-2xl border border-[#2b3b75] p-1.5 text-xs text-[#f7f5f0] animate-in fade-in zoom-in-95"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            addToQueue(track);
                            setActiveMenuTrackId(null);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#f7f5f0] hover:bg-[#1c2852] transition-colors text-left"
                        >
                          <ListPlus className="w-3.5 h-3.5 text-[#a3aed0]" />
                          <span>Thêm vào hàng đợi</span>
                        </button>

                        {customPlaylistId && (
                          <button
                            type="button"
                            onClick={() => {
                              removeTrackFromPlaylist(customPlaylistId, track.id);
                              setActiveMenuTrackId(null);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-400 hover:bg-[#1c2852] transition-colors text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Gỡ khỏi album này</span>
                          </button>
                        )}

                        {userPlaylists.length > 0 && (
                          <div className="mt-1 pt-1 border-t border-[#222f5e]">
                            <p className="px-3 py-1 text-[10px] uppercase font-semibold text-[#a3aed0]">
                              Thêm nhanh vào album:
                            </p>
                            <div className="max-h-36 overflow-y-auto">
                              {userPlaylists.map((pl) => (
                                <button
                                  type="button"
                                  key={pl.id}
                                  onClick={() => handleAddToPlaylist(pl.id, track, pl.title)}
                                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-[#1c2852] transition-colors text-left truncate"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <FolderPlus className="w-3 h-3 text-[#a3aed0] shrink-0" />
                                    <span className="truncate">{pl.title}</span>
                                  </div>
                                  {pl.trackIds.includes(track.id) && (
                                    <Check className="w-3 h-3 text-[#f47b64] shrink-0" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
