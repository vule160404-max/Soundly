import React, { useState } from 'react';
import {
  Home,
  Compass,
  Library,
  Heart,
  History,
  Plus,
  Music,
  Upload,
  Trash2,
  ShieldCheck,
  X,
  Disc3
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { Playlist } from '../types/music';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  selectedPlaylistId: string | null;
  setSelectedPlaylistId: (id: string | null) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  selectedPlaylistId,
  setSelectedPlaylistId,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const {
    userPlaylists,
    likedTrackIds,
    deletePlaylist,
    setIsCreateAlbumModalOpen,
  } = usePlayer();
  const { isAdmin } = useAuth();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleOpenCreateAlbum = () => {
    setIsCreateAlbumModalOpen(true);
    if (onCloseMobile) onCloseMobile();
  };

  const navigateTo = (view: string) => {
    setCurrentView(view);
    setSelectedPlaylistId(null);
    if (onCloseMobile) onCloseMobile();
  };

  const openPlaylist = (pl: Playlist) => {
    setSelectedPlaylistId(pl.id);
    setCurrentView('playlist');
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#070b1a] text-[#a3aed0] select-none p-2 gap-2">
      {/* Box 1: Brand & Top Navigation */}
      <div className="bg-[#0d142c] border border-[#1e2a54] rounded-xl p-4 space-y-3">
        {/* Brand */}
        <div className="flex items-center justify-between pb-1">
          <button
            onClick={() => navigateTo('home')}
            className="flex items-center gap-3 text-left group focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-[#f7f5f0] shadow-md shadow-[#0c1957]/40 ring-1 ring-white/15 group-hover:scale-105 transition-transform shrink-0">
              <img
                src="/assets/aistudio/Logo_Soundly_b8420ae4.svg"
                alt="Soundly Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-black text-[#f7f5f0] group-hover:text-[#f47b64] transition-colors tracking-tight leading-none">
                Soundly
              </h1>
              <p className="text-[10px] font-medium text-[#a3aed0] truncate mt-1">
                Âm nhạc theo cách riêng
              </p>
            </div>
          </button>

          {isMobileOpen && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 text-[#a3aed0] hover:text-[#f7f5f0]"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Links */}
        <div className="space-y-1 pt-1">
          <button
            onClick={() => navigateTo('home')}
            className={`w-full flex items-center gap-3.5 px-2.5 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
              currentView === 'home'
                ? 'text-[#f7f5f0] bg-[#162047]'
                : 'text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-[#131c3d]'
            }`}
          >
            <Home className={`w-5 h-5 shrink-0 ${currentView === 'home' ? 'text-[#f47b64]' : ''}`} />
            <span>Trang chủ</span>
          </button>

          <button
            onClick={() => navigateTo('explore')}
            className={`w-full flex items-center gap-3.5 px-2.5 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
              currentView === 'explore'
                ? 'text-[#f7f5f0] bg-[#162047]'
                : 'text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-[#131c3d]'
            }`}
          >
            <Compass className={`w-5 h-5 shrink-0 ${currentView === 'explore' ? 'text-[#f47b64]' : ''}`} />
            <span>Tìm kiếm & Khám phá</span>
          </button>

          {/* DEDICATED ADMIN TAB (Visible ONLY for Admins) */}
          {isAdmin && (
            <button
              onClick={() => navigateTo('admin')}
              className={`w-full flex items-center gap-3.5 px-2.5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                currentView === 'admin'
                  ? 'text-[#070b1a] bg-[#f47b64] shadow-md'
                  : 'text-[#f47b64] bg-[#f47b64]/12 hover:bg-[#f47b64]/20 border border-[#f47b64]/35'
              }`}
            >
              <ShieldCheck className={`w-5 h-5 shrink-0 ${currentView === 'admin' ? 'text-[#070b1a]' : 'text-[#f47b64]'}`} />
              <span>Quản trị viên (Admin)</span>
            </button>
          )}
        </div>
      </div>

      {/* Box 2: Your Library & Personal Albums */}
      <div className="flex-1 bg-[#0d142c] border border-[#1e2a54] rounded-xl p-3 flex flex-col min-h-0 overflow-hidden">
        {/* Library Header */}
        <div className="flex items-center justify-between px-2 py-2 mb-2">
          <div className="flex items-center gap-2.5 text-sm font-bold text-[#f7f5f0]">
            <Library className="w-5 h-5 text-[#f47b64]" />
            <span>Thư viện của bạn</span>
          </div>

          <button
            onClick={handleOpenCreateAlbum}
            title="Tạo album mới trong thư viện"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#162047] hover:bg-[#f47b64] text-[#f7f5f0] hover:text-[#070b1a] text-[11px] font-bold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo album</span>
          </button>
        </div>

        {/* Liked Songs Special Row */}
        <div
          onClick={() => navigateTo('liked')}
          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
            currentView === 'liked' ? 'bg-[#1c2852] text-[#f7f5f0]' : 'hover:bg-[#141d3d] text-[#a3aed0] hover:text-[#f7f5f0]'
          }`}
        >
          <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#0c1957] via-[#273c8a] to-[#f47b64] flex items-center justify-center text-[#f7f5f0] shrink-0 shadow-sm">
            <Heart className="w-4 h-4 fill-[#f7f5f0]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#f7f5f0] truncate">Bài hát đã thích</p>
            <p className="text-[11px] text-[#a3aed0] truncate">
              {likedTrackIds.length} bài hát
            </p>
          </div>
        </div>

        {/* History Row */}
        <div
          onClick={() => navigateTo('history')}
          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
            currentView === 'history' ? 'bg-[#1c2852] text-[#f7f5f0]' : 'hover:bg-[#141d3d] text-[#a3aed0] hover:text-[#f7f5f0]'
          }`}
        >
          <div className="w-10 h-10 rounded-md bg-[#162047] flex items-center justify-center text-[#f7f5f0] shrink-0">
            <History className="w-4 h-4 text-[#f47b64]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#f7f5f0] truncate">Lịch sử nghe</p>
            <p className="text-[11px] text-[#a3aed0]">Nghe gần đây</p>
          </div>
        </div>

        <div className="border-t border-[#1e2a54] my-2" />

        {/* Custom Albums List Scroll Area */}
        <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
          {userPlaylists.length === 0 ? (
            <button
              onClick={handleOpenCreateAlbum}
              className="w-full mt-1 p-3 rounded-xl bg-[#141d3d]/75 hover:bg-[#1a254d] border border-dashed border-[#2b3b75] text-left space-y-1 transition-colors group"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-[#f7f5f0] group-hover:text-[#f47b64]">
                <Disc3 className="w-4 h-4 text-[#f47b64] shrink-0" />
                <span>Tạo album của riêng bạn</span>
              </div>
              <p className="text-[11px] text-[#8d99be] leading-relaxed">
                Gom những bài hát bạn yêu thích vào album riêng và thêm nhanh từ mọi danh sách nhạc.
              </p>
            </button>
          ) : (
            userPlaylists.map((pl) => {
              const isSelected = currentView === 'playlist' && selectedPlaylistId === pl.id;
              const isConfirming = confirmDeleteId === pl.id;

              return (
                <div
                  key={pl.id}
                  onClick={() => openPlaylist(pl)}
                  className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#1c2852] text-[#f7f5f0]'
                      : 'hover:bg-[#141d3d] text-[#a3aed0] hover:text-[#f7f5f0]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate flex-1 min-w-0 pr-1">
                    <div className="w-9 h-9 rounded-md bg-[#162047] overflow-hidden shrink-0 flex items-center justify-center">
                      {pl.coverUrl ? (
                        <img
                          src={pl.coverUrl}
                          alt={pl.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music className="w-4 h-4 text-[#a3aed0]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${isSelected ? 'text-[#f47b64]' : 'text-[#f7f5f0]'}`}>
                        {pl.title}
                      </p>
                      <p className="text-[10px] text-[#8d99be] truncate">
                        Album cá nhân • {pl.trackIds.length} bài hát
                      </p>
                    </div>
                  </div>

                  {pl.isCustom && (
                    isConfirming ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePlaylist(pl.id);
                          setConfirmDeleteId(null);
                          if (selectedPlaylistId === pl.id) {
                            navigateTo('home');
                          }
                        }}
                        onMouseLeave={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 rounded bg-rose-500 text-white text-[10px] font-bold shrink-0"
                      >
                        Xóa?
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(pl.id);
                        }}
                        title="Xóa album"
                        className="opacity-70 md:opacity-0 md:group-hover:opacity-100 p-1.5 text-[#a3aed0] hover:text-rose-400 rounded transition-opacity shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Admin Quick Upload Shortcut (Visible ONLY for Admin) */}
        {isAdmin && (
          <div className="pt-2 mt-auto border-t border-[#1e2a54]">
            <button
              onClick={() => navigateTo('admin')}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-extrabold text-[#070b1a] bg-[#f47b64] hover:bg-[#ff8d76] transition-all shadow-md"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Nạp nhạc hàng loạt</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-72 flex-col h-full shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-over Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-[#050814]/75 backdrop-blur-sm flex">
          <div className="w-[85vw] max-w-xs h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
          <div className="flex-1 h-full" onClick={onCloseMobile} />
        </div>
      )}
    </>
  );
};
