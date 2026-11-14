import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Track, Playlist, RepeatMode } from '../types/music';
import { INITIAL_PLAYLISTS } from '../data/mockTracks';
import { useAuth } from './AuthContext';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { musicApi } from '../services/api';
import { isUsUkTrack, isKPopTrack, MusicSpaceId } from '../utils/musicSpaces';

export const DEFAULT_CUSTOM_ALBUM_COVER = '/assets/aistudio/soundly-default-cover.svg';

export interface ConfirmDialogOptions {
  title: string;
  description: string;
  highlight?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void | Promise<void>;
}

interface PlayerContextType {
  // Current playback
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  playbackRate: number;
  audioError: string | null;

  // Actions
  playTrack: (track: Track, newQueue?: Track[]) => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  setVolume: (val: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  setPlaybackRate: (rate: number) => void;
  playNext: () => void;
  playPrevious: () => void;

  // Queue
  queue: Track[];
  queueIndex: number;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;

  // Favorites & Custom Albums / Playlists
  likedTrackIds: string[];
  toggleLike: (trackId: string) => void;
  isLiked: (trackId: string) => boolean;
  userPlaylists: Playlist[];
  createPlaylist: (
    title: string,
    description?: string,
    initialTrack?: Track,
    options?: {
      trackIds?: string[];
      coverUrl?: string;
    }
  ) => Playlist;
  addTrackToPlaylist: (playlistId: string, trackId: string, trackCoverUrl?: string) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  toggleTrackInPlaylist: (playlistId: string, track: Track) => boolean;
  deletePlaylist: (playlistId: string) => void;

  // Album & Confirm modals state
  albumPickerTrack: Track | null;
  openAlbumPicker: (track: Track) => void;
  closeAlbumPicker: () => void;
  isCreateAlbumModalOpen: boolean;
  setIsCreateAlbumModalOpen: (open: boolean) => void;
  createAlbumModalInitialMode: 'manual' | 'spotify';
  openCreateAlbumModal: (mode?: 'manual' | 'spotify') => void;
  confirmDialog: ConfirmDialogOptions | null;
  openConfirmDialog: (options: ConfirmDialogOptions) => void;
  closeConfirmDialog: () => void;

  // History
  recentHistory: Track[];

  // Sleep timer
  sleepTimerRemaining: number | null; // seconds remaining
  setSleepTimer: (minutes: number | null) => void;

  // Drawers & Modals
  isLyricsOpen: boolean;
  setIsLyricsOpen: (open: boolean) => void;
  isQueueOpen: boolean;
  setIsQueueOpen: (open: boolean) => void;
  isVisualizerOpen: boolean;
  setIsVisualizerOpen: (open: boolean) => void;
  isAddTrackModalOpen: boolean;
  setIsAddTrackModalOpen: (open: boolean) => void;

  // Visualizer Frequency Data (0-255 array for canvas/bars)
  getAudioFrequencyData: () => Uint8Array | null;
  playRandomShuffle: (allTracks: Track[]) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

function getPlaylistsStorageKey(uid?: string | null): string {
  return uid ? `nordic_playlists_${uid}` : 'nordic_playlists';
}

function sanitizePlaylistId(rawId: string): string {
  const cleaned = String(rawId || `album-${Date.now()}`)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  return cleaned || `album-${Date.now()}`;
}

function loadLocalPlaylists(uid?: string | null): Playlist[] {
  try {
    const specific = uid ? localStorage.getItem(getPlaylistsStorageKey(uid)) : null;
    const legacy = localStorage.getItem('nordic_playlists');
    const saved = specific || legacy;
    if (!saved) return INITIAL_PLAYLISTS;
    const parsed = JSON.parse(saved) as Playlist[];
    const oldPlaylistIds = new Set([
      'playlist-nordic-chill',
      'playlist-morning-fika',
      'playlist-focus-study',
    ]);
    return Array.isArray(parsed)
      ? parsed.filter((pl) => pl && pl.id && !oldPlaylistIds.has(pl.id))
      : INITIAL_PLAYLISTS;
  } catch {
    return INITIAL_PLAYLISTS;
  }
}

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamFallbackTriedRef = useRef<boolean>(false);
  const lastRecordedPlayRef = useRef<{ id: string; at: number }>({ id: '', at: 0 });
  const handleTrackEndRef = useRef<() => void>(() => {});
  const shufflePlayedIndicesRef = useRef<Set<number>>(new Set());

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(() => {
    const saved = localStorage.getItem('nordic_volume');
    return saved ? parseFloat(saved) : 0.8;
  });
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [playbackRate, setPlaybackRateState] = useState<number>(1);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Queue state
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(0);

  // History
  const [recentHistory, setRecentHistory] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem('nordic_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Liked Tracks
  const [likedTrackIds, setLikedTrackIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nordic_liked_tracks');
      if (!saved) return [];
      const parsed = JSON.parse(saved) as string[];
      const oldIds = new Set(['track-1', 'track-2', 'track-3', 'track-4', 'track-5', 'track-6', 'track-7', 'track-8']);
      return parsed.filter((id) => !oldIds.has(id));
    } catch {
      return [];
    }
  });

