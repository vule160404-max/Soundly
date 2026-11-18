import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  Share2,
  MoreHorizontal,
  Sparkles
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePlayer } from '../context/PlayerContext';
import { LyricLine } from '../types/music';
import { findActiveLyricIndex, getTrackSyncedLines } from '../utils/lyricsSync';
import { useTrackLyrics } from '../hooks/useTrackLyrics';

export const LyricsDrawer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    seek,
    isLyricsOpen,
    setIsLyricsOpen
  } = usePlayer();

  const [viewMode, setViewMode] = useState<'synced' | 'plain'>('synced');
  const trackForLyrics = useTrackLyrics(currentTrack, isLyricsOpen);
  const syncedLines = useMemo<LyricLine[]>(
    () => getTrackSyncedLines(trackForLyrics, duration),
    [trackForLyrics, duration]
  );

  const plainLines = useMemo<string[]>(() => {
    if (!trackForLyrics?.plainLyrics) return [];
    return trackForLyrics.plainLyrics.split(/\r?\n/).map((l) => l.trim());
  }, [trackForLyrics]);

  const hasSynced = syncedLines.length > 0;
  const hasPlain = plainLines.some((l) => l.length > 0);
  const effectiveMode: 'synced' | 'plain' =
    hasSynced && (viewMode === 'synced' || !hasPlain) ? 'synced' : 'plain';

  useEffect(() => {
    setViewMode(hasSynced ? 'synced' : 'plain');
  }, [currentTrack?.id, hasSynced]);

  const activeIndex = useMemo(
    () => (effectiveMode === 'synced' ? findActiveLyricIndex(syncedLines, currentTime) : -1),
    [effectiveMode, syncedLines, currentTime]
  );

  // Smooth auto-scroll to keep the active lyric line centered
  useEffect(() => {
    if (effectiveMode === 'synced' && activeLineRef.current && scrollContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, effectiveMode, isLyricsOpen]);

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const effectiveDuration = duration || currentTrack?.duration || 0;
  const remainingTime = Math.max(0, effectiveDuration - currentTime);
  const progressPercent =
    effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0;

  return (
    <AnimatePresence>
      {isLyricsOpen && (
        <motion.div
          key="lyrics-drawer"
          initial={{ y: '100%', opacity: 0.6 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0.6 }}
          transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          className="fixed inset-0 z-[60] bg-[#b85a52] text-white flex flex-col select-none soundly-overlay-top-safe soundly-bottom-safe"
        >
          {/* Top Header Bar (Matches Screenshot 2) */}
          <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3 max-w-2xl w-full mx-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsLyricsOpen(false)}
              title="Thu nhỏ lời bài hát"
              aria-label="Thu nhỏ lời bài hát"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-white hover:bg-white/10 active:scale-90 transition-all shrink-0"
            >
              <ChevronDown className="w-7 h-7 stroke-[2.2]" />
            </button>

            <div className="text-center min-w-0 flex-1 px-2">
              <h3 className="text-sm font-extrabold text-white truncate leading-tight">
                {currentTrack?.title || 'Lời bài hát'}
              </h3>
              <p className="text-xs font-medium text-white/85 truncate mt-0.5">
                {currentTrack?.artist || 'Chưa chọn bài hát'}
              </p>
            </div>

            <div className="min-w-[44px] flex items-center justify-end shrink-0">
              {hasSynced && hasPlain && (
                <button
                  type="button"
                  onClick={() => setViewMode(effectiveMode === 'synced' ? 'plain' : 'synced')}
                  className="px-2.5 py-1 rounded-full bg-black/20 text-[11px] font-bold text-white/90 hover:bg-black/30 transition-colors"
                >
                  {effectiveMode === 'synced' ? 'Sync' : 'Text'}
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Lyrics Content Body with Top & Bottom Fade Masks */}
          <div className="relative flex-1 min-h-0 max-w-2xl w-full mx-auto flex flex-col">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-[#b85a52] to-transparent z-10" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#b85a52] via-[#b85a52]/80 to-transparent z-10" />

            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto px-6 py-8 space-y-5 text-left"
            >
              {effectiveMode === 'synced' && hasSynced ? (
                syncedLines.map((line, idx) => {
                  const isActive = idx === activeIndex;
                  const isSungOrActive = activeIndex === -1 ? idx === 0 : idx <= activeIndex;

                  return (
                    <div
                      key={`${line.time}-${idx}`}
                      ref={isActive ? activeLineRef : null}
                      onClick={() => seek(line.time)}
                      className={`cursor-pointer transition-all duration-300 text-left ${
                        isSungOrActive
                          ? 'text-white'
                          : 'text-black/55 hover:text-white/80'
                      }`}
                    >
                      <p className="text-[24px] sm:text-[28px] font-extrabold leading-[1.3] tracking-tight">
                        {line.text}
                      </p>
                    </div>
                  );
                })
              ) : hasPlain ? (
                <div className="space-y-4 text-left py-2">
                  {plainLines.map((line, idx) =>
                    line ? (
                      <p
                        key={idx}
                        className="text-white text-[22px] sm:text-[26px] font-extrabold leading-[1.35] tracking-tight"
                      >
                        {line}
                      </p>
                    ) : (
                      <div key={idx} className="h-3" />
                    )
                  )}
                </div>
              ) : (
                <div className="py-24 text-center text-white/90">
                  <Sparkles className="w-8 h-8 mx-auto mb-3 text-white/70" />
                  <p className="text-xl font-extrabold">Giai điệu không lời</p>
                  <p className="text-xs text-white/75 mt-1 max-w-xs mx-auto">
                    Bản nhạc này hiện chưa có lời đồng bộ hoặc văn bản lời bài hát.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sticky Bottom Player Controls (Matches Screenshot 2) */}
          <div className="px-6 pt-2 pb-5 max-w-2xl w-full mx-auto shrink-0 bg-[#b85a52]">
            {/* Share & More Row */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (currentTrack && navigator.share) {
                    navigator
                      .share({
                        title: currentTrack.title,
                        text: `Lời bài hát "${currentTrack.title}" - ${currentTrack.artist} trên Soundly`,
                        url: window.location.href,
                      })
                      .catch(() => {});
                  }
                }}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-white/90 hover:text-white active:scale-95 transition-transform"
                title="Chia sẻ lời bài hát"
              >
                <Share2 className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (hasSynced && hasPlain) {
                    setViewMode(effectiveMode === 'synced' ? 'plain' : 'synced');
                  } else {
                    setIsLyricsOpen(false);
                  }
                }}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-white/90 hover:text-white active:scale-95 transition-transform"
                title="Tùy chọn lời bài hát"
              >
                <MoreHorizontal className="w-6 h-6" />
              </button>
            </div>

            {/* Progress Scrubber + Remaining Time */}
            <div className="mt-2">
              <div className="relative flex items-center">
                <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden pointer-events-none">
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
              </div>
              <div className="flex items-center justify-between text-[11px] font-medium tabular-nums text-white/80 mt-1.5">
                <span>{formatTime(currentTime)}</span>
                <span>-{formatTime(remainingTime)}</span>
              </div>
            </div>

            {/* Centered Large White Play/Pause Circle */}
            <div className="mt-2 flex items-center justify-center">
              <button
                type="button"
                onClick={togglePlay}
                className="w-16 h-16 rounded-full bg-white text-[#b85a52] flex items-center justify-center shadow-xl active:scale-95 transition-transform"
                title={isPlaying ? 'Tạm dừng' : 'Phát'}
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 fill-[#b85a52] text-[#b85a52]" />
                ) : (
                  <Play className="w-7 h-7 fill-[#b85a52] text-[#b85a52] ml-1" />
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
