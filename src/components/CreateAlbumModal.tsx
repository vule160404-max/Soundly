import React, { useState, useEffect } from 'react';
import { Disc3, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { Playlist } from '../types/music';

interface CreateAlbumModalProps {
  onCreated?: (playlist: Playlist) => void;
}

export const CreateAlbumModal: React.FC<CreateAlbumModalProps> = ({ onCreated }) => {
  const {
    isCreateAlbumModalOpen,
    setIsCreateAlbumModalOpen,
    userPlaylists,
    createPlaylist,
  } = usePlayer();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!isCreateAlbumModalOpen) return;
    setTitle('');
    setDescription('');

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCreateAlbumModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateAlbumModalOpen, setIsCreateAlbumModalOpen]);

  if (!isCreateAlbumModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim() || `Album của tôi #${userPlaylists.length + 1}`;
    const newAlbum = createPlaylist(finalTitle, description);
    setIsCreateAlbumModalOpen(false);
    if (onCreated) onCreated(newAlbum);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-album-title"
      className="fixed inset-0 z-50 bg-[#040714]/78 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4 soundly-backdrop"
      onClick={() => setIsCreateAlbumModalOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] bg-[#0e1633]/95 backdrop-blur-xl rounded-3xl ring-1 ring-white/10 shadow-[0_24px_64px_-12px_rgba(3,7,22,0.9)] overflow-hidden text-[#f7f5f0] soundly-modal relative"
      >
        <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full bg-[#f47b64]/18 blur-3xl" />

        <div className="relative p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-[#f47b64]/12 ring-1 ring-[#f47b64]/25 flex items-center justify-center text-[#f47b64] shrink-0">
                <Disc3 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 id="create-album-title" className="text-base font-bold text-[#f7f5f0]">
                  Tạo album mới
                </h3>
                <p className="text-xs text-[#a3aed0] mt-0.5">
                  Lưu trữ bài hát theo phong cách riêng trong thư viện
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCreateAlbumModalOpen(false)}
              aria-label="Đóng hộp thoại"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-white/[0.06] transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="album-title-input" className="text-xs font-semibold text-[#d6ddf5] block">
                Tên album
              </label>
              <input
                id="album-title-input"
                type="text"
                autoFocus
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Album của tôi #${userPlaylists.length + 1}`}
                className="w-full px-4 py-3 rounded-xl bg-[#152046]/80 border border-white/[0.08] focus:border-[#f47b64] focus:ring-2 focus:ring-[#f47b64]/20 text-sm text-[#f7f5f0] placeholder-[#6e7ba8] outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="album-desc-input" className="text-xs font-semibold text-[#d6ddf5] block">
                Mô tả ngắn <span className="text-[#7f8bb3] font-normal">(tuỳ chọn)</span>
              </label>
              <textarea
                id="album-desc-input"
                rows={2}
                maxLength={250}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ghi chú tâm trạng hoặc chủ đề của album..."
                className="w-full px-4 py-3 rounded-xl bg-[#152046]/80 border border-white/[0.08] focus:border-[#f47b64] focus:ring-2 focus:ring-[#f47b64]/20 text-sm text-[#f7f5f0] placeholder-[#6e7ba8] outline-none transition-all resize-none"
              />
            </div>

            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsCreateAlbumModalOpen(false)}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.11] text-xs sm:text-sm font-semibold text-[#d6ddf5] transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] shadow-lg shadow-[#f47b64]/20 active:scale-[0.98] transition-all"
              >
                Tạo album
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
