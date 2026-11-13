import React, { useEffect } from 'react';
import { X, Moon, Clock } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({ isOpen, onClose }) => {
  const { sleepTimerRemaining, setSleepTimer } = usePlayer();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sleep-timer-title"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#040714]/78 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4 soundly-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] bg-[#0e1633]/95 backdrop-blur-xl rounded-3xl ring-1 ring-white/10 shadow-[0_24px_64px_-12px_rgba(3,7,22,0.9)] overflow-hidden text-[#f7f5f0] soundly-modal relative"
      >
        <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-28 rounded-full bg-[#f47b64]/15 blur-3xl" />

        <div className="relative p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#f47b64]/12 ring-1 ring-[#f47b64]/25 text-[#f47b64] flex items-center justify-center shrink-0">
                <Moon className="w-5 h-5" />
              </div>
              <div>
                <h3 id="sleep-timer-title" className="text-base font-bold text-[#f7f5f0]">
                  Hẹn giờ tắt nhạc
                </h3>
                <p className="text-xs text-[#a3aed0] mt-0.5">
                  Tự động dừng phát khi hết thời gian
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng hộp thoại"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Current Timer Status */}
          {sleepTimerRemaining && (
            <div className="p-3.5 rounded-2xl bg-[#f47b64]/12 ring-1 ring-[#f47b64]/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs">
                <Clock className="w-4 h-4 text-[#f47b64] animate-spin shrink-0" style={{ animationDuration: '6s' }} />
                <div>
                  <p className="font-semibold text-[#f47b64]">Đang đếm ngược</p>
                  <p className="font-mono tabular-nums text-xs text-[#f7f5f0] mt-0.5">
                    Còn lại {formatTimer(sleepTimerRemaining)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCancel}
                className="min-h-[36px] px-3 rounded-xl text-xs font-semibold text-rose-300 hover:bg-rose-500/15 transition-colors shrink-0"
              >
                Hủy hẹn giờ
              </button>
            </div>
          )}

          {/* Preset Options */}
          <div className="divide-y divide-white/[0.06] rounded-2xl bg-[#152046]/55 overflow-hidden">
            {timerOptions.map((opt) => (
              <button
                key={opt.minutes}
                type="button"
                onClick={() => handleSelect(opt.minutes)}
                className="w-full min-h-[48px] flex items-center justify-between px-4 py-3 hover:bg-white/[0.06] text-left text-sm font-semibold text-[#f7f5f0] transition-colors"
              >
                <span>{opt.label}</span>
                <span className="text-xs text-[#a3aed0] font-mono tabular-nums">
                  +{opt.minutes}m
                </span>
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-white/[0.06] flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.11] text-xs sm:text-sm font-semibold text-[#d6ddf5] transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
