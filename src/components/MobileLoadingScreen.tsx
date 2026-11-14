import React from 'react';

interface MobileLoadingScreenProps {
  variant?: 'splash' | 'catalog';
  message?: string;
}

export const MobileLoadingScreen: React.FC<MobileLoadingScreenProps> = ({
  variant = 'catalog',
  message = 'Đang tải kho nhạc Soundly...',
}) => {
  if (variant === 'splash') {
    return (
      <div className="fixed inset-0 z-50 bg-[#070b1a] flex flex-col items-center justify-center px-6 text-[#f7f5f0] select-none soundly-modal-safe">
        <div className="relative mb-5">
          <div className="absolute -inset-4 rounded-3xl bg-[#f47b64]/15 blur-2xl pointer-events-none" />
          <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-[#f7f5f0] shadow-2xl shadow-[#f47b64]/20 ring-2 ring-[#f47b64]/45">
            <img
              src="/assets/aistudio/Logo_Soundly__2__5c576ab3.svg"
              alt="Soundly"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <h1 className="text-xl font-black tracking-tight text-[#f7f5f0]">
          Soundly
        </h1>
        <p className="text-xs font-semibold text-[#a3aed0] mt-1.5 tracking-wide">
          {message}
        </p>

        {/* Animated Coral Equalizer */}
        <div className="mt-6 flex items-end gap-1.5 h-5" aria-hidden="true">
          <span className="w-1 h-full bg-[#f47b64] rounded-full soundly-eq-bar" style={{ animationDelay: '0ms' }} />
          <span className="w-1 h-full bg-[#f47b64] rounded-full soundly-eq-bar" style={{ animationDelay: '140ms' }} />
          <span className="w-1 h-full bg-[#f47b64] rounded-full soundly-eq-bar" style={{ animationDelay: '280ms' }} />
          <span className="w-1 h-full bg-[#f47b64] rounded-full soundly-eq-bar" style={{ animationDelay: '420ms' }} />
          <span className="w-1 h-full bg-[#f47b64] rounded-full soundly-eq-bar" style={{ animationDelay: '180ms' }} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-6 pb-12 text-[#f7f5f0] select-none"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      {/* Mobile-First Loading Banner Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#142152] via-[#0f183b] to-[#0b1129] border border-[#222f5e] p-5 sm:p-6 flex items-center gap-4">
        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#f7f5f0] ring-2 ring-[#f47b64]/40 shrink-0 shadow-lg">
          <img
            src="/assets/aistudio/Logo_Soundly__2__5c576ab3.svg"
            alt="Soundly"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-[#f7f5f0] truncate">
              {message}
            </h2>
            <div className="flex items-end gap-0.5 h-3.5 shrink-0" aria-hidden="true">
              <span className="w-0.5 h-full bg-[#f47b64] rounded-full soundly-eq-bar" style={{ animationDelay: '0ms' }} />
              <span className="w-0.5 h-full bg-[#f47b64] rounded-full soundly-eq-bar" style={{ animationDelay: '160ms' }} />
              <span className="w-0.5 h-full bg-[#f47b64] rounded-full soundly-eq-bar" style={{ animationDelay: '320ms' }} />
            </div>
          </div>
          <p className="text-xs text-[#a3aed0] mt-1">
            Đang đồng bộ danh sách bài hát, nghệ sĩ và bảng xếp hạng dành cho bạn
          </p>
        </div>
      </div>

      {/* Quick Picks Skeleton Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={`sk-pick-${idx}`}
            className="relative overflow-hidden flex items-center gap-3.5 p-2 rounded-lg bg-[#141d3d]/70 border border-[#1e2a54]"
          >
            <div className="w-12 h-12 rounded-md bg-[#1c2852] shrink-0" />
            <div className="flex-1 space-y-2 pr-2">
              <div className="h-3.5 w-3/4 rounded bg-[#1c2852]" />
              <div className="h-2.5 w-1/2 rounded bg-[#1c2852]/70" />
            </div>
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent soundly-shimmer pointer-events-none" />
          </div>
        ))}
      </div>

      {/* Artists Row Skeleton */}
      <div className="space-y-3">
        <div className="h-5 w-44 rounded-md bg-[#141d3d]" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={`sk-art-${idx}`}
              className={`relative overflow-hidden p-3.5 rounded-2xl bg-[#141d3d]/70 border border-[#1e2a54] flex flex-col items-center ${
                idx >= 2 ? 'hidden sm:flex' : 'flex'
              }`}
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#1c2852]" />
              <div className="h-3 w-20 rounded bg-[#1c2852] mt-3" />
              <div className="h-2.5 w-14 rounded bg-[#1c2852]/70 mt-1.5" />
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent soundly-shimmer pointer-events-none" />
            </div>
          ))}
        </div>
      </div>

      {/* Top Tracks List Skeleton */}
      <div className="space-y-2 bg-[#0d142c] rounded-xl p-2 border border-[#1e2a54]/60">
        {[0, 1, 2, 3, 4, 5].map((idx) => (
          <div
            key={`sk-row-${idx}`}
            className="relative overflow-hidden flex items-center justify-between p-2.5 rounded-xl bg-[#141d3d]/45"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-5 h-3.5 rounded bg-[#1c2852] shrink-0" />
              <div className="w-12 h-12 rounded-md bg-[#1c2852] shrink-0" />
              <div className="flex-1 space-y-2 min-w-0">
                <div className="h-3.5 w-2/3 rounded bg-[#1c2852]" />
                <div className="h-2.5 w-2/5 rounded bg-[#1c2852]/70" />
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#1c2852]/70 shrink-0 ml-3" />
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent soundly-shimmer pointer-events-none" />
          </div>
        ))}
      </div>
    </div>
  );
};
