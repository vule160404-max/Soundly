import React, { useMemo } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  ListMusic,
  Share2,
  Check,
  Plus,
  X,
  MoreHorizontal,
  Timer,
  Speaker,
  AlertCircle
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePlayer } from '../context/PlayerContext';
import { findActiveLyricIndex, getTrackSyncedLines } from '../utils/lyricsSync';
import { useTrackLyrics } from '../hooks/useTrackLyrics';

interface MobileNowPlayingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectArtistByName?: (artistName: string) => void;
}

export const MobileNowPlayingModal: React.FC<MobileNowPlayingModalProps> = ({
  isOpen,
  onClose,
  onSelectArtistByName
}) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    isShuffle,
    sleepTimerRemaining,
    togglePlay,
    seek,
    toggleShuffle,
    playNext,
    playPrevious,
    toggleLike,
    isLiked,
    setIsLyricsOpen,
    setIsQueueOpen,
    setIsVisualizerOpen,
    openAlbumPicker,
    audioError
  } = usePlayer();

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const liked = currentTrack ? isLiked(currentTrack.id) : false;

  const trackWithLyrics = useTrackLyrics(currentTrack, isOpen);

  const syncedLines = useMemo(
    () => getTrackSyncedLines(trackWithLyrics, duration),
    [trackWithLyrics, duration]
  );

  const activeLyricIdx = useMemo(
    () => findActiveLyricIndex(syncedLines, currentTime),
    [syncedLines, currentTime]
  );

  // Build 5-line window matching Spotify's "Bản xem trước lời bài hát" card:
  // Keeps active line at row 3-4 so sung & active lines are bright white and the 5th upcoming line is dark muted
  const previewWindow = useMemo(() => {
    if (syncedLines.length === 0) return [];
    const windowSize = 5;
    if (syncedLines.length <= windowSize) {
      return syncedLines.map((line, idx) => ({ line, idx }));
    }
    const effectiveActive = activeLyricIdx === -1 ? 0 : activeLyricIdx;
    const maxStart = Math.max(0, syncedLines.length - windowSize);
    const startIdx = Math.min(maxStart, Math.max(0, effectiveActive - 3));
    return syncedLines
      .slice(startIdx, startIdx + windowSize)
      .map((line, offset) => ({ line, idx: startIdx + offset }));
  }, [syncedLines, activeLyricIdx]);

  const effectiveDuration = duration || currentTrack?.duration || 0;
  const remainingTime = Math.max(0, effectiveDuration - currentTime);
  const progressPercent =
    effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0;

  return (
    <AnimatePresence>
      {isOpen && currentTrack && (
        <motion.div
          key="mobile-now-playing"
          initial={{ y: '100%', opacity: 0.6 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0.6 }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex justify-center select-none"
        >
          {/* Scrollable Spotify-style Mobile / Full Now Playing Viewport */}
          <div className="w-full max-w-[480px] lg:max-w-[1200px] h-full bg-[#0a0a0a] text-white overflow-y-auto overflow-x-hidden relative shadow-2xl soundly-overlay-top-safe soundly-bottom-safe lg:grid lg:grid-cols-[minmax(420px,5fr)_6fr] lg:gap-10 lg:px-10 lg:py-8 lg:items-start">
            {/* ===================================================== */}
            {/* HERO ARTWORK + PLAYER CONTROLS SECTION                */}
            {/* ===================================================== */}
            <div className="relative flex flex-col justify-between min-h-[86dvh] pb-2 lg:min-h-[calc(100dvh-4rem)] lg:sticky lg:top-0 lg:rounded-3xl lg:overflow-hidden lg:bg-[#111] lg:border lg:border-white/5 lg:shadow-2xl">
              {/* Full-bleed Hero Artwork Backdrop with Smooth Scrim */}
              <div className="absolute inset-x-0 top-0 h-[66%] lg:h-[60%] pointer-events-none overflow-hidden">
                <motion.img
                  key={currentTrack.id}
                  initial={{ scale: 1.04, opacity: 0.7 }}
                  animate={{ scale: isPlaying ? 1.02 : 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center"
                />
                {/* Top & bottom gradient scrims so header and controls pop cleanly */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/15 to-[#0a0a0a]" />
                <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/90 to-transparent" />
              </div>

              {/* Top Header Bar */}
              <div className="relative z-10 px-4 pt-3 pb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-white hover:bg-white/10 active:scale-90 transition-all"
                  title="Thu nhỏ"
                  aria-label="Thu nhỏ trình phát nhạc"
                >
                  <ChevronDown className="w-7 h-7 stroke-[2.2]" />
                </button>

                <div className="text-center truncate px-2 min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-bold text-white truncate drop-shadow">
                    {currentTrack.album || `${currentTrack.title} Radio`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openAlbumPicker(currentTrack)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-white hover:bg-white/10 active:scale-90 transition-all"
                  title="Tùy chọn bài hát"
                  aria-label="Tùy chọn bài hát"
                >
                  <MoreHorizontal className="w-6 h-6" />
                </button>
              </div>

              {/* Spacer pushing track info & controls to lower half */}
              <div className="flex-1 min-h-[240px] lg:min-h-[120px]" />

              {/* Track Info + Controls Block */}
              <div className="relative z-10 px-5 lg:px-8 pt-4 lg:pb-6">
                {/* Small Square Cover + Track Title/Artist + Dismiss & Green Check Like Button */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <img
                      src={currentTrack.coverUrl}
                      alt={currentTrack.title}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-lg object-cover shadow-lg border border-white/15 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h2 className="text-2xl font-extrabold text-white truncate leading-tight tracking-tight">
                        {currentTrack.title}
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectArtistByName) {
                            onClose();
                            onSelectArtistByName(currentTrack.artist);
                          }
                        }}
                        className="text-sm font-medium text-white/70 hover:text-white truncate mt-0.5 block text-left max-w-full"
                      >
                        {currentTrack.artist}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={playNext}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center text-white/80 hover:text-white active:scale-90 transition-transform"
                      title="Bỏ qua bài hát này"
                      aria-label="Bỏ qua bài hát này"
                    >
                      <X className="w-6 h-6 stroke-[2]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleLike(currentTrack.id)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-125 transition-all shrink-0 ${
                        liked
                          ? 'bg-[#1ed760] text-black shadow-md shadow-[#1ed760]/25'
                          : 'border-2 border-white/75 text-white hover:border-white'
                      }`}
                      title={liked ? 'Đã lưu vào Yêu thích' : 'Lưu vào Yêu thích'}
                      aria-label={liked ? 'Đã lưu vào Yêu thích' : 'Lưu vào Yêu thích'}
                    >
                      {liked ? (
                        <Check className="w-4 h-4 stroke-[3.2]" />
                      ) : (
                        <Plus className="w-4 h-4 stroke-[2.8]" />
                      )}
                    </button>
                  </div>
                </div>

                {audioError && (
                  <div className="mt-3 px-3 py-2 rounded-xl bg-amber-950/70 border border-amber-500/40 text-[11px] text-amber-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="leading-snug">{audioError}</span>
                  </div>
                )}

                {/* Progress Bar with Current Time & Negative Remaining Time (-2:59) */}
                <div className="mt-5">
                  <div className="relative flex items-center group">
                    <div className="w-full h-1 bg-white/25 rounded-full overflow-hidden pointer-events-none">
                      <div
                        className="h-full bg-white rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={effectiveDuration || 100}
                      step={0.2}
                      value={currentTime}
                      onChange={(e) => seek(parseFloat(e.target.value))}
                      className="absolute inset-0 w-full h-4 opacity-0 cursor-pointer"
                      aria-label="Tua bài hát"
                    />
                    <div
                      className="w-3 h-3 rounded-full bg-white shadow pointer-events-none absolute -translate-x-1/2"
                      style={{ left: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-medium tabular-nums text-white/65 mt-1.5">
                    <span>{formatTime(currentTime)}</span>
                    <span>-{formatTime(remainingTime)}</span>
                  </div>
                </div>

                {/* Primary Playback Controls Row */}
                <div className="mt-2 flex items-center justify-between">
                  {/* Shuffle Toggle (Spotify Green with dot when active) */}
                  <button
                    type="button"
                    onClick={toggleShuffle}
                    className={`min-h-[44px] min-w-[44px] flex items-center justify-center relative transition-colors ${
                      isShuffle ? 'text-[#1ed760]' : 'text-white/80 hover:text-white'
                    }`}
                    title={isShuffle ? 'Đang phát trộn bài thông minh' : 'Bật phát ngẫu nhiên'}
                  >
                    <Shuffle className="w-6 h-6" />
                    {isShuffle && (
                      <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-[#1ed760]" />
                    )}
                  </button>

                  {/* Previous Track */}
                  <button
                    type="button"
                    onClick={playPrevious}
                    className="min-h-[48px] min-w-[48px] flex items-center justify-center text-white active:scale-90 transition-transform"
                    title="Bài trước"
                  >
                    <SkipBack className="w-8 h-8 fill-white" />
                  </button>

                  {/* Large White Circular Play / Pause */}
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-xl active:scale-95 transition-transform"
                    title={isPlaying ? 'Tạm dừng' : 'Phát'}
                  >
                    {isPlaying ? (
                      <Pause className="w-8 h-8 fill-black text-black" />
                    ) : (
                      <Play className="w-8 h-8 fill-black text-black ml-1" />
                    )}
                  </button>

                  {/* Next Track */}
                  <button
                    type="button"
                    onClick={playNext}
                    className="min-h-[48px] min-w-[48px] flex items-center justify-center text-white active:scale-90 transition-transform"
                    title="Bài tiếp theo"
                  >
                    <SkipForward className="w-8 h-8 fill-white" />
                  </button>
                </div>

                {/* Secondary Utility Icons Row (Speaker/Visualizer left, Share & Queue right) */}
                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      setIsVisualizerOpen(true);
                    }}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center text-white/80 hover:text-white active:scale-95 transition-transform"
                    title="Thiết bị & Sóng nhạc"
                  >
                    <Speaker className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (navigator.share) {
                          navigator
                            .share({
                              title: currentTrack.title,
                              text: `Nghe "${currentTrack.title}" - ${currentTrack.artist} trên Soundly`,
                              url: window.location.href,
                            })
                            .catch(() => {});
                        }
                      }}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center text-white/80 hover:text-white active:scale-95 transition-transform"
                      title="Chia sẻ bài hát"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        setIsQueueOpen(true);
                      }}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center text-white/80 hover:text-white active:scale-95 transition-transform"
                      title="Danh sách chờ"
                    >
                      <ListMusic className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ===================================================== */}
            {/* SCROLLABLE CARDS BELOW PLAYER CONTROLS                */}
            {/* ===================================================== */}
            <div className="px-4 lg:px-0 pb-12 lg:pb-8 space-y-4 lg:space-y-6 min-w-0">
              {/* 1. "Bản xem trước lời bài hát" Card (Matches Screenshot 1 & 3) */}
              <div className="rounded-2xl lg:rounded-3xl bg-[#b85a52] p-5 lg:p-8 shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-3.5">
                  <h3 className="text-sm font-bold text-white/95 tracking-tight">
                    Bản xem trước lời bài hát
                  </h3>
                </div>

                {previewWindow.length > 0 ? (
                  <div className="space-y-2.5 text-left relative">
                    {previewWindow.map(({ line, idx }, posInWindow) => {
                      const isSungOrActive =
                        activeLyricIdx === -1 ? posInWindow === 0 : idx <= activeLyricIdx;
                      const isLastInWindow =
                        posInWindow === previewWindow.length - 1 && previewWindow.length >= 5;

                      return (
                        <p
                          key={`${line.time}-${idx}`}
                          onClick={() => seek(line.time)}
                          className={`text-[21px] sm:text-2xl lg:text-[32px] font-extrabold leading-[1.32] tracking-tight cursor-pointer transition-all duration-300 ${
                            isSungOrActive
                              ? 'text-white'
                              : 'text-black/45 hover:text-white/75'
                          } ${isLastInWindow ? 'opacity-60 mask-b-fade' : ''}`}
                        >
                          {line.text}
                        </p>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-6 text-left">
                    <p className="text-xl font-extrabold text-white/90 leading-snug">
                      Giai điệu không lời hoặc đang cập nhật lời bài hát...
                    </p>
                  </div>
                )}

                <div className="mt-5 flex items-center">
                  <button
                    type="button"
                    onClick={() => setIsLyricsOpen(true)}
                    className="px-4 py-2 rounded-full bg-white text-black text-xs font-extrabold tracking-tight shadow-md hover:scale-105 active:scale-95 transition-transform"
                  >
                    Hiện lời bài hát
                  </button>
                </div>
              </div>

              {/* 2. "Giới thiệu về nghệ sĩ" Card (Matches Screenshot 1 bottom) */}
              <div
                onClick={() => {
                  if (onSelectArtistByName) {
                    onClose();
                    onSelectArtistByName(currentTrack.artist);
                  }
                }}
                className="rounded-2xl overflow-hidden bg-[#181818] border border-white/5 shadow-2xl cursor-pointer group"
              >
                <div className="relative h-56 lg:h-80 w-full overflow-hidden">
                  <img
                    src={currentTrack.coverUrl}
                    alt={currentTrack.artist}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-[#181818]" />
                  <h3 className="absolute top-4 left-4 text-sm font-bold text-white drop-shadow">
                    Giới thiệu về nghệ sĩ
                  </h3>
                </div>

                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-lg font-extrabold text-white truncate">
                      {currentTrack.artist}
                    </h4>
                    <p className="text-xs text-white/60 mt-0.5">
                      {currentTrack.genre} • {(currentTrack.plays || 0).toLocaleString('vi-VN')} lượt nghe
                    </p>
                  </div>

                  <span className="px-4 py-1.5 rounded-full border border-white/30 text-xs font-bold text-white shrink-0 group-hover:border-white transition-colors">
                    Khám phá
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
