import React, { useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { showInstallHint, canPromptNatively, isIOS, promptInstall } = usePWAInstall();
  const [showSafariGuide, setShowSafariGuide] = useState(false);

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
          className="fixed inset-0 z-50 bg-[#050814]/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowSafariGuide(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#0d142c] border border-[#2b3b75] rounded-2xl p-5 shadow-2xl text-[#f7f5f0] space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/apple-touch-icon.png"
                  alt="Soundly Logo"
                  className="w-12 h-12 rounded-xl shadow-md shrink-0"
                />
                <div>
                  <h3 className="text-base font-extrabold text-[#f7f5f0]">
                    Gắn Soundly ra Màn hình chính
                  </h3>
                  <p className="text-xs text-[#a3aed0]">
                    Mở nhanh như ứng dụng gốc với logo Soundly
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSafariGuide(false)}
                className="p-1.5 rounded-lg text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-[#162047]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-2.5 text-xs text-[#d6ddf5] bg-[#141d3d] rounded-xl p-3.5 border border-[#222f5e]">
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#f47b64] text-[#070b1a] font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span className="flex items-center gap-1.5 flex-wrap">
                    Nhấn biểu tượng <Share className="w-4 h-4 text-[#f47b64] inline" />{' '}
                    <strong>Chia sẻ</strong> trên thanh công cụ Safari.
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#f47b64] text-[#070b1a] font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span className="flex items-center gap-1.5 flex-wrap">
                    Chọn <PlusSquare className="w-4 h-4 text-[#f47b64] inline" />{' '}
                    <strong>Thêm vào MH chính</strong> (Add to Home Screen).
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#f47b64] text-[#070b1a] font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span>
                    Nhấn <strong>Thêm</strong> ở góc trên bên phải để hoàn tất.
                  </span>
                </li>
              </ol>
            ) : (
              <div className="space-y-2 text-xs text-[#d6ddf5] bg-[#141d3d] rounded-xl p-3.5 border border-[#222f5e]">
                <p>
                  Trên Safari macOS: vào menu <strong>Tệp (File)</strong> &rarr;{' '}
                  <strong>Thêm vào Dock (Add to Dock)</strong> để gắn biểu tượng Soundly.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowSafariGuide(false)}
              className="w-full py-2.5 rounded-xl bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] font-bold text-xs transition-colors"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </>
  );
};