  // Custom Albums / Playlists
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>(() =>
    loadLocalPlaylists(user?.uid)
  );

  // Album & Confirm Modals
  const [albumPickerTrack, setAlbumPickerTrack] = useState<Track | null>(null);
  const [isCreateAlbumModalOpen, setIsCreateAlbumModalOpen] = useState<boolean>(false);
  const [createAlbumModalInitialMode, setCreateAlbumModalInitialMode] = useState<'manual' | 'spotify'>('spotify');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);

  const openCreateAlbumModal = useCallback((mode: 'manual' | 'spotify' = 'spotify') => {
    setCreateAlbumModalInitialMode(mode);
    setIsCreateAlbumModalOpen(true);
  }, []);

  // Sleep Timer
  const [sleepTimerEndTime, setSleepTimerEndTime] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);

  // UI Drawers
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isVisualizerOpen, setIsVisualizerOpen] = useState(false);
  const [isAddTrackModalOpen, setIsAddTrackModalOpen] = useState(false);

  const persistPlaylistToFirestore = useCallback(
    async (uid: string, playlist: Playlist) => {
      const safeId = sanitizePlaylistId(playlist.id);
      const docPath = `users/${uid}/playlists/${safeId}`;
      try {
        await setDoc(
          doc(db, 'users', uid, 'playlists', safeId),
          {
            id: safeId,
            userId: uid,
            title: String(playlist.title || 'Album của tôi').slice(0, 200),
            description: String(playlist.description || '').slice(0, 500),
            coverUrl: String(playlist.coverUrl || DEFAULT_CUSTOM_ALBUM_COVER).slice(0, 2000),
            trackIds: Array.isArray(playlist.trackIds) ? playlist.trackIds.slice(0, 1000) : [],
            isCustom: true,
            createdAt: playlist.createdAt || new Date().toLocaleDateString('vi-VN'),
          },
          { merge: true }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
          try {
            handleFirestoreError(err, OperationType.WRITE, docPath);
          } catch (formattedErr) {
            console.warn(formattedErr);
          }
        } else {
          console.warn('Could not sync album to Firestore:', err);
        }
      }
    },
    []
  );

  const removePlaylistFromFirestore = useCallback(async (uid: string, playlistId: string) => {
    const safeId = sanitizePlaylistId(playlistId);
    const docPath = `users/${uid}/playlists/${safeId}`;
    try {
      await deleteDoc(doc(db, 'users', uid, 'playlists', safeId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
        try {
          handleFirestoreError(err, OperationType.DELETE, docPath);
        } catch (formattedErr) {
          console.warn(formattedErr);
        }
      } else {
        console.warn('Could not delete album from Firestore:', err);
      }
    }
  }, []);

  // Load & sync personal albums with Firestore when user signs in
  useEffect(() => {
    if (!user?.uid) {
      setUserPlaylists(loadLocalPlaylists(null));
      return;
    }

    const uid = user.uid;
    let isMounted = true;
    const localAlbums = loadLocalPlaylists(uid);
    setUserPlaylists(localAlbums);

    async function syncAlbumsFromFirestore() {
      const colPath = `users/${uid}/playlists`;
      try {
        const snap = await getDocs(collection(db, 'users', uid, 'playlists'));
        if (!isMounted) return;

        const remoteMap = new Map<string, Playlist>();
        snap.forEach((docSnap) => {
          const data = docSnap.data() as Partial<Playlist>;
          const id = sanitizePlaylistId(data.id || docSnap.id);
          remoteMap.set(id, {
            id,
            title: data.title || 'Album của tôi',
            description: data.description || 'Tuyển tập giai điệu của tôi',
            coverUrl: data.coverUrl || DEFAULT_CUSTOM_ALBUM_COVER,
            trackIds: Array.isArray(data.trackIds) ? Array.from(new Set(data.trackIds)) : [],
            isCustom: true,
            createdAt: data.createdAt || new Date().toLocaleDateString('vi-VN'),
          });
        });

        // Merge local-only custom albums up to Firestore
        const mergedMap = new Map<string, Playlist>(remoteMap);
        const localOnlyToPush: Playlist[] = [];

        for (const localPl of localAlbums) {
          const safeId = sanitizePlaylistId(localPl.id);
          if (!mergedMap.has(safeId)) {
            const normalized: Playlist = { ...localPl, id: safeId, isCustom: true };
            mergedMap.set(safeId, normalized);
            localOnlyToPush.push(normalized);
          }
        }

        const merged = Array.from(mergedMap.values());
        if (isMounted) {
          setUserPlaylists(merged);
          try {
            localStorage.setItem(getPlaylistsStorageKey(uid), JSON.stringify(merged));
            localStorage.setItem('nordic_playlists', JSON.stringify(merged));
          } catch {
            // ignore
          }
        }

        for (const pl of localOnlyToPush) {
          await persistPlaylistToFirestore(uid, pl);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
          try {
            handleFirestoreError(err, OperationType.LIST, colPath);
          } catch (formattedErr) {
            console.warn(formattedErr);
          }
        } else {
          console.warn('Could not load user albums from Firestore:', err);
        }
      }
    }

    syncAlbumsFromFirestore();

    return () => {
      isMounted = false;
    };
  }, [user?.uid, persistPlaylistToFirestore]);

  function extractR2TrackKeyFromUrl(rawUrl: string): string | null {
    if (!rawUrl) return null;
    if (rawUrl.startsWith('/api/r2/stream')) return null;
    try {
      const parsed = new URL(rawUrl, window.location.origin);
      if (parsed.pathname.includes('/api/r2/stream')) return null;
      const cleanPath = parsed.pathname.replace(/^\/+/, '');
      if (cleanPath.startsWith('tracks/')) return cleanPath;
      const idx = cleanPath.indexOf('/tracks/');
      if (idx !== -1) return cleanPath.slice(idx + 1);
      return null;
    } catch {
      return null;
    }
  }

  // Initialize HTML5 Audio Element (without crossOrigin='anonymous' so R2/CDN MP3s without GET CORS play cleanly)
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setAudioError(null);
    };

    const handleEnded = () => {
      handleTrackEndRef.current();
    };

    const handleError = () => {
      const currentSrc = audio.currentSrc || audio.src || '';
      const r2Key = extractR2TrackKeyFromUrl(currentSrc);
      if (r2Key && !streamFallbackTriedRef.current) {
        streamFallbackTriedRef.current = true;
        const fallbackSrc = `/api/r2/stream?key=${encodeURIComponent(r2Key)}`;
        console.warn('Direct audio URL failed, retrying via R2 stream proxy:', currentSrc);
        audio.src = fallbackSrc;
        audio.load();
        audio
          .play()
          .then(() => {
            setIsPlaying(true);
            setAudioError(null);
          })
          .catch(() => {
            setAudioError('Không thể phát tệp âm thanh từ Cloudflare R2.');
            setIsPlaying(false);
          });
        return;
      }

      console.warn('Audio playback error on url:', currentSrc);
      if (currentSrc.startsWith('blob:')) {
        setAudioError('File tạm trình duyệt đã hết hạn. Vui lòng cấu hình Cloudflare R2 và tải lên lại.');
      } else if (
        currentSrc.includes('/api/download/file/') ||
        currentSrc.includes('onrender.com')
      ) {
        setAudioError('Link MP3 tạm từ SpotFlow đã hết hạn (404) và chưa được lưu lên Cloudflare R2.');
      } else {
        setAudioError('Không thể nạp tệp âm thanh. Vui lòng kiểm tra kết nối hoặc file trên R2.');
      }
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const getAudioFrequencyData = useCallback((): Uint8Array | null => {
    return null;
  }, []);

  // Sync volume with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
      localStorage.setItem('nordic_volume', volume.toString());
    }
  }, [volume, isMuted]);

  // Sync playbackRate
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Save liked tracks
  useEffect(() => {
    localStorage.setItem('nordic_liked_tracks', JSON.stringify(likedTrackIds));
  }, [likedTrackIds]);

  // Save playlists to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('nordic_playlists', JSON.stringify(userPlaylists));
      if (user?.uid) {
        localStorage.setItem(getPlaylistsStorageKey(user.uid), JSON.stringify(userPlaylists));
      }
    } catch {
      // ignore storage quota errors
    }
  }, [userPlaylists, user?.uid]);

  // Save history
  useEffect(() => {
    localStorage.setItem('nordic_history', JSON.stringify(recentHistory.slice(0, 30)));
  }, [recentHistory]);

  // Sleep Timer countdown handler
  useEffect(() => {
    if (!sleepTimerEndTime) {
      setSleepTimerRemaining(null);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((sleepTimerEndTime - now) / 1000));
      setSleepTimerRemaining(diff);

      if (diff <= 0) {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
        setSleepTimerEndTime(null);
        setSleepTimerRemaining(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerEndTime]);

  const setSleepTimer = (minutes: number | null) => {
    if (minutes === null) {
      setSleepTimerEndTime(null);
      setSleepTimerRemaining(null);
    } else {
      setSleepTimerEndTime(Date.now() + minutes * 60 * 1000);
      setSleepTimerRemaining(minutes * 60);
    }
  };

  // Play a specific track
  const playTrack = useCallback((track: Track, newQueue?: Track[]) => {
    if (!audioRef.current) return;

    setCurrentTrack(track);
    setAudioError(null);
    setCurrentTime(0);
    setDuration(track.duration || 0);
    streamFallbackTriedRef.current = false;

    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
      const idx = newQueue.findIndex((t) => t.id === track.id);
      const safeIdx = idx !== -1 ? idx : 0;
      setQueueIndex(safeIdx);
      shufflePlayedIndicesRef.current.clear();
      shufflePlayedIndicesRef.current.add(safeIdx);
    } else {
      setQueue((prev) => {
        if (prev.length === 0) {
          shufflePlayedIndicesRef.current.clear();
          shufflePlayedIndicesRef.current.add(0);
          return [track];
        }
        const idx = prev.findIndex((t) => t.id === track.id);
        if (idx !== -1) {
          setQueueIndex(idx);
          shufflePlayedIndicesRef.current.add(idx);
          return prev;
        }
        const updated = [track, ...prev];
        setQueueIndex(0);
        shufflePlayedIndicesRef.current.add(0);
        return updated;
      });
    }

    let playableUrl = (track.audioUrl || '').trim();
    if (!playableUrl) {
      setAudioError('Bài hát này chưa có đường dẫn âm thanh hợp lệ.');
      setIsPlaying(false);
      return;
    }

    if (playableUrl.includes('.r2.cloudflarestorage.com/')) {
      const r2Key = extractR2TrackKeyFromUrl(playableUrl);
      if (r2Key) {
        playableUrl = `/api/r2/stream?key=${encodeURIComponent(r2Key)}`;
        streamFallbackTriedRef.current = true;
      }
    }

    const audio = audioRef.current;
    const resolvedTarget = new URL(playableUrl, window.location.href).href;
    if (audio.src === resolvedTarget) {
      if (audio.error) {
        audio.load();
      } else {
        audio.currentTime = 0;
      }
    } else {
      audio.src = playableUrl;
    }

    audio
      .play()
      .then(() => {
        setIsPlaying(true);
        setAudioError(null);
      })
      .catch((err: unknown) => {
        const errName = err instanceof Error ? err.name : '';
        console.warn('Audio play request interrupted:', err);
        setIsPlaying(false);
        if (errName === 'NotAllowedError') {
          setAudioError('Trình duyệt chặn phát tự động. Vui lòng chạm lại nút Phát.');
        } else if (errName === 'NotSupportedError') {
          if (
            playableUrl.includes('/api/download/file/') ||
            playableUrl.includes('onrender.com')
          ) {
            setAudioError('Link MP3 tạm từ SpotFlow đã hết hạn (404) và chưa được lưu lên Cloudflare R2.');
          } else {
            setAudioError('Định dạng âm thanh không được trình duyệt hỗ trợ hoặc file không tồn tại.');
          }
        }
      });

    setRecentHistory((prev) => {
      const filtered = prev.filter((t) => t.id !== track.id);
      return [track, ...filtered];
    });

    if (typeof window !== 'undefined') {
      const now = Date.now();
      const prev = lastRecordedPlayRef.current;
      if (prev.id !== track.id || now - prev.at > 4000) {
        lastRecordedPlayRef.current = { id: track.id, at: now };
        window.dispatchEvent(
          new CustomEvent('soundly:track-played', {
            detail: { trackId: track.id },
          })
        );
        void musicApi
          .recordTrackPlay(track.id, Number(track.plays) || 0)
          .then((plays) => {
            window.dispatchEvent(
              new CustomEvent('soundly:track-plays-synced', {
                detail: { trackId: track.id, plays },
              })
            );
          });
      }
    }
  }, []);

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setAudioError(null);
        })
        .catch((err) => {
          console.warn('Play error:', err);
          setAudioError('Trình duyệt không thể phát âm thanh. Nhấn lại hoặc kiểm tra tệp nhạc.');
        });
    }
  };

  const seek = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seconds;
    setCurrentTime(seconds);
  };

  const setVolume = (val: number) => {
    setVolumeState(val);
    if (val > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const toggleShuffle = () => {
    setIsShuffle((prev) => {
      const next = !prev;
      if (next) {
        shufflePlayedIndicesRef.current.clear();
        shufflePlayedIndicesRef.current.add(queueIndex);
      }
      return next;
    });
  };

  const cycleRepeatMode = () => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  const setPlaybackRate = (rate: number) => {
    setPlaybackRateState(rate);
  };

  const playNext = useCallback(() => {
    if (queue.length === 0) return;

    if (isShuffle) {
      shufflePlayedIndicesRef.current.add(queueIndex);
      let unplayedIndices = queue.map((_, i) => i).filter((i) => !shufflePlayedIndicesRef.current.has(i));
      if (unplayedIndices.length === 0) {
        shufflePlayedIndicesRef.current.clear();
        shufflePlayedIndicesRef.current.add(queueIndex);
        unplayedIndices = queue.map((_, i) => i).filter((i) => !shufflePlayedIndicesRef.current.has(i));
      }
      const nextIdx =
        unplayedIndices.length > 0
          ? unplayedIndices[Math.floor(Math.random() * unplayedIndices.length)]
          : (queueIndex + 1) % queue.length;
      shufflePlayedIndicesRef.current.add(nextIdx);
      setQueueIndex(nextIdx);
      playTrack(queue[nextIdx], queue);
      return;
    }

    let nextIndex = queueIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }
    setQueueIndex(nextIndex);
    playTrack(queue[nextIndex], queue);
  }, [queue, queueIndex, isShuffle, repeatMode, playTrack]);

  const playPrevious = useCallback(() => {
    if (!audioRef.current || queue.length === 0) return;

    if (audioRef.current.currentTime > 3) {
      seek(0);
      return;
    }

    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }
    setQueueIndex(prevIndex);
    playTrack(queue[prevIndex], queue);
  }, [queue, queueIndex, playTrack]);

  const playRandomShuffle = useCallback((allTracks: Track[]) => {
    if (!allTracks || allTracks.length === 0) return;
    setIsShuffle(true);
    const isPlayingAnyOfThese = currentTrack && allTracks.some(t => t.id === currentTrack.id);
    if (!isPlayingAnyOfThese) {
      const randomIdx = Math.floor(Math.random() * allTracks.length);
      playTrack(allTracks[randomIdx], allTracks);
    }
  }, [currentTrack, playTrack]);

  // Media Session API for Lock Screen & Notification Center controls
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || 'Soundly Track',
        artist: currentTrack.artist || 'Nghệ sĩ chưa rõ',
        album: currentTrack.album || 'Soundly Music',
        artwork: [
          { src: currentTrack.coverUrl || DEFAULT_CUSTOM_ALBUM_COVER, sizes: '96x96', type: 'image/jpeg' },
          { src: currentTrack.coverUrl || DEFAULT_CUSTOM_ALBUM_COVER, sizes: '128x128', type: 'image/jpeg' },
          { src: currentTrack.coverUrl || DEFAULT_CUSTOM_ALBUM_COVER, sizes: '192x192', type: 'image/jpeg' },
          { src: currentTrack.coverUrl || DEFAULT_CUSTOM_ALBUM_COVER, sizes: '256x256', type: 'image/jpeg' },
          { src: currentTrack.coverUrl || DEFAULT_CUSTOM_ALBUM_COVER, sizes: '384x384', type: 'image/jpeg' },
          { src: currentTrack.coverUrl || DEFAULT_CUSTOM_ALBUM_COVER, sizes: '512x512', type: 'image/jpeg' },
        ],
      });

      navigator.mediaSession.setActionHandler('play', () => {
        if (audioRef.current) {
          audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        }
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious());
      navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && audioRef.current) {
          audioRef.current.currentTime = details.seekTime;
          setCurrentTime(details.seekTime);
        }
      });
    } catch (err) {
      console.warn('MediaSession API warning:', err);
    }
  }, [currentTrack, playNext, playPrevious]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      } catch {
        // ignore
      }
    }
  }, [isPlaying]);

  const handleTrackEnd = useCallback(() => {
    if (repeatMode === 'one' && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } else {
      playNext();
    }
  }, [repeatMode, playNext]);

  useEffect(() => {
    handleTrackEndRef.current = handleTrackEnd;
  }, [handleTrackEnd]);

  const addToQueue = (track: Track) => {
    setQueue((prev) => [...prev, track]);
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, idx) => idx !== index));
    if (index < queueIndex) {
      setQueueIndex((prev) => Math.max(0, prev - 1));
    }
  };

  const clearQueue = () => {
    if (currentTrack) {
      setQueue([currentTrack]);
      setQueueIndex(0);
    } else {
      setQueue([]);
      setQueueIndex(0);
    }
  };

  // Liked tracks
  const toggleLike = (trackId: string) => {
    setLikedTrackIds((prev) =>
      prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId]
    );
  };

  const isLiked = (trackId: string) => likedTrackIds.includes(trackId);

  // Custom albums / playlists
  const createPlaylist = (
    title: string,
    description?: string,
    initialTrack?: Track,
    options?: {
      trackIds?: string[];
      coverUrl?: string;
    }
  ): Playlist => {
    const resolvedTrackIds =
      Array.isArray(options?.trackIds) && options.trackIds.length > 0
        ? Array.from(new Set(options.trackIds))
        : initialTrack
          ? [initialTrack.id]
          : [];
    const newPl: Playlist = {
      id: sanitizePlaylistId(`album-${Date.now()}`),
      title: title.trim() || 'Album của tôi',
      description: description?.trim() || 'Album cá nhân trong thư viện Soundly',
      coverUrl:
        options?.coverUrl?.trim() ||
        initialTrack?.coverUrl ||
        DEFAULT_CUSTOM_ALBUM_COVER,
      trackIds: resolvedTrackIds,
      isCustom: true,
      createdAt: new Date().toLocaleDateString('vi-VN'),
    };
    setUserPlaylists((prev) => [newPl, ...prev]);
    if (user?.uid) {
      void persistPlaylistToFirestore(user.uid, newPl);
    }
    return newPl;
  };

  const addTrackToPlaylist = (playlistId: string, trackId: string, trackCoverUrl?: string) => {
    setUserPlaylists((prev) =>
      prev.map((p) => {
        if (p.id !== playlistId) return p;
        if (p.trackIds.includes(trackId)) return p;
        const shouldUseTrackCover =
          trackCoverUrl && (!p.coverUrl || p.coverUrl === DEFAULT_CUSTOM_ALBUM_COVER);
        const updated: Playlist = {
          ...p,
          coverUrl: shouldUseTrackCover ? trackCoverUrl : p.coverUrl,
          trackIds: [...p.trackIds, trackId],
        };
        if (user?.uid) {
          void persistPlaylistToFirestore(user.uid, updated);
        }
        return updated;
      })
    );
  };

  const removeTrackFromPlaylist = (playlistId: string, trackId: string) => {
    setUserPlaylists((prev) =>
      prev.map((p) => {
        if (p.id !== playlistId) return p;
        const updated: Playlist = {
          ...p,
          trackIds: p.trackIds.filter((id) => id !== trackId),
        };
        if (user?.uid) {
          void persistPlaylistToFirestore(user.uid, updated);
        }
        return updated;
      })
    );
  };

  const toggleTrackInPlaylist = (playlistId: string, track: Track): boolean => {
    const target = userPlaylists.find((p) => p.id === playlistId);
    const alreadyInAlbum = target?.trackIds.includes(track.id) ?? false;
    if (alreadyInAlbum) {
      removeTrackFromPlaylist(playlistId, track.id);
      return false;
    } else {
      addTrackToPlaylist(playlistId, track.id, track.coverUrl);
      return true;
    }
  };

  const deletePlaylist = (playlistId: string) => {
    setUserPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
    if (user?.uid) {
      void removePlaylistFromFirestore(user.uid, playlistId);
    }
  };

  const openAlbumPicker = (track: Track) => {
    setAlbumPickerTrack(track);
  };

  const closeAlbumPicker = () => {
    setAlbumPickerTrack(null);
  };

  const openConfirmDialog = (options: ConfirmDialogOptions) => {
    setConfirmDialog(options);
  };

  const closeConfirmDialog = () => {
    setConfirmDialog(null);
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        isShuffle,
        repeatMode,
        playbackRate,
        audioError,
        playTrack,
        togglePlay,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        cycleRepeatMode,
        setPlaybackRate,
        playNext,
        playPrevious,
        queue,
        queueIndex,
        addToQueue,
        removeFromQueue,
        clearQueue,
        likedTrackIds,
        toggleLike,
        isLiked,
        userPlaylists,
        createPlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
        toggleTrackInPlaylist,
        deletePlaylist,
        albumPickerTrack,
        openAlbumPicker,
        closeAlbumPicker,
        isCreateAlbumModalOpen,
        setIsCreateAlbumModalOpen,
        createAlbumModalInitialMode,
        openCreateAlbumModal,
        confirmDialog,
        openConfirmDialog,
        closeConfirmDialog,
        recentHistory,
        sleepTimerRemaining,
        setSleepTimer,
        isLyricsOpen,
        setIsLyricsOpen,
        isQueueOpen,
        setIsQueueOpen,
        isVisualizerOpen,
        setIsVisualizerOpen,
        isAddTrackModalOpen,
        setIsAddTrackModalOpen,
        getAudioFrequencyData,
        playRandomShuffle,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = (): PlayerContextType => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};

