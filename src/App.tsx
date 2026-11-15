/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { PlayerBar } from './components/PlayerBar';
import { HomeView } from './components/HomeView';
import { ExploreView } from './components/ExploreView';
import { ArtistsView } from './components/ArtistsView';
import { ArtistDetailView } from './components/ArtistDetailView';
import { PlaylistDetailView } from './components/PlaylistDetailView';
import { LikedSongsView } from './components/LikedSongsView';
import { HistoryView } from './components/HistoryView';
import { LyricsDrawer } from './components/LyricsDrawer';
import { QueueDrawer } from './components/QueueDrawer';
import { SleepTimerModal } from './components/SleepTimerModal';
import { VisualizerModal } from './components/VisualizerModal';
import { LoginGate } from './components/LoginGate';
import { AdminDashboardView } from './components/AdminDashboardView';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MobileNowPlayingModal } from './components/MobileNowPlayingModal';
import { CreateAlbumModal } from './components/CreateAlbumModal';
import { AddToAlbumModal } from './components/AddToAlbumModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { OfflineIndicator } from './components/OfflineIndicator';
import { musicApi } from './services/api';
import {
  Track,
  Playlist,
  GenreCategory,
  ArtistProfile,
  TrendingChartSnapshot,
} from './types/music';
import { INITIAL_PLAYLISTS, INITIAL_GENRES } from './data/mockTracks';
import {
  buildArtistDirectory,
  findArtistByNameOrId,
  matchesTrackSearch,
} from './utils/artistSync';
import { deduplicateTracksList } from './utils/trackDedupe';
import {
  MusicSpaceId,
  matchesGenreFilter,
} from './utils/musicSpaces';
import { MobileLoadingScreen } from './components/MobileLoadingScreen';

