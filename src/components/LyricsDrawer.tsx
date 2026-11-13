import React, { useEffect, useRef } from 'react';
import { X, Mic2, Maximize2, Minimize2, Sparkles } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export const LyricsDrawer: React.FC = () => {
  const { currentTrack, currentTime, seek, isLyricsOpen, setIsLyricsOpen } = usePlayer();
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const lyrics = currentTrack?.lyrics || [];

  // Find active lyric index
  let activeIndex = -1;
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (currentTime >= lyrics[i].time) {
      activeIndex = i;
      break;
    }
  }

  // Smooth auto-scroll to keep active line centered
  useEffect(() => {
    if (activeLineRef.current && scrollContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeIndex]);

  if (!isLyricsOpen) return null;

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ${
        isFullscreen
          ? 'inset-0 bg-[#0d142c]'
          : 'inset-0 md:inset-auto md:right-0 md:top-0 md:bottom-[88px] md:w-[460px] bg-[#0d142c]/98 md:border-l md:border-[#222f5e] shadow-2xl'
      } backdrop-blur-xl flex flex-col text-[#f7f5f0]`}
    >
      {/* Drawer Header */}
      <div className="p-4 px-6 border-b border-[#1e2a54] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#f47b64] text-[#070b1a] flex items-center justify-center">
            <Mic2 className="w-4 h-4 fill-[#070b1a]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#f7f5f0]">Lời bài hát</h3>
            <p className="text-[11px] text-[#a3aed0] truncate max-w-[200px]">
              {currentTrack?.title || 'Chưa chọn bài hát'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
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
        className="flex-1 overflow-y-auto px-6 py-12 space-y-6 text-center select-none bg-gradient-to-b from-[#141d3d] via-[#0d142c] to-[#070b1a]"
      >
        {lyrics.length > 0 ? (
          lyrics.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPast = idx < activeIndex;

            return (
              <div
                key={idx}
                ref={isActive ? activeLineRef : null}
                onClick={() => seek(line.time)}
                className={`cursor-pointer transition-all duration-300 py-2 px-4 rounded-xl ${
                  isActive
                    ? 'text-[#f47b64] font-black text-xl sm:text-2xl scale-105 drop-shadow-md'
                    : isPast
                    ? 'text-[#f7f5f0]/80 font-bold text-base sm:text-lg hover:text-[#f7f5f0]'
                    : 'text-[#f7f5f0]/30 font-medium text-base sm:text-lg hover:text-[#f7f5f0]/65'
                }`}
              >
                {line.text}
              </div>
            );
          })
        ) : (
          <div className="py-24 text-center text-[#a3aed0]">
            <Sparkles className="w-8 h-8 mx-auto mb-3 text-[#f47b64]/45" />
            <p className="text-base font-bold text-[#f7f5f0]">Giai điệu không lời</p>
            <p className="text-xs text-[#8d99be] mt-1 max-w-xs mx-auto">
              Bản nhạc này là giai điệu thuần khiết, giúp bạn tập trung và thư giãn trọn vẹn.
            </p>
          </div>
        )}
      </div>

      {/* Drawer Footer Tip */}
      <div className="p-3 bg-[#070b1a] border-t border-[#1e2a54] text-center text-[11px] text-[#6e7ba8]">
        Chạm vào bất kỳ dòng nào để nhảy ngay đến đoạn đó
      </div>
    </div>
  );
};
