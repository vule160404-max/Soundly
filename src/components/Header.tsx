import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  X,
  Moon,
  Clock,
  Menu,
  LogOut,
  Sparkles,
  ShieldCheck,
  Play,
  ArrowUpRight,
  History,
  Disc3,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { SPOTIFY_GENRE_NAMES } from '../data/mockTracks';
import { PWAInstallButton } from './PWAInstallButton';
import { ArtistProfile, Track } from '../types/music';
import { ArtistAvatar } from './ArtistAvatar';
import { getSearchSuggestions, normalizeSearchText } from '../utils/artistSync';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeGenre: string;
  setActiveGenre: (genre: string) => void;
  allTracks: Track[];
  artists: ArtistProfile[];
  onSelectArtist: (artist: ArtistProfile) => void;
  onNavigateToExplore: () => void;
  onOpenSleepTimer: () => void;
  onOpenMobileMenu?: () => void;
  onOpenAdmin?: () => void;
}

const RECENT_SEARCHES_KEY = 'soundly_recent_searches_v1';

function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string').slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

function saveRecentSearches(items: string[]) {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(items.slice(0, 5)));
  } catch {
    // ignore
  }
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  setSearchQuery,
  activeGenre,
  setActiveGenre,
  allTracks,
  artists,
  onSelectArtist,
  onNavigateToExplore,
  onOpenSleepTimer,
  onOpenMobileMenu,
  onOpenAdmin,
}) => {
  const { sleepTimerRemaining, playTrack, currentTrack } = usePlayer();
  const { user, isAdmin, setIsLoginModalOpen, logout } = useAuth();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>(loadRecentSearches);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const genres = [
    { id: 'all', label: 'Tất cả' },
    ...SPOTIFY_GENRE_NAMES.map(name => ({ id: name, label: name })),
  ];

  const suggestions = useMemo(
    () => getSearchSuggestions(searchQuery, allTracks, artists),
    [searchQuery, allTracks, artists]
  );

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  // Reset highlight index whenever query changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchQuery]);

  const recordSearch = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    const next = [
      clean,
      ...recentSearches.filter(r => r.toLowerCase() !== clean.toLowerCase()),
    ].slice(0, 5);
    setRecentSearches(next);
    saveRecentSearches(next);
  };

  const removeRecentSearch = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = recentSearches.filter(r => r !== term);
    setRecentSearches(next);
    saveRecentSearches(next);
  };

  type FlatSuggestion =
    | { kind: 'artist'; artist: ArtistProfile }
    | { kind: 'track'; track: Track }
    | { kind: 'genre'; genre: string };

  const flatItems = useMemo<FlatSuggestion[]>(() => {
    const list: FlatSuggestion[] = [];
    suggestions.artists.forEach(artist => list.push({ kind: 'artist', artist }));
    suggestions.tracks.forEach(track => list.push({ kind: 'track', track }));
    suggestions.genres.forEach(genre => list.push({ kind: 'genre', genre }));
    return list;
  }, [suggestions]);

  const activateSuggestion = (item: FlatSuggestion) => {
    if (item.kind === 'artist') {
      recordSearch(item.artist.name);
      onSelectArtist(item.artist);
      setIsSearchOpen(false);
    } else if (item.kind === 'track') {
      recordSearch(item.track.title);
      playTrack(item.track, allTracks);
      setIsSearchOpen(false);
    } else if (item.kind === 'genre') {
      setActiveGenre(item.genre);
      setSearchQuery('');
      onNavigateToExplore();
      setIsSearchOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSearchOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsSearchOpen(true);
      return;
    }

    if (e.key === 'Escape') {
      setIsSearchOpen(false);
      searchInputRef.current?.blur();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatItems.length === 0) return;
      setHighlightedIndex(prev => (prev + 1) % flatItems.length);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatItems.length === 0) return;
      setHighlightedIndex(prev =>
        prev <= 0 ? flatItems.length - 1 : prev - 1
      );
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && flatItems[highlightedIndex]) {
        activateSuggestion(flatItems[highlightedIndex]);
      } else if (searchQuery.trim()) {
        recordSearch(searchQuery);
        onNavigateToExplore();
        setIsSearchOpen(false);
      }
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const renderHighlight = (text: string, query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return text;
    const normText = normalizeSearchText(text);
    const normQ = normalizeSearchText(trimmed);
    const idx = normText.indexOf(normQ);
    if (idx === -1) return text;

    // Safe visual slice when lengths match; fallback cleanly if NFD lengths diverge
    if (normText.length === text.length) {
      return (
        <>
          {text.slice(0, idx)}
          <span className="text-[#f47b64] font-bold">
            {text.slice(idx, idx + normQ.length)}
          </span>
          {text.slice(idx + normQ.length)}
        </>
      );
    }
    return text;
  };

  const hasQuery = searchQuery.trim().length > 0;
  const hasAnyMatches =
    suggestions.artists.length > 0 ||
    suggestions.tracks.length > 0 ||
    suggestions.genres.length > 0;

  let itemCursor = -1;

  const renderRightActions = () => (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
      <PWAInstallButton />

      {/* Admin Quick Link Button (Visible exclusively for admin) */}
      {isAdmin && onOpenAdmin && (
        <button
          type="button"
          onClick={onOpenAdmin}
          className="min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-0 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#f47b64]/15 hover:bg-[#f47b64]/25 active:scale-95 text-[#f47b64] border border-[#f47b64]/45 transition-all shrink-0 whitespace-nowrap touch-manipulation"
          title="Khu vực Quản trị viên"
        >
          <ShieldCheck className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[#f47b64]" />
          <span className="hidden sm:inline">Quản trị</span>
        </button>
      )}

      {/* Sleep Timer Indicator / Trigger Button */}
      <button
        type="button"
        onClick={onOpenSleepTimer}
        title={
          sleepTimerRemaining
            ? `Đang hẹn giờ: còn ${formatTimer(sleepTimerRemaining)}`
            : 'Hẹn giờ tắt nhạc'
        }
        className={`min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-0 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border active:scale-95 transition-all shrink-0 whitespace-nowrap touch-manipulation ${
          sleepTimerRemaining
            ? 'bg-[#f47b64]/15 text-[#f47b64] border-[#f47b64]/45'
            : 'bg-[#141d3d] text-[#a3aed0] border-[#222f5e] hover:text-[#f7f5f0] hover:bg-[#1a254d]'
        }`}
      >
        {sleepTimerRemaining ? (
          <>
            <Clock
              className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[#f47b64] animate-spin"
              style={{ animationDuration: '6s' }}
            />
            <span className="font-mono tabular-nums">
              {formatTimer(sleepTimerRemaining)}
            </span>
          </>
        ) : (
          <>
            <Moon className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[#a3aed0]" />
            <span className="hidden sm:inline">Hẹn giờ</span>
          </>
        )}
      </button>

      {/* User Auth: Login Button or Profile Dropdown */}
      {user ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="min-h-[44px] min-w-[44px] sm:min-h-[40px] flex items-center justify-center gap-2 p-1 sm:pl-1.5 sm:pr-2.5 rounded-full bg-[#141d3d] hover:bg-[#1c2852] active:scale-95 border border-[#222f5e] transition-all touch-manipulation"
            aria-label="Mở menu tài khoản"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'Avatar'}
                referrerPolicy="no-referrer"
                className="w-8 h-8 sm:w-7 sm:h-7 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 sm:w-7 sm:h-7 rounded-full bg-[#f47b64] text-[#070b1a] font-bold text-xs flex items-center justify-center">
                {user.displayName?.[0] || 'U'}
              </div>
            )}
            <span className="text-xs font-bold text-[#f7f5f0] max-w-[90px] sm:max-w-[130px] truncate hidden sm:inline">
              {user.displayName || 'Tài khoản'}
            </span>
          </button>

          {/* Profile Dropdown */}
          <AnimatePresence>
            {isProfileMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsProfileMenuOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="absolute right-0 top-full mt-2 z-40 w-64 bg-[#141d3d] rounded-2xl shadow-2xl border border-[#2b3b75] p-2 text-xs text-[#f7f5f0]"
                >
                  <div className="p-3 border-b border-[#222f5e]">
                    <p className="font-bold text-[#f7f5f0] truncate text-sm">
                      {user.displayName || 'Tài khoản Google'}
                    </p>
                    <p className="text-[#a3aed0] truncate text-[11px] mt-0.5">
                      {user.email}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#f47b64] font-semibold bg-[#f47b64]/12 px-2 py-0.5 rounded-full w-fit">
                      <Sparkles className="w-3 h-3" />
                      <span>
                        {isAdmin ? 'Quản trị viên (Admin)' : 'Thành viên Soundly'}
                      </span>
                    </div>
                  </div>

                  {isAdmin && onOpenAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onOpenAdmin();
                      }}
                      className="w-full min-h-[44px] flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-[#1c2852] text-[#f47b64] font-bold transition-colors my-1"
                    >
                      <ShieldCheck className="w-4 h-4 text-[#f47b64]" />
                      <span>Bảng điều khiển Quản trị</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => logout()}
                    className="w-full min-h-[44px] flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-[#1c2852] text-rose-400 font-semibold transition-colors mt-1"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Đăng xuất</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsLoginModalOpen(true)}
          className="min-h-[44px] px-4 sm:px-5 rounded-full bg-[#f7f5f0] hover:bg-white text-[#070b1a] font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md active:scale-95 transition-all touch-manipulation"
        >
          <span>Đăng nhập</span>
        </button>
      )}
    </div>
  );

  return (
    <header className="sticky top-0 z-30 bg-[#0d142c]/95 backdrop-blur-md border-b border-[#1e2a54] px-3.5 sm:px-4 md:px-6 pb-2.5 pt-2.5 md:py-3 soundly-header-safe flex flex-col gap-2.5 select-none text-[#f7f5f0]">
      {/* Mobile Top Row: Dedicated Easy-Reach Action Bar (Below iPhone Notch / Status Bar) */}
      <div className="flex md:hidden items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-[#141d3d] active:bg-[#1e2b5c] border border-[#222f5e] text-[#f7f5f0] rounded-xl active:scale-95 transition-all shrink-0 touch-manipulation"
              title="Mở menu thư viện"
              aria-label="Mở menu thư viện"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl overflow-hidden bg-[#f7f5f0] ring-1 ring-white/15 shrink-0">
              <img
                src="/assets/aistudio/Logo_Soundly__2__5c576ab3.svg"
                alt="Soundly Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-base font-black tracking-tight text-[#f7f5f0] truncate">
              Soundly
            </span>
          </div>
        </div>

        {renderRightActions()}
      </div>

      {/* Search Bar Row + Desktop Right Actions */}
      <div className="flex items-center justify-between gap-3">
        {/* Soundly Search Bar + Instant Autocomplete Suggestions */}
        <div ref={searchContainerRef} className="relative flex-1 md:max-w-lg">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#a3aed0]">
              <Search className="w-4 h-4" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onChange={e => {
                setSearchQuery(e.target.value);
                if (!isSearchOpen) setIsSearchOpen(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Tìm bài hát, nghệ sĩ hoặc thể loại..."
              aria-label="Tìm bài hát, nghệ sĩ hoặc thể loại"
              aria-expanded={isSearchOpen}
              className="w-full min-h-[44px] md:min-h-[40px] pl-10 pr-10 py-2 bg-[#141d3d] hover:bg-[#1a254d] focus:bg-[#1a254d] text-base sm:text-sm text-[#f7f5f0] placeholder-[#7f8bb3] rounded-full border border-[#222f5e] focus:border-[#f47b64]/60 transition-all outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute inset-y-0 right-0 pr-2.5 min-w-[44px] flex items-center justify-center text-[#a3aed0] hover:text-[#f7f5f0] touch-manipulation"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Suggestions Dropdown */}
          <AnimatePresence>
            {isSearchOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.985 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="absolute left-0 right-0 top-full mt-2 z-50 bg-[#101836]/98 backdrop-blur-xl rounded-2xl border border-[#2b3b75] shadow-2xl overflow-hidden max-h-[65vh] overflow-y-auto"
              >
              {/* Recent Searches when input is empty */}
              {!hasQuery && recentSearches.length > 0 && (
                <div className="p-3 border-b border-[#1e2a54]">
                  <div className="flex items-center justify-between px-1 mb-2">
                    <span className="text-[11px] font-bold text-[#a3aed0]">
                      Tìm kiếm gần đây
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map(term => (
                      <div
                        key={term}
                        onClick={() => {
                          setSearchQuery(term);
                          setIsSearchOpen(true);
                        }}
                        className="group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-full bg-[#162047] hover:bg-[#1e2b5c] text-xs text-[#f7f5f0] cursor-pointer transition-colors"
                      >
                        <History className="w-3 h-3 text-[#a3aed0]" />
                        <span className="max-w-[140px] truncate">{term}</span>
                        <button
                          type="button"
                          onClick={e => removeRecentSearch(term, e)}
                          className="p-1 rounded-full text-[#8d99be] hover:text-[#f7f5f0]"
                          aria-label={`Xóa "${term}" khỏi lịch sử`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hasQuery && !hasAnyMatches ? (
                <div className="py-8 px-4 text-center text-[#a3aed0]">
                  <Search className="w-6 h-6 mx-auto mb-2 text-[#f47b64]/50" />
                  <p className="text-xs font-bold text-[#f7f5f0]">
                    Không tìm thấy gợi ý cho “{searchQuery}”
                  </p>
                  <p className="text-[11px] text-[#8d99be] mt-1">
                    Thử nhập tên bài hát khác hoặc tên ca sĩ (có dấu hoặc không dấu).
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {/* Artists Suggestions */}
                  {suggestions.artists.length > 0 && (
                    <div>
                      <p className="px-2.5 py-1 text-[11px] font-bold text-[#a3aed0]">
                        {hasQuery ? 'Nghệ sĩ phù hợp' : 'Nghệ sĩ gợi ý'}
                      </p>
                      <div className="space-y-0.5">
                        {suggestions.artists.map(artist => {
                          itemCursor += 1;
                          const isHighlighted = itemCursor === highlightedIndex;
                          return (
                            <button
                              key={artist.id}
                              type="button"
                              onClick={() =>
                                activateSuggestion({ kind: 'artist', artist })
                              }
                              className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl text-left transition-colors min-h-[48px] ${
                                isHighlighted
                                  ? 'bg-[#1e2b5c] text-[#f7f5f0]'
                                  : 'hover:bg-[#17224b] text-[#f7f5f0]'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <ArtistAvatar
                                  artist={artist}
                                  sizeClass="w-10 h-10"
                                  textSizeClass="text-xs"
                                />
                                <div className="min-w-0">
                                  <p className="text-xs sm:text-sm font-bold truncate">
                                    {renderHighlight(artist.name, searchQuery)}
                                  </p>
                                  <p className="text-[11px] text-[#a3aed0] truncate tabular-nums">
                                    Nghệ sĩ · {artist.trackCount} bài hát
                                  </p>
                                </div>
                              </div>
                              <ArrowUpRight className="w-4 h-4 text-[#8d99be] shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Track Suggestions */}
                  {suggestions.tracks.length > 0 && (
                    <div>
                      <p className="px-2.5 py-1 text-[11px] font-bold text-[#a3aed0]">
                        {hasQuery ? 'Bài hát gợi ý' : 'Nghe nhanh'}
                      </p>
                      <div className="space-y-0.5">
                        {suggestions.tracks.map(track => {
                          itemCursor += 1;
                          const isHighlighted = itemCursor === highlightedIndex;
                          const isCurrent = currentTrack?.id === track.id;

                          return (
                            <button
                              key={track.id}
                              type="button"
                              onClick={() =>
                                activateSuggestion({ kind: 'track', track })
                              }
                              className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl text-left transition-colors min-h-[48px] group ${
                                isHighlighted
                                  ? 'bg-[#1e2b5c]'
                                  : 'hover:bg-[#17224b]'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-[#162047] shrink-0">
                                  <img
                                    src={track.coverUrl}
                                    alt={track.title}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-[#070b1a]/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Play className="w-4 h-4 fill-[#f7f5f0] text-[#f7f5f0]" />
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`text-xs sm:text-sm font-semibold truncate ${
                                      isCurrent ? 'text-[#f47b64]' : 'text-[#f7f5f0]'
                                    }`}
                                  >
                                    {renderHighlight(track.title, searchQuery)}
                                  </p>
                                  <p className="text-[11px] text-[#a3aed0] truncate">
                                    {renderHighlight(track.artist, searchQuery)}
                                  </p>
                                </div>
                              </div>

                              <span className="text-[11px] text-[#8d99be] font-mono tabular-nums shrink-0">
                                {formatDuration(track.duration)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Genre Suggestions */}
                  {suggestions.genres.length > 0 && (
                    <div>
                      <p className="px-2.5 py-1 text-[11px] font-bold text-[#a3aed0]">
                        Thể loại
                      </p>
                      <div className="space-y-0.5">
                        {suggestions.genres.map(genre => {
                          itemCursor += 1;
                          const isHighlighted = itemCursor === highlightedIndex;
                          return (
                            <button
                              key={genre}
                              type="button"
                              onClick={() =>
                                activateSuggestion({ kind: 'genre', genre })
                              }
                              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs font-semibold transition-colors min-h-[44px] ${
                                isHighlighted
                                  ? 'bg-[#1e2b5c] text-[#f7f5f0]'
                                  : 'hover:bg-[#17224b] text-[#f7f5f0]'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <Disc3 className="w-4 h-4 text-[#f47b64]" />
                                <span>Khám phá thể loại {genre}</span>
                              </div>
                              <ArrowUpRight className="w-4 h-4 text-[#8d99be]" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Full Search Action */}
                  {hasQuery && (
                    <div className="pt-1 border-t border-[#1e2a54]">
                      <button
                        type="button"
                        onClick={() => {
                          recordSearch(searchQuery);
                          onNavigateToExplore();
                          setIsSearchOpen(false);
                        }}
                        className="w-full min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#162047]/80 hover:bg-[#1e2b5c] text-xs font-bold text-[#f47b64] transition-colors"
                      >
                        <span className="truncate">
                          Xem tất cả kết quả cho “{searchQuery.trim()}”
                        </span>
                        <Search className="w-3.5 h-3.5 shrink-0 ml-2" />
                      </button>
                    </div>
                  )}
                </div>
              )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Desktop Right Actions */}
        <div className="hidden md:flex">
          {renderRightActions()}
        </div>
      </div>

      {/* Soundly Genre Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
        {genres.map(g => (
          <button
            key={g.id}
            onClick={() => setActiveGenre(g.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full active:scale-95 transition-all duration-150 whitespace-nowrap shrink-0 min-h-[32px] flex items-center ${
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
