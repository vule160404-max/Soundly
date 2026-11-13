import React, { useEffect, useRef } from 'react';
import { X, Activity, Volume2 } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export const VisualizerModal: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    isVisualizerOpen,
    setIsVisualizerOpen,
    getAudioFrequencyData
  } = usePlayer();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isVisualizerOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const freqData = getAudioFrequencyData();
      const numBars = 48;
      const barWidth = (width / numBars) - 3;

      for (let i = 0; i < numBars; i++) {
        let barHeight = 6;
        if (isPlaying) {
          if (freqData && freqData.length > 0) {
            const dataIdx = Math.floor((i / numBars) * freqData.length);
            barHeight = Math.max(6, (freqData[dataIdx] / 255) * (height - 30));
          } else {
            const time = Date.now() * 0.005;
            barHeight = 15 + Math.sin(time + i * 0.3) * 25 + Math.cos(time * 0.7 + i * 0.2) * 20;
          }
        }

        const x = i * (barWidth + 3) + 1.5;
        const y = height - barHeight;

        // Soundly Coral-to-Ivory Gradient
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#f47b64');
        gradient.addColorStop(0.65, '#ffa694');
        gradient.addColorStop(1, '#f7f5f0');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isVisualizerOpen, isPlaying, getAudioFrequencyData]);

  useEffect(() => {
    if (!isVisualizerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsVisualizerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisualizerOpen, setIsVisualizerOpen]);

  if (!isVisualizerOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => setIsVisualizerOpen(false)}
      className="fixed inset-0 z-50 bg-[#040714]/82 backdrop-blur-md flex items-center justify-center p-4 soundly-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#0e1633]/95 backdrop-blur-xl rounded-3xl shadow-[0_24px_64px_-12px_rgba(3,7,22,0.9)] ring-1 ring-white/10 p-6 md:p-8 soundly-modal flex flex-col items-center text-center text-[#f7f5f0]"
      >
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-4 border-b border-white/[0.06] mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#f47b64]/12 ring-1 ring-[#f47b64]/25 text-[#f47b64] flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className="text-base font-bold text-[#f7f5f0]">Sóng âm thanh thời gian thực</h3>
              <p className="text-xs text-[#a3aed0]">Soundly Audio Visualizer</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsVisualizerOpen(false)}
            aria-label="Đóng hộp thoại"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Track Info */}
        {currentTrack && (
          <div className="flex items-center gap-3.5 mb-6">
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-md object-cover shadow-md"
            />
            <div className="text-left">
              <h4 className="text-sm font-bold text-[#f7f5f0]">{currentTrack.title}</h4>
              <p className="text-xs text-[#a3aed0]">{currentTrack.artist}</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#141d3d] text-[#f47b64] font-semibold mt-1 inline-block border border-[#222f5e]">
                {currentTrack.genre}
              </span>
            </div>
          </div>
        )}

        {/* Canvas Visualizer with Deep Navy Interior */}
        <div className="w-full h-48 bg-[#070b1a] rounded-xl p-4 flex items-center justify-center shadow-inner overflow-hidden relative border border-[#1e2a54]">
          <canvas
            ref={canvasRef}
            width={580}
            height={160}
            className="w-full h-full"
          />

          {!isPlaying && (
            <div className="absolute inset-0 bg-[#070b1a]/75 flex items-center justify-center text-[#a3aed0] text-xs font-semibold gap-2">
              <Volume2 className="w-4 h-4 text-[#f47b64]" />
              <span>Nhấn Phát nhạc để kích hoạt sóng âm thanh</span>
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="mt-6 w-full flex justify-end">
          <button
            onClick={() => setIsVisualizerOpen(false)}
            className="px-6 py-2.5 rounded-full bg-[#141d3d] hover:bg-[#1c2852] text-xs font-bold text-[#f7f5f0] transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
