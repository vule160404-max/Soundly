import React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export const ConfirmDialog: React.FC = () => {
  const { confirmDialog, closeConfirmDialog } = usePlayer();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!confirmDialog) {
      setIsProcessing(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        closeConfirmDialog();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDialog, isProcessing, closeConfirmDialog]);

  if (!confirmDialog) return null;

  const isDanger = (confirmDialog.tone || 'danger') === 'danger';

  const handleConfirm = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await confirmDialog.onConfirm();
      closeConfirmDialog();
    } catch (err) {
      console.error('Confirm action failed:', err);
      setIsProcessing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="soundly-confirm-title"
      className="fixed inset-0 z-[60] bg-[#040714]/78 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4 soundly-backdrop"
      onClick={() => {
        if (!isProcessing) closeConfirmDialog();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] bg-[#0e1633]/95 backdrop-blur-xl rounded-3xl ring-1 ring-white/10 shadow-[0_24px_64px_-12px_rgba(3,7,22,0.9)] overflow-hidden text-[#f7f5f0] soundly-modal relative"
      >
        {/* Subtle top radial accent glow */}
        <div
          className={`pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full blur-3xl ${
            isDanger ? 'bg-rose-500/20' : 'bg-[#f47b64]/20'
          }`}
        />

        <div className="relative p-6 space-y-5">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ring-1 ${
                  isDanger
                    ? 'bg-rose-500/12 text-rose-400 ring-rose-500/25'
                    : 'bg-[#f47b64]/12 text-[#f47b64] ring-[#f47b64]/25'
                }`}
              >
                {isDanger ? (
                  <Trash2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>

              <div className="min-w-0 pt-0.5">
                <h3
                  id="soundly-confirm-title"
                  className="text-base font-bold text-[#f7f5f0] leading-snug"
                >
                  {confirmDialog.title}
                </h3>
                <p className="text-sm text-[#a3aed0] mt-1.5 leading-relaxed">
                  {confirmDialog.description}
                  {confirmDialog.highlight && (
                    <>
                      {' '}
                      <span className="font-semibold text-[#f7f5f0] break-words">
                        “{confirmDialog.highlight}”
                      </span>
                      ?
                    </>
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isProcessing}
              onClick={closeConfirmDialog}
              aria-label="Đóng hộp thoại"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-white/[0.06] transition-colors shrink-0 disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Hairline Divider & Actions */}
          <div className="pt-4 border-t border-white/[0.06] flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={isProcessing}
              onClick={closeConfirmDialog}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.11] text-xs sm:text-sm font-semibold text-[#d6ddf5] transition-colors disabled:opacity-40"
            >
              {confirmDialog.cancelLabel || 'Hủy'}
            </button>

            <button
              type="button"
              autoFocus
              disabled={isProcessing}
              onClick={handleConfirm}
              className={`min-h-[44px] px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${
                isDanger
                  ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/20'
                  : 'bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] shadow-lg shadow-[#f47b64]/20'
              }`}
            >
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{confirmDialog.confirmLabel || (isDanger ? 'Xóa' : 'Xác nhận')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
