/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
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
import { Track, Playlist, GenreCategory, ArtistProfile } from './types/music';
import { INITIAL_TRACKS, INITIAL_PLAYLISTS, INITIAL_GENRES } from './data/mockTracks';
import {
  buildArtistDirectory,
  findArtistByNameOrId,
  matchesTrackSearch,
} from './utils/artistSync';
import { Loader2 } from 'lucide-react';

const MainContent: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { userPlaylists } = usePlayer();

  const [currentView, setCurrentView] = useState<string>('home');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeGenre, setActiveGenre] = useState<string>('all');
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState<boolean>(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isMobileNowPlayingOpen, setIsMobileNowPlayingOpen] = useState<boolean>(false);

  // Full synchronized catalog state
  const [allTracks, setAllTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [playlists, setPlaylists] = useState<Playlist[]>(INITIAL_PLAYLISTS);
  const [genres, setGenres] = useState<GenreCategory[]>(INITIAL_GENRES);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch complete music catalog on sign-in
  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    async function loadData() {
      try {
        const [fetchedTracks, fetchedPlaylists, fetchedGenres] = await Promise.all([
          musicApi.getTracks(),
          musicApi.getPlaylists(),
          musicApi.getGenres(),
        ]);

        if (isMounted) {
          setAllTracks(fetchedTracks || []);
          setPlaylists(fetchedPlaylists || []);
          if (fetchedGenres && fetchedGenres.length > 0) setGenres(fetchedGenres);
        }
      } catch (err) {
        console.warn('Could not fetch from backend API, using initial catalog:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Real-time synchronized Artist Directory (splits multi-artist strings & updates live)
  const artists = useMemo(() => buildArtistDirectory(allTracks), [allTracks]);

  // Instant accent-insensitive & genre filtered tracks for Home / Explore
  const filteredTracks = useMemo(() => {
    let results = allTracks;
    if (activeGenre && activeGenre !== 'all') {
      results = results.filter(
        (t) => t.genre.toLowerCase() === activeGenre.toLowerCase()
      );
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

  // Merge custom user albums with catalog playlists so created albums open reliably
  const selectedPlaylist = useMemo(() => {
    if (!selectedPlaylistId) return null;
    return (
      userPlaylists.find((p) => p.id === selectedPlaylistId) ||
      playlists.find((p) => p.id === selectedPlaylistId) ||
      null
    );
  }, [selectedPlaylistId, userPlaylists, playlists]);

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
    return (
      <div className="h-screen w-screen bg-[#070b1a] flex flex-col items-center justify-center text-[#f7f5f0] select-none">
        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[#f7f5f0] mb-4 shadow-2xl shadow-[#f47b64]/20 ring-2 ring-[#f47b64]/40">
          <img
            src="/assets/aistudio/Logo_Soundly_b8420ae4.svg"
            alt="Soundly Logo"
            className="w-full h-full object-cover"
          />
        </div>
        <p className="text-sm font-bold text-[#a3aed0] tracking-wide">Đang kết nối Soundly...</p>
      </div>
    );
  }

  // 2. Authentication Gate: Must be logged in with Google Mail to enter the app
  if (!user) {
    return <LoginGate />;
  }

  // 3. Authenticated App Experience
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070b1a] text-[#f7f5f0] font-sans">
      <OfflineIndicator />

      {/* SIDEBAR (Desktop Persistent & Mobile Drawer) */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        selectedPlaylistId={selectedPlaylistId}
        setSelectedPlaylistId={setSelectedPlaylistId}
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
          onSelectArtist={handleSelectArtist}
          onNavigateToExplore={() => setCurrentView('explore')}
          onOpenSleepTimer={() => setIsSleepTimerOpen(true)}
          onOpenMobileMenu={() => setIsMobileDrawerOpen(true)}
          onOpenAdmin={() => setCurrentView('admin')}
        />

        {/* SCROLLABLE VIEW CONTENT */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6 pb-36 md:pb-28">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-[#f47b64] gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm font-semibold">Đang nạp kho nhạc Soundly...</span>
            </div>
          ) : currentView === 'home' ? (
            <HomeView
              tracks={filteredTracks}
              playlists={playlists}
              artists={artists}
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
              searchQuery={searchQuery}
              activeGenre={activeGenre}
              setActiveGenre={setActiveGenre}
              onSelectArtist={handleSelectArtist}
              onSelectArtistByName={handleSelectArtistByName}
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
            <AdminDashboardView tracks={allTracks} onTracksUpdated={setAllTracks} />
          ) : (
            <HomeView
              tracks={filteredTracks}
              playlists={playlists}
              artists={artists}
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
        onCreated={(newAlbum) => {
          setSelectedPlaylistId(newAlbum.id);
          setCurrentView('playlist');
        }}
      />
      <AddToAlbumModal />
      <ConfirmDialog />

      {/* FULLSCREEN NOW PLAYING MODAL ON MOBILE */}
      <MobileNowPlayingModal
        isOpen={isMobileNowPlayingOpen}
        onClose={() => setIsMobileNowPlayingOpen(false)}
        onOpenSleepTimer={() => setIsSleepTimerOpen(true)}
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
    <AuthProvider>
      <PlayerProvider>
        <MainContent />
      </PlayerProvider>
    </AuthProvider>
  );
}
