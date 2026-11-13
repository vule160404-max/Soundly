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
    if (isCreateAlbumModalOpen) {
      setTitle('');
      setDescription('');
    }
  }, [isCreateAlbumModalOpen]);

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
      className="fixed inset-0 z-50 bg-[#050814]/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setIsCreateAlbumModalOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#0d142c] border border-[#2b3b75] rounded-2xl p-6 shadow-2xl text-[#f7f5f0] space-y-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#f47b64]/15 border border-[#f47b64]/40 flex items-center justify-center text-[#f47b64] shrink-0">
              <Disc3 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#f7f5f0]">
                Tạo album mới trong thư viện
              </h3>
              <p className="text-xs text-[#a3aed0]">
                Lưu những bài hát yêu thích vào bộ sưu tập của riêng bạn
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateAlbumModalOpen(false)}
            className="p-1.5 rounded-lg text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-[#162047]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#a3aed0] block">Tên album</label>
            <input
              type="text"
              autoFocus
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Ví dụ: Album của tôi #${userPlaylists.length + 1}`}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#141d3d] border border-[#222f5e] focus:border-[#f47b64] text-sm text-[#f7f5f0] placeholder-[#6e7ba8] outline-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#a3aed0] block">Mô tả ngắn (tuỳ chọn)</label>
            <textarea
              rows={2}
              maxLength={250}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú tâm trạng hoặc chủ đề của album..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#141d3d] border border-[#222f5e] focus:border-[#f47b64] text-sm text-[#f7f5f0] placeholder-[#6e7ba8] outline-none transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsCreateAlbumModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-[#162047] transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] shadow-lg transition-colors"
            >
              Tạo album
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
