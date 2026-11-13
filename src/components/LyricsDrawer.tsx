import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Mic2, Maximize2, Minimize2, Sparkles, AlignLeft, Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePlayer } from '../context/PlayerContext';
import { LyricLine } from '../types/music';

function parseSyncedLrcClient(syncedLyrics?: string): LyricLine[] {
  if (!syncedLyrics || typeof syncedLyrics !== 'string') return [];
  const parsed: LyricLine[] = [];
  const lines = syncedLyrics.split(/\r?\n/);
  const tagRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  for (const rawLine of lines) {
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    tagRegex.lastIndex = 0;

    while ((match = tagRegex.exec(rawLine)) !== null) {
      const mins = parseInt(match[1], 10);
      const secs = parseInt(match[2], 10);
      const fracRaw = match[3] || '0';
      const millis = parseInt(fracRaw.padEnd(3, '0').slice(0, 3), 10);
      if (!Number.isNaN(mins) && !Number.isNaN(secs)) {
        timestamps.push(mins * 60 + secs + millis / 1000);
      }
    }

    if (timestamps.length > 0) {
      const text = rawLine.replace(tagRegex, '').trim();
      if (text) {
        for (const time of timestamps) {
          parsed.push({ time, text });
        }
      }
    }
  }

  parsed.sort((a, b) => a.time - b.time);
  return parsed;
}

