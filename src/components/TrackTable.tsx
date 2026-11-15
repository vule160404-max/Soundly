import React, { useEffect, useRef, useState } from 'react';
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
import { AnimatePresence, motion } from 'motion/react';
import { Track, TrendingChartEntry } from '../types/music';
import { usePlayer } from '../context/PlayerContext';
import { splitArtistNames } from '../utils/artistSync';

interface TrackTableProps {
  tracks: Track[];
  onPlayList?: (tracks: Track[], startIndex: number) => void;
  showCover?: boolean;
  showRankAndPlays?: boolean;
  rankMetaByTrackId?: Record<string, TrendingChartEntry>;
  customPlaylistId?: string;
  onSelectArtist?: (artistName: string) => void;
}

export const TrackTable: React.FC<TrackTableProps> = ({
  tracks,
  onPlayList,
  showCover = true,
  showRankAndPlays = false,
  rankMetaByTrackId,
  customPlaylistId,
  onSelectArtist,
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
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  );
  const [visibleCount, setVisibleCount] = useState<number>(40);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (visibleCount >= tracks.length) return;
    const target = loadMoreRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') {
      setVisibleCount(tracks.length);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((prev) => Math.min(tracks.length, prev + 40));
        }
      },
      { rootMargin: '650px 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [visibleCount, tracks.length]);

  const visibleTracks =
    visibleCount >= tracks.length ? tracks : tracks.slice(0, visibleCount);

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatPlays = (plays?: number) => {
    const count = Math.max(0, Number(plays) || 0);
    return `${count.toLocaleString('vi-VN')} lượt nghe`;
  };

  const getRankColorClass = (idx: number, isCurrent: boolean) => {
    if (isCurrent) return 'text-[#f47b64] font-extrabold';
    if (!showRankAndPlays) return 'text-[#a3aed0]';
    if (idx === 0) return 'text-[#f47b64] font-extrabold';
    if (idx === 1) return 'text-[#f7f5f0] font-extrabold';
    if (idx === 2) return 'text-amber-400 font-extrabold';
    return 'text-[#7f8bb3]';
  };

  const renderRankBadge = (displayRank: number, idx: number, isCurrent: boolean) => {
    if (showRankAndPlays && idx === 0) {
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#f47b64]/20 border border-[#f47b64]/50 text-[#f47b64] font-mono tabular-nums font-extrabold text-[11px]">
          {displayRank}
        </span>
      );
    }
    if (showRankAndPlays && idx === 1) {
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#f7f5f0]/10 border border-[#f7f5f0]/30 text-[#f7f5f0] font-mono tabular-nums font-extrabold text-[11px]">
          {displayRank}
        </span>
      );
    }
    if (showRankAndPlays && idx === 2) {
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-400/15 border border-amber-400/40 text-amber-300 font-mono tabular-nums font-extrabold text-[11px]">
          {displayRank}
        </span>
      );
    }
    return (
      <span className={`font-mono tabular-nums text-xs ${getRankColorClass(idx, isCurrent)}`}>
        {displayRank}
      </span>
    );
  };

  const renderTrendIndicator = (meta?: TrendingChartEntry) => {
    if (!meta) return null;
    if (meta.isNew) {
      return (
        <span
          title="Mới vào bảng xếp hạng Spotify"
          className="text-[10px] font-bold text-[#f47b64] tracking-tight whitespace-nowrap"
        >
          Mới
        </span>
      );
    }
    if (meta.rankDelta > 0) {
      return (
        <span
          title={`Tăng ${meta.rankDelta} bậc so với kỳ trước`}
          className="text-[10px] font-mono tabular-nums font-bold text-emerald-400 whitespace-nowrap"
        >
          ▲{meta.rankDelta}
        </span>
      );
    }
    if (meta.rankDelta < 0) {
      return (
        <span
          title={`Giảm ${Math.abs(meta.rankDelta)} bậc so với kỳ trước`}
          className="text-[10px] font-mono tabular-nums font-bold text-rose-400 whitespace-nowrap"
        >
          ▼{Math.abs(meta.rankDelta)}
        </span>
      );
    }
    return (
      <span
        title="Giữ nguyên thứ hạng"
        className="text-[10px] font-mono tabular-nums text-[#6e7ba8]"
      >
        —
      </span>
    );
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
      <AnimatePresence>
        {addedPlaylistToast && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-16 right-4 md:right-8 z-50 bg-[#f47b64] text-[#070b1a] text-xs font-bold px-4 py-2 rounded-lg shadow-xl flex items-center gap-2"
          >
            <Check className="w-4 h-4 text-[#070b1a] stroke-[3]" />
            <span>{addedPlaylistToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MOBILE LIST VIEW (Soundly Navy touch layout)             */}
      {/* ======================================================== */}
      {!isDesktop && (
      <div className="divide-y divide-[#1e2a54]">
        {visibleTracks.map((track, idx) => {
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
              className={`soundly-track-row flex items-center justify-between p-2.5 rounded-xl active:bg-[#1c2852] transition-colors duration-100 ${
                isCurrent ? 'bg-[#1c2852]/75' : ''
              }`}
            >
              {/* Rank (Top 50) + Cover Art + Info */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                {showRankAndPlays && (() => {
                  const chartMeta = rankMetaByTrackId?.[track.id];
                  return (
                    <div className="w-8 flex flex-col items-center justify-center shrink-0 gap-0.5">
                      {renderRankBadge(idx + 1, idx, isCurrent)}
                      {chartMeta && renderTrendIndicator(chartMeta)}
                    </div>
                  );
                })()}

                <div className="relative shrink-0 w-12 h-12 rounded-md overflow-hidden bg-[#141d3d]">
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  {isCurrentPlaying && (
                    <div className="absolute inset-0 bg-[#070b1a]/45 flex items-center justify-center">
                      <div className="flex items-end gap-0.5 h-3.5">
                        <span className="w-0.5 h-full bg-[#f47b64] rounded-full soundly-eq-bar" style={{ animationDelay: '0ms' }} />
                        <span className="w-0.5 h-full bg-[#f47b64] rounded-full soundly-eq-bar" style={{ animationDelay: '180ms' }} />
                        <span className="w-0.5 h-full bg-[#f47b64] rounded-full soundly-eq-bar" style={{ animationDelay: '340ms' }} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-[#f47b64]' : 'text-[#f7f5f0]'}`}>
                    {track.title}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-[#a3aed0] truncate mt-0.5">
                    {onSelectArtist ? (
                      <span className="truncate">
                        {splitArtistNames(track.artist, track.title).map((artistName, aIdx) => (
                          <React.Fragment key={`${track.id}-m-art-${aIdx}`}>
                            {aIdx > 0 && <span>, </span>}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectArtist(artistName);
                              }}
                              className="hover:text-[#f47b64] hover:underline transition-colors inline text-left"
                            >
                              {artistName}
                            </button>
                          </React.Fragment>
                        ))}
                      </span>
                    ) : (
                      <span className="truncate">{track.artist}</span>
                    )}
                    <span>·</span>
                    <span className="font-mono tabular-nums shrink-0">{formatDuration(track.duration)}</span>
                    {showRankAndPlays && (() => {
                      const chartMeta = rankMetaByTrackId?.[track.id];
                      return (
                        <>
                          <span>·</span>
                          <span className="font-mono tabular-nums shrink-0 text-[#8d99be]">
                            {chartMeta
                              ? `#${chartMeta.spotifyRank} Spotify`
                              : `${(Number(track.plays) || 0).toLocaleString('vi-VN')} lượt`}
                          </span>
                        </>
                      );
                    })()}
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
                  className={`min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center active:scale-90 transition-all duration-150 ${
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
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#a3aed0] active:scale-125 transition-transform duration-150"
                >
                  <Heart className={`w-4 h-4 transition-colors ${liked ? 'fill-[#f47b64] text-[#f47b64]' : 'text-[#6e7ba8]'}`} />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMenuTrackId(isMenuOpen ? null : track.id)}
                  className="min-h-[40px] min-w-[36px] flex items-center justify-center text-[#a3aed0] active:scale-90 active:text-[#f7f5f0] transition-all duration-150"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* Mobile Dropdown Menu */}
                <AnimatePresence>
                  {isMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.96 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute right-0 top-full mt-1 z-30 w-56 bg-[#141d3d] rounded-xl shadow-2xl border border-[#2b3b75] p-2 text-xs text-[#f7f5f0]"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenuTrackId(null);
                          openAlbumPicker(track);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#f47b64] font-bold hover:bg-[#1c2852] text-left min-h-[42px] transition-colors"
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
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#f7f5f0] hover:bg-[#1c2852] text-left min-h-[42px] transition-colors"
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
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-rose-400 hover:bg-[#1c2852] text-left min-h-[42px] transition-colors"
                        >
                          <Trash2 className="w-4 h-4 shrink-0" />
                          <span>Gỡ khỏi album này</span>
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* ======================================================== */}
      {/* DESKTOP TABLE VIEW (Soundly Navy Desktop Rows)           */}
      {/* ======================================================== */}
      {isDesktop && (
      <div>
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-3 px-4 py-2.5 text-[11px] font-semibold text-[#a3aed0] tracking-wider border-b border-[#1e2a54]">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-4">Tiêu đề</div>
          <div className={showRankAndPlays ? 'col-span-2' : 'col-span-3'}>Album</div>
          {showRankAndPlays && (
            <div className="col-span-2 text-right">
              {rankMetaByTrackId ? 'Thứ hạng & Nghe' : 'Lượt nghe'}
            </div>
          )}
          <div className={showRankAndPlays ? 'col-span-1' : 'col-span-2'}>Thể loại</div>
          <div className="col-span-2 text-right">Thao tác</div>
        </div>

        {/* Table Rows */}
        <div className="mt-1">
          {visibleTracks.map((track, idx) => {
            const isCurrent = currentTrack?.id === track.id;
            const isCurrentPlaying = isCurrent && isPlaying;
            const liked = isLiked(track.id);
            const isMenuOpen = activeMenuTrackId === track.id;
            const savedAlbumsCount = userPlaylists.filter((pl) =>
              pl.trackIds.includes(track.id)
            ).length;
            const chartMeta = rankMetaByTrackId?.[track.id];

            return (
              <div
                key={track.id}
                onClick={() => handleRowClick(track, idx)}
                className={`group grid grid-cols-12 gap-3 px-4 py-2 items-center rounded-lg cursor-pointer transition-all duration-150 ease-out active:scale-[0.995] text-xs ${
                  isCurrent
                    ? 'bg-[#1c2852] text-[#f7f5f0]'
                    : 'hover:bg-[#141d3d] text-[#a3aed0]'
                }`}
              >
                {/* Column 1: Index + Trend Indicator / Play Icon */}
                <div className="col-span-1 text-center flex items-center justify-center gap-1.5">
                  {isCurrentPlaying ? (
                    <div className="flex items-end gap-0.5 h-3.5">
                      <span className="w-1 h-full bg-[#f47b64] rounded-full soundly-eq-bar" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-full bg-[#f47b64] rounded-full soundly-eq-bar" style={{ animationDelay: '180ms' }} />
                      <span className="w-1 h-full bg-[#f47b64] rounded-full soundly-eq-bar" style={{ animationDelay: '340ms' }} />
                    </div>
                  ) : (
                    <>
                      <div className="group-hover:hidden flex items-center justify-center gap-1.5">
                        {renderRankBadge(idx + 1, idx, isCurrent)}
                        {chartMeta && renderTrendIndicator(chartMeta)}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(track, idx);
                        }}
                        className="hidden group-hover:flex items-center justify-center text-[#f7f5f0] transition-transform active:scale-90"
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
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-md object-cover shrink-0 transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                  )}
                  <div className="min-w-0">
                    <p className={`truncate font-semibold ${isCurrent ? 'text-[#f47b64]' : 'text-[#f7f5f0]'}`}>
                      {track.title}
                    </p>
                    <p className="truncate text-[#a3aed0] text-[11px] group-hover:text-[#f7f5f0] transition-colors">
                      {onSelectArtist
                        ? splitArtistNames(track.artist, track.title).map((artistName, aIdx) => (
                            <React.Fragment key={`${track.id}-d-art-${aIdx}`}>
                              {aIdx > 0 && <span>, </span>}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectArtist(artistName);
                                }}
                                className="hover:text-[#f47b64] hover:underline transition-colors inline text-left"
                              >
                                {artistName}
                              </button>
                            </React.Fragment>
                          ))
                        : track.artist}
                    </p>
                  </div>
                </div>

                {/* Column 3: Album */}
                <div
                  className={`${
                    showRankAndPlays ? 'col-span-2' : 'col-span-3'
                  } text-[#a3aed0] truncate group-hover:text-[#f7f5f0] transition-colors`}
                >
                  {track.album}
                </div>

                {/* Optional Column: Spotify Rank + Play Count (Top 50) */}
                {showRankAndPlays && (
                  <div className="col-span-2 text-right font-mono tabular-nums text-[11px] text-[#a3aed0] group-hover:text-[#f7f5f0] transition-colors truncate">
                    {chartMeta
                      ? `#${chartMeta.spotifyRank} Spotify · ${(Number(track.plays) || 0).toLocaleString('vi-VN')} lượt`
                      : formatPlays(track.plays)}
                  </div>
                )}

                {/* Column 4: Genre */}
                <div className={showRankAndPlays ? 'col-span-1' : 'col-span-2'}>
                  <span className="inline-flex items-center text-[11px] text-[#a3aed0] font-medium truncate max-w-full">
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
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border active:scale-95 transition-all duration-150 shrink-0 ${
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
                    className={`p-1.5 rounded-md active:scale-125 transition-all duration-150 ${
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
                      className="p-1 rounded-md text-[#a3aed0] hover:text-[#f7f5f0] opacity-70 group-hover:opacity-100 active:scale-90 transition-all duration-150"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    <AnimatePresence>
                      {isMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 4, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.96 }}
                          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 bottom-full mb-1 z-30 w-56 bg-[#141d3d] rounded-xl shadow-2xl border border-[#2b3b75] p-1.5 text-xs text-[#f7f5f0]"
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
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {visibleCount < tracks.length && (
        <div ref={loadMoreRef} className="py-4 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => Math.min(tracks.length, prev + 40))}
            className="px-4 py-2 rounded-full bg-[#141d3d] hover:bg-[#1c2852] border border-[#222f5e] text-xs font-semibold text-[#a3aed0] hover:text-[#f7f5f0] transition-colors"
          >
            Hiển thị thêm ({tracks.length - visibleCount} bài hát)
          </button>
        </div>
      )}
    </div>
  );
};
