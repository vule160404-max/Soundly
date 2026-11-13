import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { showInstallHint, canPromptNatively, isIOS, promptInstall } = usePWAInstall();
  const [showSafariGuide, setShowSafariGuide] = useState(false);

  useEffect(() => {
    if (!showSafariGuide) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSafariGuide(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSafariGuide]);

  if (!showInstallHint) return null;

  const handleClick = async () => {
    if (canPromptNatively) {
      await promptInstall();
    } else {
      setShowSafariGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Cài đặt Soundly lên màn hình chính"
        className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#141d3d] hover:bg-[#1a254d] text-[#f7f5f0] border border-[#222f5e] hover:border-[#f47b64]/50 transition-colors shrink-0 whitespace-nowrap"
      >
        <Download className="w-3.5 h-3.5 text-[#f47b64]" />
        <span className="hidden sm:inline">Thêm vào MH chính</span>
      </button>

      {showSafariGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-safari-title"
          className="fixed inset-0 z-50 bg-[#040714]/78 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4 soundly-backdrop"
          onClick={() => setShowSafariGuide(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] bg-[#0e1633]/95 backdrop-blur-xl rounded-3xl ring-1 ring-white/10 shadow-[0_24px_64px_-12px_rgba(3,7,22,0.9)] overflow-hidden text-[#f7f5f0] soundly-modal relative"
          >
            <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-28 rounded-full bg-[#f47b64]/16 blur-3xl" />

            <div className="relative p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <img
                    src="/apple-touch-icon.png"
                    alt="Soundly Logo"
                    className="w-12 h-12 rounded-2xl shadow-md ring-1 ring-white/10 shrink-0"
                  />
                  <div>
                    <h3 id="pwa-safari-title" className="text-base font-bold text-[#f7f5f0]">
                      Gắn Soundly ra Màn hình chính
                    </h3>
                    <p className="text-xs text-[#a3aed0] mt-0.5">
                      Mở nhanh toàn màn hình với biểu tượng Soundly
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSafariGuide(false)}
                  aria-label="Đóng hộp thoại"
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-white/[0.06] transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isIOS ? (
                <ol className="divide-y divide-white/[0.06] rounded-2xl bg-[#152046]/55 overflow-hidden text-xs sm:text-sm text-[#d6ddf5]">
                  <li className="flex items-center gap-3 px-4 py-3">
                    <span className="w-6 h-6 rounded-full bg-[#f47b64] text-[#070b1a] font-bold text-xs flex items-center justify-center shrink-0">
                      1
                    </span>
                    <span className="flex items-center gap-1.5 flex-wrap">
                      Nhấn <Share className="w-4 h-4 text-[#f47b64] inline" />{' '}
                      <strong className="text-[#f7f5f0]">Chia sẻ</strong> trên thanh công cụ Safari.
                    </span>
                  </li>
                  <li className="flex items-center gap-3 px-4 py-3">
                    <span className="w-6 h-6 rounded-full bg-[#f47b64] text-[#070b1a] font-bold text-xs flex items-center justify-center shrink-0">
                      2
                    </span>
                    <span className="flex items-center gap-1.5 flex-wrap">
                      Chọn <PlusSquare className="w-4 h-4 text-[#f47b64] inline" />{' '}
                      <strong className="text-[#f7f5f0]">Thêm vào MH chính</strong>.
                    </span>
                  </li>
                  <li className="flex items-center gap-3 px-4 py-3">
                    <span className="w-6 h-6 rounded-full bg-[#f47b64] text-[#070b1a] font-bold text-xs flex items-center justify-center shrink-0">
                      3
                    </span>
                    <span>
                      Nhấn <strong className="text-[#f7f5f0]">Thêm</strong> ở góc trên bên phải để hoàn tất.
                    </span>
                  </li>
                </ol>
              ) : (
                <div className="p-4 rounded-2xl bg-[#152046]/55 text-xs sm:text-sm text-[#d6ddf5] leading-relaxed">
                  Trên Safari macOS, mở menu <strong className="text-[#f7f5f0]">Tệp (File)</strong> &rarr;{' '}
                  <strong className="text-[#f7f5f0]">Thêm vào Dock (Add to Dock)</strong> để gắn biểu tượng Soundly.
                </div>
              )}

              <div className="pt-3 border-t border-white/[0.06] flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSafariGuide(false)}
                  className="min-h-[44px] w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] font-bold text-xs sm:text-sm transition-colors"
                >
                  Đã hiểu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
