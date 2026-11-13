import React, { useState, useEffect } from 'react';
import { FolderPlus, Plus, Check, Disc3, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export const AddToAlbumModal: React.FC = () => {
  const {
    albumPickerTrack,
    closeAlbumPicker,
    userPlaylists,
    toggleTrackInPlaylist,
    createPlaylist,
  } = usePlayer();

  const [newAlbumName, setNewAlbumName] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!albumPickerTrack) return;
    setNewAlbumName('');
    setFeedback(null);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAlbumPicker();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [albumPickerTrack, closeAlbumPicker]);

  if (!albumPickerTrack) return null;

  const showNotice = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => {
      setFeedback((prev) => (prev === msg ? null : prev));
    }, 2500);
  };

  const handleToggleAlbum = (playlistId: string, playlistTitle: string) => {
    const added = toggleTrackInPlaylist(playlistId, albumPickerTrack);
    showNotice(
      added
        ? `Đã thêm vào album "${playlistTitle}"`
        : `Đã gỡ khỏi album "${playlistTitle}"`
    );
  };

  const handleCreateAndAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newAlbumName.trim();
    if (!trimmed) return;
    const created = createPlaylist(trimmed, undefined, albumPickerTrack);
    setNewAlbumName('');
    showNotice(`Đã tạo album "${created.title}" và thêm bài hát`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-album-title"
      className="fixed inset-0 z-50 bg-[#040714]/78 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4 soundly-backdrop"
      onClick={closeAlbumPicker}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] bg-[#0e1633]/95 backdrop-blur-xl rounded-3xl ring-1 ring-white/10 shadow-[0_24px_64px_-12px_rgba(3,7,22,0.9)] overflow-hidden text-[#f7f5f0] soundly-modal relative"
      >
        <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full bg-[#f47b64]/16 blur-3xl" />

        <div className="relative p-6 space-y-5">
          {/* Header with Track Preview */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <img
                src={albumPickerTrack.coverUrl}
                alt={albumPickerTrack.title}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-xl object-cover shrink-0 bg-[#152046] ring-1 ring-white/10"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#f47b64]">
                  Thêm vào thư viện
                </p>
                <h3
                  id="add-to-album-title"
                  className="text-sm sm:text-base font-bold text-[#f7f5f0] truncate"
                >
                  {albumPickerTrack.title}
                </h3>
                <p className="text-xs text-[#a3aed0] truncate">
                  {albumPickerTrack.artist}
                  {albumPickerTrack.album ? ` · ${albumPickerTrack.album}` : ''}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeAlbumPicker}
              aria-label="Đóng hộp thoại"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-white/[0.06] transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Inline Feedback */}
          {feedback && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#f47b64]/12 ring-1 ring-[#f47b64]/30 text-xs font-semibold text-[#f47b64] flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span className="truncate">{feedback}</span>
            </div>
          )}

          {/* Albums List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-[#a3aed0]">
              <span className="font-semibold text-[#d6ddf5]">Album cá nhân</span>
              <span className="tabular-nums">{userPlaylists.length} album</span>
            </div>

            {userPlaylists.length > 0 ? (
              <div className="max-h-56 overflow-y-auto divide-y divide-white/[0.06] rounded-2xl bg-[#152046]/55">
                {userPlaylists.map((pl) => {
                  const isAdded = pl.trackIds.includes(albumPickerTrack.id);
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => handleToggleAlbum(pl.id, pl.title)}
                      className="w-full min-h-[56px] flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-white/[0.05] transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#1a2754] shrink-0 flex items-center justify-center">
                          {pl.coverUrl ? (
                            <img
                              src={pl.coverUrl}
                              alt={pl.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Disc3 className="w-5 h-5 text-[#a3aed0]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#f7f5f0] truncate">
                            {pl.title}
                          </p>
                          <p className="text-xs text-[#a3aed0] tabular-nums">
                            {pl.trackIds.length} bài hát
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                          isAdded
                            ? 'bg-[#f47b64] text-[#070b1a]'
                            : 'bg-white/[0.06] text-[#a3aed0]'
                        }`}
                      >
                        {isAdded ? (
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 px-4 rounded-2xl bg-[#152046]/55 text-center space-y-1.5">
                <FolderPlus className="w-6 h-6 mx-auto text-[#f47b64]" />
                <p className="text-sm font-semibold text-[#f7f5f0]">
                  Chưa có album nào trong thư viện
                </p>
                <p className="text-xs text-[#a3aed0]">
                  Nhập tên bên dưới để tạo album đầu tiên và lưu bài hát này ngay.
                </p>
              </div>
            )}
          </div>

          {/* Quick Create New Album & Add Track */}
          <form
            onSubmit={handleCreateAndAdd}
            className="pt-4 border-t border-white/[0.06] space-y-2.5"
          >
            <label
              htmlFor="quick-new-album-input"
              className="text-xs font-semibold text-[#d6ddf5] block"
            >
              Tạo nhanh album mới
            </label>
            <div className="flex items-center gap-2">
              <input
                id="quick-new-album-input"
                type="text"
                maxLength={100}
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                placeholder="Nhập tên album mới..."
                className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-[#152046]/80 border border-white/[0.08] focus:border-[#f47b64] focus:ring-2 focus:ring-[#f47b64]/20 text-sm text-[#f7f5f0] placeholder-[#6e7ba8] outline-none transition-all"
              />
              <button
                type="submit"
                disabled={!newAlbumName.trim()}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#f47b64] hover:bg-[#ff8d76] disabled:opacity-40 text-[#070b1a] font-bold text-xs sm:text-sm flex items-center gap-1.5 shrink-0 active:scale-[0.98] transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo</span>
              </button>
            </div>
          </form>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={closeAlbumPicker}
              className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white/[0.06] hover:bg-white/[0.11] text-[#f7f5f0] transition-colors"
            >
              Xong
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