function formatTimestampBadge(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const LyricsDrawer: React.FC = () => {
  const { currentTrack, currentTime, seek, isLyricsOpen, setIsLyricsOpen } = usePlayer();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'synced' | 'plain'>('synced');
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const syncedLines = useMemo<LyricLine[]>(() => {
    if (!currentTrack) return [];
    const fromLrc = parseSyncedLrcClient(currentTrack.syncedLyrics);
    if (fromLrc.length > 0) return fromLrc;
    if (currentTrack.lyricsMode === 'plain') return [];
    return Array.isArray(currentTrack.lyrics) ? currentTrack.lyrics : [];
  }, [currentTrack]);

  const plainLines = useMemo<string[]>(() => {
    if (!currentTrack?.plainLyrics) return [];
    return currentTrack.plainLyrics.split(/\r?\n/).map(l => l.trim());
  }, [currentTrack]);

  const hasSynced = syncedLines.length > 0;
  const hasPlain = plainLines.some(l => l.length > 0);
  const effectiveMode: 'synced' | 'plain' =
    hasSynced && (viewMode === 'synced' || !hasPlain) ? 'synced' : 'plain';

  // Reset view mode when track changes
  useEffect(() => {
    setViewMode(hasSynced ? 'synced' : 'plain');
  }, [currentTrack?.id, hasSynced]);

  // Find active lyric index based on currentTime
  let activeIndex = -1;
  if (effectiveMode === 'synced') {
    for (let i = syncedLines.length - 1; i >= 0; i--) {
      if (currentTime >= syncedLines[i].time) {
        activeIndex = i;
        break;
      }
    }
  }

  // Smooth auto-scroll to keep active line centered
  useEffect(() => {
    if (effectiveMode === 'synced' && activeLineRef.current && scrollContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, effectiveMode]);

  return (
    <AnimatePresence>
      {isLyricsOpen && (
        <motion.div
          key="lyrics-drawer"
          initial={{ x: '100%', opacity: 0.4 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.4 }}
          transition={{ type: 'spring', stiffness: 360, damping: 34 }}
          className={`fixed z-50 ${
            isFullscreen
              ? 'inset-0 bg-[#0d142c]'
              : 'inset-0 md:inset-auto md:right-0 md:top-0 md:bottom-[88px] md:w-[460px] bg-[#0d142c]/98 md:border-l md:border-[#222f5e] shadow-2xl'
          } backdrop-blur-xl flex flex-col text-[#f7f5f0]`}
        >
      {/* Drawer Header with Saved Cover Art */}
      <div className="p-4 px-5 border-b border-[#1e2a54] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {currentTrack?.coverUrl ? (
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-lg object-cover shadow-md ring-1 ring-[#2b3b75] shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-lg bg-[#f47b64] text-[#070b1a] flex items-center justify-center shrink-0">
              <Mic2 className="w-5 h-5 fill-[#070b1a]" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#f7f5f0] truncate">
                {currentTrack?.title || 'Lời bài hát'}
              </h3>
              {hasSynced && effectiveMode === 'synced' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f47b64]/15 text-[#f47b64] font-bold shrink-0">
                  Sync
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#a3aed0] truncate">
              {currentTrack?.artist || 'Chưa chọn bài hát'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {hasSynced && hasPlain && (
            <div className="flex items-center bg-[#070b1a] border border-[#1e2a54] rounded-lg p-0.5 mr-1">
              <button
                type="button"
                onClick={() => setViewMode('synced')}
                title="Lời đồng bộ theo giây"
                className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-colors ${
                  effectiveMode === 'synced'
                    ? 'bg-[#f47b64] text-[#070b1a]'
                    : 'text-[#a3aed0] hover:text-[#f7f5f0]'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>Sync</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('plain')}
                title="Lời văn bản thuần"
                className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-colors ${
                  effectiveMode === 'plain'
                    ? 'bg-[#f47b64] text-[#070b1a]'
                    : 'text-[#a3aed0] hover:text-[#f7f5f0]'
                }`}
              >
                <AlignLeft className="w-3 h-3" />
                <span>Văn bản</span>
              </button>
            </div>
          )}

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            className="p-2 rounded-full text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-[#162047] transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsLyricsOpen(false)}
            title="Đóng lời bài hát"
            className="p-2 rounded-full text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-[#162047] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lyrics Content Body */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-6 py-10 space-y-5 text-center select-none bg-gradient-to-b from-[#141d3d] via-[#0d142c] to-[#070b1a]"
      >
        {effectiveMode === 'synced' && hasSynced ? (
          syncedLines.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPast = idx < activeIndex;

            return (
              <div
                key={`${line.time}-${idx}`}
                ref={isActive ? activeLineRef : null}
                onClick={() => seek(line.time)}
                title={`Tua đến ${formatTimestampBadge(line.time)}`}
                className={`group cursor-pointer transition-all duration-300 py-2 px-4 rounded-xl flex flex-col items-center gap-1 ${
                  isActive
                    ? 'text-[#f47b64] font-black text-xl sm:text-2xl scale-[1.03] drop-shadow-md bg-[#f47b64]/5'
                    : isPast
                      ? 'text-[#f7f5f0]/80 font-bold text-base sm:text-lg hover:text-[#f7f5f0]'
                      : 'text-[#f7f5f0]/35 font-medium text-base sm:text-lg hover:text-[#f7f5f0]/75'
                }`}
              >
                <span>{line.text}</span>
                <span
                  className={`text-[10px] font-mono transition-opacity ${
                    isActive
                      ? 'text-[#f47b64]/80 opacity-100'
                      : 'text-[#8d99be] opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {formatTimestampBadge(line.time)}
                </span>
              </div>
            );
          })
        ) : hasPlain ? (
          <div className="max-w-md mx-auto py-4 space-y-3 text-left sm:text-center">
            {plainLines.map((line, idx) =>
              line ? (
                <p
                  key={idx}
                  className="text-[#f7f5f0]/90 font-medium text-base sm:text-lg leading-relaxed"
                >
                  {line}
                </p>
              ) : (
                <div key={idx} className="h-3" />
              )
            )}
          </div>
        ) : (
          <div className="py-24 text-center text-[#a3aed0]">
            <Sparkles className="w-8 h-8 mx-auto mb-3 text-[#f47b64]/45" />
            <p className="text-base font-bold text-[#f7f5f0]">Giai điệu không lời</p>
            <p className="text-xs text-[#8d99be] mt-1 max-w-xs mx-auto">
              Bản nhạc này hiện chưa có lời đồng bộ hoặc văn bản lời bài hát.
            </p>
          </div>
        )}
      </div>

      {/* Drawer Footer Tip */}
      <div className="p-3 bg-[#070b1a] border-t border-[#1e2a54] text-center text-[11px] text-[#6e7ba8]">
        {effectiveMode === 'synced' && hasSynced
          ? 'Chạm vào bất kỳ dòng lời nào để tua nhạc tới đúng giây đó'
          : hasPlain
            ? 'Đang hiển thị lời bài hát dạng văn bản thuần'
            : 'Âm nhạc nguyên bản'}
      </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