const MainContent: React.FC = () => {
  const { user, isAdmin, isLoading: isAuthLoading } = useAuth();
  const { userPlaylists } = usePlayer();

  const [currentView, setCurrentView] = useState<string>('home');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeGenre, setActiveGenre] = useState<string>('all');
  const [activeSpace, setActiveSpace] = useState<MusicSpaceId>('all');
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState<boolean>(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isMobileNowPlayingOpen, setIsMobileNowPlayingOpen] = useState<boolean>(false);

  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const touchEndXRef = useRef<number>(0);
  const touchEndYRef = useRef<number>(0);
  const touchIgnoredRef = useRef<boolean>(false);

  const isTouchInsideHorizontalScrollOrInput = (target: EventTarget | null, boundary: HTMLElement | null) => {
    let el = target as HTMLElement | null;
    while (el && el !== boundary) {
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.dataset?.noSwipe === 'true') {
        return true;
      }
      if (el.scrollWidth > el.clientWidth + 6) {
        const overflowX = window.getComputedStyle(el).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') {
          return true;
        }
      }
      el = el.parentElement;
    }
    return false;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) {
      touchIgnoredRef.current = true;
      return;
    }
    if (isTouchInsideHorizontalScrollOrInput(e.target, e.currentTarget)) {
      touchIgnoredRef.current = true;
      return;
    }
    touchIgnoredRef.current = false;
    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    touchEndXRef.current = touch.clientX;
    touchEndYRef.current = touch.clientY;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchIgnoredRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchEndXRef.current = touch.clientX;
    touchEndYRef.current = touch.clientY;
  };

  const handleTouchEnd = () => {
    if (touchIgnoredRef.current) {
      touchIgnoredRef.current = false;
      return;
    }

    const diffX = touchStartXRef.current - touchEndXRef.current;
    const diffY = touchStartYRef.current - touchEndYRef.current;
    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);

    // Strictly ignore vertical scrolling or diagonal scroll gestures
    if (absX < 72 || absY > 60 || absX < absY * 1.65) return;

    // Exact left-to-right order matching MobileBottomNav
    const tabs = ['home', 'artists', 'explore', ...(isAdmin ? ['admin'] : ['liked'])];

    if (currentView === 'artist-detail') {
      if (diffX < 0) {
        // Swiped right -> go back to Artists list
        setCurrentView('artists');
        setSelectedArtistId(null);
      } else {
        // Swiped left -> advance to Explore
        setCurrentView('explore');
        setSelectedArtistId(null);
      }
      return;
    }

    if (currentView === 'playlist' && diffX < 0) {
      setCurrentView('home');
      setSelectedPlaylistId(null);
      return;
    }

    if (currentView === 'history' && diffX < 0) {
      setCurrentView('liked');
      return;
    }

    const currentIndex = tabs.indexOf(currentView);
    if (currentIndex === -1) return;

    if (diffX > 0) {
      // Swiped left -> next sequential tab
      if (currentIndex < tabs.length - 1) {
        setCurrentView(tabs[currentIndex + 1]);
        setSelectedPlaylistId(null);
        setSelectedArtistId(null);
      }
    } else {
      // Swiped right -> prev sequential tab
      if (currentIndex > 0) {
        setCurrentView(tabs[currentIndex - 1]);
        setSelectedPlaylistId(null);
        setSelectedArtistId(null);
      }
    }
  };

  // Full synchronized catalog state (hydrate synchronously from cache so mobile renders immediately when cached)
  const initialCachedTracks = useMemo(() => musicApi.getInitialCachedTracks(), []);
  const initialCachedPublicAlbums = useMemo(
    () => musicApi.getInitialCachedPublicAlbums(),
    []
  );
  const initialCachedCharts = useMemo(
    () => musicApi.getInitialCachedTrendingCharts(),
    []
  );
  const [allTracks, setAllTracks] = useState<Track[]>(initialCachedTracks);
  const [publicAlbums, setPublicAlbums] = useState<Playlist[]>(initialCachedPublicAlbums);
  const [trendingCharts, setTrendingCharts] = useState<{
    vn: TrendingChartSnapshot | null;
    global: TrendingChartSnapshot | null;
  }>(initialCachedCharts);
  const [isChartsLoading, setIsChartsLoading] = useState<boolean>(
    !initialCachedCharts.vn && !initialCachedCharts.global
  );
  const [playlists] = useState<Playlist[]>(INITIAL_PLAYLISTS);
  const [genres] = useState<GenreCategory[]>(INITIAL_GENRES);
  const [isCatalogSyncing, setIsCatalogSyncing] = useState<boolean>(
    initialCachedTracks.length === 0
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch complete music catalog on sign-in (progressive background sync + clean mobile loading state)
  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const safetyTimer = window.setTimeout(() => {
      if (isMounted) setIsCatalogSyncing(false);
    }, 6500);

    async function loadData() {
      let resolvedTracks: Track[] = initialCachedTracks;
      try {
        const fetchedTracks = await musicApi.getTracks();
        if (isMounted && fetchedTracks && fetchedTracks.length > 0) {
          resolvedTracks = fetchedTracks;
          setAllTracks(fetchedTracks);
          setIsCatalogSyncing(false);
        }
      } catch (err) {
        console.warn('Could not fetch from backend API, using initial catalog:', err);
        if (isMounted) setIsCatalogSyncing(false);
      }

      try {
        const [albumsRes, chartsRes] = await Promise.allSettled([
          musicApi.getPublicAlbums(),
          musicApi.getTrendingCharts({
            catalogTracks: resolvedTracks,
            isAdmin,
          }),
        ]);
        if (isMounted && albumsRes.status === 'fulfilled') {
          setPublicAlbums(albumsRes.value);
        }
        if (isMounted && chartsRes.status === 'fulfilled') {
          setTrendingCharts(chartsRes.value);
        }
      } finally {
        if (isMounted) setIsChartsLoading(false);
      }
    }

    loadData();

    const handleCatalogRefreshed = (e: Event) => {
      const detail = (e as CustomEvent<{ tracks?: Track[] }>).detail;
      if (isMounted && detail?.tracks && detail.tracks.length > 0) {
        setAllTracks(detail.tracks);
        setIsCatalogSyncing(false);
      }
    };

    const handlePublicAlbumsRefreshed = (e: Event) => {
      const detail = (e as CustomEvent<{ albums?: Playlist[] }>).detail;
      if (isMounted && Array.isArray(detail?.albums)) {
        setPublicAlbums(detail.albums);
      }
    };

    const handleChartsRefreshed = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          charts?: { vn: TrendingChartSnapshot | null; global: TrendingChartSnapshot | null };
        }>
      ).detail;
      if (isMounted && detail?.charts) {
        setTrendingCharts(detail.charts);
        setIsChartsLoading(false);
      }
    };

    const handleSyncFinished = () => {
      if (isMounted) setIsCatalogSyncing(false);
    };

    window.addEventListener('soundly:catalog-refreshed', handleCatalogRefreshed);
    window.addEventListener('soundly:public-albums-refreshed', handlePublicAlbumsRefreshed);
    window.addEventListener('soundly:charts-refreshed', handleChartsRefreshed);
    window.addEventListener('soundly:catalog-sync-finished', handleSyncFinished);

    return () => {
      isMounted = false;
      window.clearTimeout(safetyTimer);
      window.removeEventListener('soundly:catalog-refreshed', handleCatalogRefreshed);
      window.removeEventListener('soundly:public-albums-refreshed', handlePublicAlbumsRefreshed);
      window.removeEventListener('soundly:charts-refreshed', handleChartsRefreshed);
      window.removeEventListener('soundly:catalog-sync-finished', handleSyncFinished);
    };
  }, [user, isAdmin]);

  // Real-time play count synchronization for Top 50 & Artist play metrics
  useEffect(() => {
    const handleTrackPlayed = (e: Event) => {
      const detail = (e as CustomEvent<{ trackId?: string }>).detail;
      const trackId = detail?.trackId;
      if (!trackId) return;
      setAllTracks((prev) =>
        prev.map((t) =>
          t.id === trackId ? { ...t, plays: Math.max(0, Number(t.plays) || 0) + 1 } : t
        )
      );
    };

    const handlePlaysSynced = (e: Event) => {
      const detail = (e as CustomEvent<{ trackId?: string; plays?: number }>).detail;
      const trackId = detail?.trackId;
      const plays = detail?.plays;
      if (!trackId || typeof plays !== 'number') return;
      setAllTracks((prev) =>
        prev.map((t) =>
          t.id === trackId ? { ...t, plays: Math.max(Number(t.plays) || 0, plays) } : t
        )
      );
    };

    window.addEventListener('soundly:track-played', handleTrackPlayed);
    window.addEventListener('soundly:track-plays-synced', handlePlaysSynced);
    return () => {
      window.removeEventListener('soundly:track-played', handleTrackPlayed);
      window.removeEventListener('soundly:track-plays-synced', handlePlaysSynced);
    };
  }, []);

  const viewKey = `${currentView}:${selectedPlaylistId || ''}:${selectedArtistId || ''}`;

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [viewKey]);

  // Real-time synchronized Artist Directory (splits multi-artist strings & updates live)
  const artists = useMemo(() => buildArtistDirectory(allTracks), [allTracks]);

  // Instant accent-insensitive & genre filtered tracks for Home / Explore
  const filteredTracks = useMemo(() => {
    let results = allTracks;
    if (activeGenre && activeGenre !== 'all') {
      results = results.filter((t) => matchesGenreFilter(t, activeGenre));
    }
    if (searchQuery.trim()) {
      results = results.filter((t) => matchesTrackSearch(t, searchQuery));
    }
    return results;
  }, [allTracks, activeGenre, searchQuery]);

  // Live selected artist (stays in sync when catalog updates)
  const selectedArtist = useMemo(() => {
    if (!selectedArtistId) return null;
    return findArtistByNameOrId(artists, selectedArtistId);
  }, [selectedArtistId, artists]);

  // Resolve selected personal, catalog, or public search-only app album
  const selectedPlaylist = useMemo(() => {
    if (!selectedPlaylistId) return null;
    return (
      userPlaylists.find((p) => p.id === selectedPlaylistId) ||
      publicAlbums.find((p) => p.id === selectedPlaylistId) ||
      playlists.find((p) => p.id === selectedPlaylistId) ||
      null
    );
  }, [selectedPlaylistId, userPlaylists, publicAlbums, playlists]);

  const handleSelectArtist = (artist: ArtistProfile) => {
    setSelectedArtistId(artist.id);
    setSelectedPlaylistId(null);
    setCurrentView('artist-detail');
  };

  const handleSelectArtistByName = (artistName: string) => {
    const found = findArtistByNameOrId(artists, artistName);
    if (found) {
      handleSelectArtist(found);
    } else {
      setCurrentView('artists');
    }
  };

  // 1. Loading Authentication State Splash Screen
  if (isAuthLoading) {
    return <MobileLoadingScreen variant="splash" message="Đang kết nối Soundly..." />;
  }

  // 2. Authentication Gate: Must be logged in with Google Mail to enter the app
  if (!user) {
    return <LoginGate />;
  }

  const showInitialCatalogLoader =
    isCatalogSyncing &&
    allTracks.length === 0 &&
    (currentView === 'home' || currentView === 'explore' || currentView === 'artists');

  // 3. Authenticated App Experience
  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-[#070b1a] text-[#f7f5f0] font-sans">
      <OfflineIndicator />

      {/* SIDEBAR (Desktop Persistent & Mobile Drawer) */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        selectedPlaylistId={selectedPlaylistId}
        setSelectedPlaylistId={setSelectedPlaylistId}
        activeSpace={activeSpace}
        onSelectSpace={(space) => {
          setActiveSpace(space);
          setActiveGenre('all');
        }}
        isMobileOpen={isMobileDrawerOpen}
        onCloseMobile={() => setIsMobileDrawerOpen(false)}
      />

      {/* MAIN VIEWPORT (Soundly Deep Navy Rounded Container) */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative md:my-2 md:mr-2 md:rounded-xl bg-[#0d142c] border border-[#1e2a54]">
        {/* TOP HEADER */}
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          activeGenre={activeGenre}
          setActiveGenre={setActiveGenre}
          allTracks={allTracks}
          artists={artists}
          publicAlbums={publicAlbums}
          onSelectArtist={handleSelectArtist}
          onSelectPlaylist={(pl) => {
            setSelectedPlaylistId(pl.id);
            setCurrentView('playlist');
          }}
          onNavigateToExplore={() => setCurrentView('explore')}
          onOpenSleepTimer={() => setIsSleepTimerOpen(true)}
          onOpenMobileMenu={() => setIsMobileDrawerOpen(true)}
          onOpenAdmin={() => setCurrentView('admin')}
        />

        {/* SCROLLABLE VIEW CONTENT */}
        <div
          ref={scrollContainerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6 pb-36 md:pb-28 touch-pan-y soundly-scroll-viewport"
        >
          {showInitialCatalogLoader ? (
            <MobileLoadingScreen variant="catalog" message="Đang tải kho nhạc Soundly..." />
          ) : (
            <AnimatePresence initial={false}>
              <motion.div
                key={viewKey}
                initial={{ opacity: 0.72, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
              >
                {currentView === 'home' ? (
                  <HomeView
                    tracks={filteredTracks}
                    catalogTracks={allTracks}
                    playlists={playlists}
                    artists={artists}
                    activeSpace={activeSpace}
                    onChangeSpace={setActiveSpace}
                    trendingCharts={trendingCharts}
                    isChartsLoading={isChartsLoading}
                    onTrendingChartsUpdated={setTrendingCharts}
                    onSelectPlaylist={(pl) => {
                      setSelectedPlaylistId(pl.id);
                      setCurrentView('playlist');
                    }}
                    onSelectArtist={handleSelectArtist}
                    onSelectArtistByName={handleSelectArtistByName}
                    onOpenArtists={() => setCurrentView('artists')}
                    onExploreGenres={() => setCurrentView('explore')}
                  />
                ) : currentView === 'explore' ? (
                  <ExploreView
                    tracks={filteredTracks}
                    genres={genres}
                    artists={artists}
                    publicAlbums={publicAlbums}
                    searchQuery={searchQuery}
                    activeGenre={activeGenre}
                    setActiveGenre={setActiveGenre}
                    onSelectArtist={handleSelectArtist}
                    onSelectArtistByName={handleSelectArtistByName}
                    onSelectPlaylist={(pl) => {
                      setSelectedPlaylistId(pl.id);
                      setCurrentView('playlist');
                    }}
                    onOpenArtists={() => setCurrentView('artists')}
                  />
                ) : currentView === 'artists' ? (
                  <ArtistsView
                    artists={artists}
                    onSelectArtist={handleSelectArtist}
                  />
                ) : currentView === 'artist-detail' && selectedArtist ? (
                  <ArtistDetailView
                    artist={selectedArtist}
                    allArtists={artists}
                    onBackToArtists={() => setCurrentView('artists')}
                    onSelectArtist={handleSelectArtist}
                  />
                ) : currentView === 'playlist' && selectedPlaylist ? (
                  <PlaylistDetailView
                    playlist={selectedPlaylist}
                    allTracks={allTracks}
                    onBackToHome={() => {
                      setCurrentView('home');
                      setSelectedPlaylistId(null);
                    }}
                    onSelectArtist={handleSelectArtistByName}
                  />
                ) : currentView === 'liked' ? (
                  <LikedSongsView
                    allTracks={allTracks}
                    onSelectArtist={handleSelectArtistByName}
                  />
                ) : currentView === 'history' ? (
                  <HistoryView onSelectArtist={handleSelectArtistByName} />
                ) : currentView === 'admin' ? (
                  <AdminDashboardView
                    tracks={allTracks}
                    onTracksUpdated={setAllTracks}
                    publicAlbums={publicAlbums}
                    onPublicAlbumsUpdated={setPublicAlbums}
                    trendingCharts={trendingCharts}
                    onTrendingChartsUpdated={setTrendingCharts}
                  />
                ) : (
                  <HomeView
                    tracks={filteredTracks}
                    catalogTracks={allTracks}
                    playlists={playlists}
                    artists={artists}
                    activeSpace={activeSpace}
                    onChangeSpace={setActiveSpace}
                    trendingCharts={trendingCharts}
                    isChartsLoading={isChartsLoading}
                    onTrendingChartsUpdated={setTrendingCharts}
                    onSelectPlaylist={(pl) => {
                      setSelectedPlaylistId(pl.id);
                      setCurrentView('playlist');
                    }}
                    onSelectArtist={handleSelectArtist}
                    onSelectArtistByName={handleSelectArtistByName}
                    onOpenArtists={() => setCurrentView('artists')}
                    onExploreGenres={() => setCurrentView('explore')}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* DRAWERS & MODALS */}
      <LyricsDrawer />
      <QueueDrawer />
      <SleepTimerModal
        isOpen={isSleepTimerOpen}
        onClose={() => setIsSleepTimerOpen(false)}
      />
      <VisualizerModal />
      <CreateAlbumModal
        allTracks={allTracks}
        onTracksAdded={(newTracks) => {
          setAllTracks((prev) => deduplicateTracksList([...newTracks, ...prev]).deduped);
        }}
        onCreated={(newAlbum) => {
          setSelectedPlaylistId(newAlbum.id);
          setCurrentView('playlist');
        }}
      />
      <AddToAlbumModal />
      <ConfirmDialog />

      {/* FULLSCREEN NOW PLAYING MODAL */}
      <MobileNowPlayingModal
        isOpen={isMobileNowPlayingOpen}
        onClose={() => setIsMobileNowPlayingOpen(false)}
        onSelectArtistByName={handleSelectArtistByName}
      />

      {/* BOTTOM PLAYBACK BAR (Mobile Mini Player + Desktop Full Bar) */}
      <PlayerBar onOpenMobileNowPlaying={() => setIsMobileNowPlayingOpen(true)} />

      {/* MOBILE BOTTOM NAVIGATION TABS */}
      <MobileBottomNav
        currentView={currentView}
        setCurrentView={setCurrentView}
        onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
      />
    </div>
  );
};

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <PlayerProvider>
          <MainContent />
        </PlayerProvider>
      </AuthProvider>
    </MotionConfig>
  );
}
