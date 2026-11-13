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

  if (!isVisualizerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#050814]/85 backdrop-blur-md flex items-center justify-center p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#0d142c] rounded-2xl shadow-2xl border border-[#222f5e] p-6 md:p-8 animate-in fade-in zoom-in-95 flex flex-col items-center text-center text-[#f7f5f0]"
      >
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-4 border-b border-[#1e2a54] mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#f47b64]/15 text-[#f47b64] flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div className="text-left">
              <h3 className="text-base font-bold text-[#f7f5f0]">Sóng âm thanh thời gian thực</h3>
              <p className="text-xs text-[#a3aed0]">Soundly Audio Visualizer</p>
            </div>
          </div>

          <button
            onClick={() => setIsVisualizerOpen(false)}
            className="p-1.5 rounded-full text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-[#162047] transition-colors"
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
