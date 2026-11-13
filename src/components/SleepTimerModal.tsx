import React from 'react';
import { X, Moon, Clock } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({ isOpen, onClose }) => {
  const { sleepTimerRemaining, setSleepTimer } = usePlayer();

  if (!isOpen) return null;

  const timerOptions = [
    { label: '15 phút', minutes: 15 },
    { label: '30 phút', minutes: 30 },
    { label: '45 phút', minutes: 45 },
    { label: '1 giờ', minutes: 60 },
    { label: '1 giờ 30 phút', minutes: 90 },
  ];

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} phút ${secs.toString().padStart(2, '0')} giây`;
  };

  const handleSelect = (mins: number) => {
    setSleepTimer(mins);
    onClose();
  };

  const handleCancel = () => {
    setSleepTimer(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050814]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-[#0d142c] rounded-2xl shadow-2xl border border-[#222f5e] p-6 text-[#f7f5f0] animate-in fade-in zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1e2a54]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#f47b64]/15 text-[#f47b64] flex items-center justify-center">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#f7f5f0]">Hẹn giờ tắt nhạc</h3>
              <p className="text-xs text-[#a3aed0]">Dừng phát nhạc tự động</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-[#162047] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Timer Status */}
        {sleepTimerRemaining && (
          <div className="mt-4 p-3.5 rounded-xl bg-[#141d3d] border border-[#f47b64]/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-xs text-[#f7f5f0]">
              <Clock className="w-4 h-4 text-[#f47b64] animate-spin" style={{ animationDuration: '6s' }} />
              <div>
                <p className="font-bold text-[#f47b64]">Đang đếm ngược</p>
                <p className="font-mono tabular-nums text-[11px] text-[#a3aed0]">
                  Còn lại: {formatTimer(sleepTimerRemaining)}
                </p>
              </div>
            </div>

            <button
              onClick={handleCancel}
              className="text-xs font-bold text-rose-400 hover:underline px-2 py-1"
            >
              Hủy
            </button>
          </div>
        )}

        {/* Preset Options */}
        <div className="mt-4 space-y-2">
          {timerOptions.map(opt => (
            <button
              key={opt.minutes}
              onClick={() => handleSelect(opt.minutes)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#141d3d] hover:bg-[#1c2852] text-left text-xs font-bold text-[#f7f5f0] transition-all border border-[#222f5e] hover:border-[#f47b64]"
            >
              <span>{opt.label}</span>
              <span className="text-[11px] text-[#a3aed0] font-mono">+{opt.minutes}m</span>
            </button>
          ))}
        </div>

        {/* Close */}
        <div className="mt-6 pt-3 border-t border-[#1e2a54]">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-full bg-[#141d3d] hover:bg-[#1c2852] text-xs font-bold text-[#f7f5f0] transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
