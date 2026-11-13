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
    if (albumPickerTrack) {
      setNewAlbumName('');
      setFeedback(null);
    }
  }, [albumPickerTrack]);

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
    showNotice(`Đã tạo album "${created.title}" và thêm bài hát!`);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#050814]/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={closeAlbumPicker}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#0d142c] border border-[#2b3b75] rounded-2xl p-5 shadow-2xl text-[#f7f5f0] space-y-4"
      >
        {/* Header with Track Info */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={albumPickerTrack.coverUrl}
              alt={albumPickerTrack.title}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-lg object-cover shrink-0 bg-[#141d3d]"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#f47b64]">
                Thêm vào thư viện của bạn
              </p>
              <h3 className="text-sm font-extrabold text-[#f7f5f0] truncate">
                {albumPickerTrack.title}
              </h3>
              <p className="text-xs text-[#a3aed0] truncate">{albumPickerTrack.artist}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeAlbumPicker}
            className="p-1.5 rounded-lg text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-[#162047] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inline Feedback */}
        {feedback && (
          <div className="px-3 py-2 rounded-xl bg-[#f47b64]/15 border border-[#f47b64]/45 text-xs font-bold text-[#f47b64] flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span className="truncate">{feedback}</span>
          </div>
        )}

        {/* Existing Personal Albums List */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#a3aed0]">
            Chọn album của bạn ({userPlaylists.length})
          </p>

          {userPlaylists.length > 0 ? (
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {userPlaylists.map((pl) => {
                const isAdded = pl.trackIds.includes(albumPickerTrack.id);
                return (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => handleToggleAlbum(pl.id, pl.title)}
                    className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all text-left ${
                      isAdded
                        ? 'bg-[#1c2852] border-[#f47b64]/60 text-[#f7f5f0]'
                        : 'bg-[#141d3d] hover:bg-[#1a254d] border-[#222f5e] text-[#f7f5f0]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#162047] shrink-0 flex items-center justify-center">
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
                        <p className="text-xs font-bold truncate">{pl.title}</p>
                        <p className="text-[11px] text-[#a3aed0]">
                          {pl.trackIds.length} bài hát
                        </p>
                      </div>
                    </div>

                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        isAdded
                          ? 'bg-[#f47b64] text-[#070b1a]'
                          : 'bg-[#0d142c] border border-[#2b3b75] text-[#a3aed0]'
                      }`}
                    >
                      {isAdded ? (
                        <Check className="w-4 h-4 stroke-[3]" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#141d3d]/70 border border-dashed border-[#2b3b75] text-center space-y-1">
              <FolderPlus className="w-6 h-6 mx-auto text-[#f47b64]" />
              <p className="text-xs font-bold text-[#f7f5f0]">
                Bạn chưa có album nào trong thư viện
              </p>
              <p className="text-[11px] text-[#a3aed0]">
                Tạo nhanh một album bên dưới để lưu bài hát này ngay!
              </p>
            </div>
          )}
        </div>

        {/* Quick Create New Album & Add Track */}
        <form
          onSubmit={handleCreateAndAdd}
          className="pt-3 border-t border-[#1e2a54] space-y-2"
        >
          <label className="text-[11px] font-bold text-[#a3aed0] block">
            Hoặc tạo nhanh album mới & thêm bài này:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              maxLength={100}
              value={newAlbumName}
              onChange={(e) => setNewAlbumName(e.target.value)}
              placeholder="Nhập tên album mới..."
              className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#141d3d] border border-[#222f5e] focus:border-[#f47b64] text-xs text-[#f7f5f0] placeholder-[#6e7ba8] outline-none"
            />
            <button
              type="submit"
              disabled={!newAlbumName.trim()}
              className="px-3.5 py-2 rounded-xl bg-[#f47b64] hover:bg-[#ff8d76] disabled:opacity-40 text-[#070b1a] font-extrabold text-xs flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo & Thêm</span>
            </button>
          </div>
        </form>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={closeAlbumPicker}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#141d3d] hover:bg-[#1c2852] text-[#f7f5f0] transition-colors"
          >
            Xong
          </button>
        </div>
      </div>
    </div>
  );
};
