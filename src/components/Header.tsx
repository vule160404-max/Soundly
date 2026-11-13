import React, { useState } from 'react';
import { Search, X, Moon, Clock, Menu, LogOut, Sparkles, ShieldCheck } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { SPOTIFY_GENRE_NAMES } from '../data/mockTracks';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeGenre: string;
  setActiveGenre: (genre: string) => void;
  onOpenSleepTimer: () => void;
  onOpenMobileMenu?: () => void;
  onOpenAdmin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  setSearchQuery,
  activeGenre,
  setActiveGenre,
  onOpenSleepTimer,
  onOpenMobileMenu,
  onOpenAdmin
}) => {
  const { sleepTimerRemaining } = usePlayer();
  const { user, isAdmin, setIsLoginModalOpen, logout } = useAuth();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const genres = [
    { id: 'all', label: 'Tất cả' },
    ...SPOTIFY_GENRE_NAMES.map(name => ({ id: name, label: name })),
  ];

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="sticky top-0 z-20 bg-[#0d142c]/95 backdrop-blur-md border-b border-[#1e2a54] px-4 md:px-6 py-3 flex flex-col gap-2.5 select-none text-[#f7f5f0]">
      <div className="flex items-center justify-between gap-3">
        {/* Mobile Menu Button */}
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center text-[#a3aed0] hover:text-[#f7f5f0] rounded-xl hover:bg-[#162047] transition-colors"
            title="Mở menu thư viện"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Soundly Dark Search Bar */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#a3aed0]">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Bạn muốn nghe bài gì?"
            className="w-full pl-9.5 pr-8 py-2.5 bg-[#141d3d] hover:bg-[#1a254d] focus:bg-[#1a254d] text-xs sm:text-sm text-[#f7f5f0] placeholder-[#7f8bb3] rounded-full border border-[#222f5e] focus:border-[#f47b64]/60 transition-all outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 min-w-[36px] flex items-center justify-center text-[#a3aed0] hover:text-[#f7f5f0]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right Actions: PWA Install, Sleep Timer & Login / Profile */}
        <div className="flex items-center gap-2">
          <PWAInstallButton />

          {/* Admin Quick Link Button (Visible exclusively for admin) */}
          {isAdmin && onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#f47b64]/15 hover:bg-[#f47b64]/25 text-[#f47b64] border border-[#f47b64]/45 transition-colors shrink-0 whitespace-nowrap"
              title="Khu vực Quản trị viên"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#f47b64]" />
              <span className="hidden sm:inline">Quản trị</span>
            </button>
          )}

          {/* Sleep Timer Indicator / Trigger Button */}
          <button
            onClick={onOpenSleepTimer}
            title={sleepTimerRemaining ? `Đang hẹn giờ: còn ${formatTimer(sleepTimerRemaining)}` : 'Hẹn giờ tắt nhạc'}
            className={`min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 whitespace-nowrap ${
              sleepTimerRemaining
                ? 'bg-[#f47b64]/15 text-[#f47b64] border-[#f47b64]/45'
                : 'bg-[#141d3d] text-[#a3aed0] border-[#222f5e] hover:text-[#f7f5f0] hover:bg-[#1a254d]'
            }`}
          >
            {sleepTimerRemaining ? (
              <>
                <Clock className="w-3.5 h-3.5 text-[#f47b64] animate-spin" style={{ animationDuration: '6s' }} />
                <span className="font-mono tabular-nums">{formatTimer(sleepTimerRemaining)}</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[#a3aed0]" />
                <span className="hidden sm:inline">Hẹn giờ</span>
              </>
            )}
          </button>

          {/* User Auth: Login Button or Profile Dropdown */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full bg-[#141d3d] hover:bg-[#1c2852] border border-[#222f5e] transition-colors"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Avatar'}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#f47b64] text-[#070b1a] font-bold text-xs flex items-center justify-center">
                    {user.displayName?.[0] || 'U'}
                  </div>
                )}
                <span className="text-xs font-bold text-[#f7f5f0] max-w-[90px] sm:max-w-[130px] truncate hidden sm:inline">
                  {user.displayName || 'Tài khoản'}
                </span>
              </button>

              {/* Profile Dropdown */}
              {isProfileMenuOpen && (
                <div
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="absolute right-0 top-full mt-2 z-40 w-64 bg-[#141d3d] rounded-2xl shadow-2xl border border-[#2b3b75] p-2 text-xs text-[#f7f5f0] animate-in fade-in zoom-in-95"
                >
                  <div className="p-3 border-b border-[#222f5e]">
                    <p className="font-bold text-[#f7f5f0] truncate text-sm">{user.displayName || 'Tài khoản Google'}</p>
                    <p className="text-[#a3aed0] truncate text-[11px] mt-0.5">{user.email}</p>
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#f47b64] font-semibold bg-[#f47b64]/12 px-2 py-0.5 rounded-full w-fit">
                      <Sparkles className="w-3 h-3" />
                      <span>{isAdmin ? 'Quản trị viên (Admin)' : 'Thành viên Soundly'}</span>
                    </div>
                  </div>

                  {isAdmin && onOpenAdmin && (
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onOpenAdmin();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-[#1c2852] text-[#f47b64] font-bold transition-colors my-1"
                    >
                      <ShieldCheck className="w-4 h-4 text-[#f47b64]" />
                      <span>Bảng điều khiển Quản trị</span>
                    </button>
                  )}

                  <button
                    onClick={() => logout()}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-[#1c2852] text-rose-400 font-semibold transition-colors mt-1"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="h-10 px-5 rounded-full bg-[#f7f5f0] hover:bg-white text-[#070b1a] font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md hover:scale-105 active:scale-95 transition-all"
            >
              <span>Đăng nhập</span>
            </button>
          )}
        </div>
      </div>

      {/* Soundly Genre Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
        {genres.map(g => (
          <button
            key={g.id}
            onClick={() => setActiveGenre(g.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap shrink-0 min-h-[32px] flex items-center ${
              activeGenre === g.id
                ? 'bg-[#f47b64] text-[#070b1a] font-bold shadow-sm'
                : 'bg-[#141d3d] text-[#f7f5f0] hover:bg-[#1c2852]'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
    </header>
  );
};