export function getAutoVibePlaylists(
  tracks: Track[],
  spaceId: MusicSpaceId = 'all'
): Playlist[] {
  const matchFilter = (t: Track, keywords: string[], genreName?: string) => {
    const text = (t.title + ' ' + t.artist + ' ' + t.genre + ' ' + (t.mood || '')).toLowerCase();
    if (genreName && t.genre.toLowerCase() === genreName.toLowerCase()) return true;
    return keywords.some(kw => text.includes(kw.toLowerCase()));
  };

  const usUkTracks = tracks.filter(t => isUsUkTrack(t));
  const kPopTracks = tracks.filter(t => isKPopTrack(t));
  const chillTracks = tracks.filter(t => matchFilter(t, ['chill', 'thư giãn', 'thanh bình', 'nhẹ nhàng', 'lo-fi'], 'Lo-Fi & Chill'));
  const sadTracks = tracks.filter(t => matchFilter(t, ['buồn', 'suy', 'tâm trạng', 'hoài niệm', 'lãng mạn', 'cô đơn', 'ballad'], 'Ballad'));
  const happyTracks = tracks.filter(t => matchFilter(t, ['vui', 'yêu đời', 'năng động', 'sôi động', 'sung', 'pop'], 'Pop'));
  const lofiTracks = tracks.filter(t => matchFilter(t, ['lofi', 'study', 'beats', 'chill'], 'Lo-Fi & Chill'));
  const acousticTracks = tracks.filter(t => matchFilter(t, ['acoustic', 'unplugged', 'cover', 'mộc'], 'Acoustic'));
  const trendingTracks = [...tracks].sort((a, b) => (Number(b.plays) || 0) - (Number(a.plays) || 0)).slice(0, 20);

  if (spaceId === 'us-uk') {
    const usUkHits = usUkTracks.filter(t => matchFilter(t, ['pop', 'hit', 'dance', 'upbeat', 'energy', 'us-uk'], 'US-UK'));
    const usUkChill = usUkTracks.filter(t => matchFilter(t, ['chill', 'night', 'lofi', 'dream', 'slow', 'sleep'], 'Lo-Fi & Chill'));
    const usUkRnb = usUkTracks.filter(t => matchFilter(t, ['r&b', 'soul', 'love', 'heart', 'feel'], 'R&B'));
    const usUkIndie = usUkTracks.filter(t => matchFilter(t, ['indie', 'acoustic', 'guitar', 'folk', 'ballad'], 'Indie'));
    const usUkTop = [...usUkTracks].sort((a, b) => (Number(b.plays) || 0) - (Number(a.plays) || 0)).slice(0, 25);

    return [
      {
        id: 'vibe-us-uk-hits',
        title: 'US-UK Global Hits',
        description: 'Những bản nhạc Âu Mỹ sôi động và phổ biến nhất trong không gian quốc tế.',
        coverUrl: usUkHits[0]?.coverUrl || usUkTracks[0]?.coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
        trackIds: (usUkHits.length > 0 ? usUkHits : usUkTracks).map(t => t.id),
        isCustom: false,
        createdAt: 'Không gian US-UK',
      },
      {
        id: 'vibe-us-uk-chill',
        title: 'US-UK Late Night Chill',
        description: 'Âm hưởng Âu Mỹ nhẹ nhàng, thư thái cho buổi tối muộn và lái xe.',
        coverUrl: usUkChill[0]?.coverUrl || usUkTracks[1]?.coverUrl || 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
        trackIds: (usUkChill.length > 0 ? usUkChill : usUkTracks).map(t => t.id),
        isCustom: false,
        createdAt: 'Không gian US-UK',
      },
      {
        id: 'vibe-us-uk-rnb',
        title: 'US-UK R&B & Soul',
        description: 'Chất giọng R&B mượt mà, giai điệu sâu lắng đậm chất Âu Mỹ.',
        coverUrl: usUkRnb[0]?.coverUrl || usUkTracks[2]?.coverUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&auto=format&fit=crop&q=80',
        trackIds: (usUkRnb.length > 0 ? usUkRnb : usUkTracks).map(t => t.id),
        isCustom: false,
        createdAt: 'Không gian US-UK',
      },
      {
        id: 'vibe-us-uk-indie',
        title: 'US-UK Indie & Acoustic',
        description: 'Giai điệu Indie phương Tây và bản phối Acoustic tinh tế.',
        coverUrl: usUkIndie[0]?.coverUrl || usUkTracks[3]?.coverUrl || 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=600&auto=format&fit=crop&q=80',
        trackIds: (usUkIndie.length > 0 ? usUkIndie : usUkTracks).map(t => t.id),
        isCustom: false,
        createdAt: 'Không gian US-UK',
      },
      {
        id: 'vibe-us-uk-trending',
        title: 'Top US-UK Thịnh Hành',
        description: 'Các ca khúc nhạc nước ngoài được nghe nhiều nhất trên Soundly.',
        coverUrl: usUkTop[0]?.coverUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
        trackIds: usUkTop.map(t => t.id),
        isCustom: false,
        createdAt: 'Không gian US-UK',
      },
    ];
  }

  return [
    {
      id: 'vibe-us-uk',
      title: 'US-UK & Nhạc Quốc Tế',
      description: 'Không gian âm nhạc Âu Mỹ, Pop, R&B và những giai điệu nước ngoài chọn lọc.',
      coverUrl: usUkTracks[0]?.coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
      trackIds: usUkTracks.map(t => t.id),
      isCustom: false,
      createdAt: 'Tự động tạo bởi AI',
    },
    {
      id: 'vibe-chill',
      title: 'Chill & Thư giãn',
      description: 'Những giai điệu nhẹ nhàng giúp bạn thả lỏng tâm hồn và tận hưởng không gian yên bình.',
      coverUrl: chillTracks[0]?.coverUrl || 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
      trackIds: chillTracks.map(t => t.id),
      isCustom: false,
      createdAt: 'Tự động tạo bởi AI',
    },
    {
      id: 'vibe-sad',
      title: 'Nhạc Suy & Tâm Trạng',
      description: 'Giai điệu sâu lắng, đượm buồn dành cho những khoảnh khắc nội tâm và hoài niệm.',
      coverUrl: sadTracks[0]?.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
      trackIds: sadTracks.map(t => t.id),
      isCustom: false,
      createdAt: 'Tự động tạo bởi AI',
    },
    {
      id: 'vibe-happy',
      title: 'Vui Vẻ & Yêu Đời',
      description: 'Bừng sáng năng lượng tích cực, giai điệu tươi vui cho một ngày mới tràn đầy sức sống.',
      coverUrl: happyTracks[0]?.coverUrl || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&auto=format&fit=crop&q=80',
      trackIds: happyTracks.map(t => t.id),
      isCustom: false,
      createdAt: 'Tự động tạo bởi AI',
    },
    {
      id: 'vibe-lofi',
      title: 'Lo-Fi & Study Beats',
      description: 'Âm thanh beat lo-fi êm dịu hỗ trợ tập trung học tập, làm việc và sáng tạo.',
      coverUrl: lofiTracks[0]?.coverUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
      trackIds: lofiTracks.map(t => t.id),
      isCustom: false,
      createdAt: 'Tự động tạo bởi AI',
    },
    {
      id: 'vibe-acoustic',
      title: 'Acoustic Mộc Mạc',
      description: 'Tiếng đàn guitar mộc mạc cùng giọng ca tự sự chân thực chạm đến cảm xúc.',
      coverUrl: acousticTracks[0]?.coverUrl || 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=600&auto=format&fit=crop&q=80',
      trackIds: acousticTracks.map(t => t.id),
      isCustom: false,
      createdAt: 'Tự động tạo bởi AI',
    },
    {
      id: 'vibe-kpop',
      title: 'K-Pop & Asian Vibe',
      description: 'Những giai điệu K-Pop, K-Indie và Châu Á bắt tai, hiện đại.',
      coverUrl: kPopTracks[0]?.coverUrl || 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&auto=format&fit=crop&q=80',
      trackIds: kPopTracks.map(t => t.id),
      isCustom: false,
      createdAt: 'Tự động tạo bởi AI',
    },
    {
      id: 'vibe-trending',
      title: 'Top Thịnh Hành (Trending)',
      description: 'Những bản nhạc được nghe nhiều nhất trên hệ thống Soundly hiện tại.',
      coverUrl: trendingTracks[0]?.coverUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
      trackIds: trendingTracks.map(t => t.id),
      isCustom: false,
      createdAt: 'Tự động tạo bởi AI',
    },
  ];
}
