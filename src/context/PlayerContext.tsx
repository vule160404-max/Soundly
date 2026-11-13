import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Track, Playlist, RepeatMode, LyricLine } from '../types/music';
import { INITIAL_PLAYLISTS } from '../data/mockTracks';

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

  // Favorites & Playlists
  likedTrackIds: string[];
  toggleLike: (trackId: string) => void;
  isLiked: (trackId: string) => boolean;
  userPlaylists: Playlist[];
  createPlaylist: (title: string, description?: string) => Playlist;
  addTrackToPlaylist: (playlistId: string, trackId: string) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  deletePlaylist: (playlistId: string) => void;

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
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

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
      return parsed.filter(id => !oldIds.has(id));
    } catch {
      return [];
    }
  });

  // Playlists
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>(() => {
    try {
      const saved = localStorage.getItem('nordic_playlists');
      if (!saved) return INITIAL_PLAYLISTS;
      const parsed = JSON.parse(saved) as Playlist[];
      const oldPlaylistIds = new Set(['playlist-nordic-chill', 'playlist-morning-fika', 'playlist-focus-study']);
      return parsed.filter(pl => !oldPlaylistIds.has(pl.id));
    } catch {
      return INITIAL_PLAYLISTS;
    }
  });

  // Sleep Timer
  const [sleepTimerEndTime, setSleepTimerEndTime] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);

  // UI Drawers
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isVisualizerOpen, setIsVisualizerOpen] = useState(false);
  const [isAddTrackModalOpen, setIsAddTrackModalOpen] = useState(false);

  // Initialize HTML5 Audio Element
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'metadata';
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setAudioError(null);
    };

    const handleEnded = () => {
      handleTrackEnd();
    };

    const handleError = () => {
      console.warn('Audio playback error on url:', audio.src);
      setAudioError('Không thể nạp tệp âm thanh. Vui lòng kiểm tra kết nối.');
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

  // Web Audio API initialization for visualizer on user gesture
  const initAudioAnalyser = () => {
    if (!audioRef.current || analyserRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      sourceNodeRef.current = source;
    } catch (e) {
      // AudioContext might be blocked until user interacts, or already connected
      console.debug('Web Audio Analyser init deferred:', e);
    }
  };

  const getAudioFrequencyData = useCallback((): Uint8Array | null => {
    if (!analyserRef.current) return null;
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);
    return dataArray;
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

  // Save playlists
  useEffect(() => {
    localStorage.setItem('nordic_playlists', JSON.stringify(userPlaylists));
  }, [userPlaylists]);

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
        // Stop audio gently
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
    initAudioAnalyser();

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    setCurrentTrack(track);
    setAudioError(null);

    // If new queue provided, update queue
    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
      const idx = newQueue.findIndex(t => t.id === track.id);
      setQueueIndex(idx !== -1 ? idx : 0);
    } else {
      // If queue is empty, set this track as queue
      setQueue(prev => {
        if (prev.length === 0) return [track];
        const idx = prev.findIndex(t => t.id === track.id);
        if (idx !== -1) {
          setQueueIndex(idx);
          return prev;
        }
        return [track, ...prev];
      });
    }

    audioRef.current.src = track.audioUrl;
    audioRef.current.currentTime = 0;
    audioRef.current.play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch(err => {
        console.warn('Audio play request interrupted:', err);
        setIsPlaying(false);
      });

    // Add to recent history (deduplicated at top)
    setRecentHistory(prev => {
      const filtered = prev.filter(t => t.id !== track.id);
      return [track, ...filtered];
    });
  }, []);

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;
    initAudioAnalyser();

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.warn('Play error:', err));
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
    setIsMuted(prev => !prev);
  };

  const toggleShuffle = () => {
    setIsShuffle(prev => !prev);
  };

  const cycleRepeatMode = () => {
    setRepeatMode(prev => {
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
      // Pick random track that is not current
      const availableIndices = queue
        .map((_, i) => i)
        .filter(i => i !== queueIndex);
      const nextIdx = availableIndices.length > 0
        ? availableIndices[Math.floor(Math.random() * availableIndices.length)]
        : 0;
      setQueueIndex(nextIdx);
      playTrack(queue[nextIdx], queue);
      return;
    }

    let nextIndex = queueIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        // Reached end of queue without repeat all
        setIsPlaying(false);
        return;
      }
    }
    setQueueIndex(nextIndex);
    playTrack(queue[nextIndex], queue);
  }, [queue, queueIndex, isShuffle, repeatMode, playTrack]);

  const playPrevious = useCallback(() => {
    if (!audioRef.current || queue.length === 0) return;

    // If played more than 3 seconds, restart current track
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

  const handleTrackEnd = () => {
    if (repeatMode === 'one' && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else {
      playNext();
    }
  };

  const addToQueue = (track: Track) => {
    setQueue(prev => [...prev, track]);
  };

  const removeFromQueue = (index: number) => {
    setQueue(prev => prev.filter((_, idx) => idx !== index));
    if (index < queueIndex) {
      setQueueIndex(prev => Math.max(0, prev - 1));
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
    setLikedTrackIds(prev =>
      prev.includes(trackId)
        ? prev.filter(id => id !== trackId)
        : [...prev, trackId]
    );
  };

  const isLiked = (trackId: string) => likedTrackIds.includes(trackId);

  // Custom playlists
  const createPlaylist = (title: string, description?: string): Playlist => {
    const newPl: Playlist = {
      id: `playlist-${Date.now()}`,
      title: title.trim(),
      description: description?.trim() || 'Tuyển tập giai điệu của tôi',
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
      trackIds: [],
      isCustom: true,
      createdAt: new Date().toLocaleDateString('vi-VN')
    };
    setUserPlaylists(prev => [newPl, ...prev]);
    return newPl;
  };

  const addTrackToPlaylist = (playlistId: string, trackId: string) => {
    setUserPlaylists(prev =>
      prev.map(p => {
        if (p.id === playlistId) {
          if (p.trackIds.includes(trackId)) return p;
          return { ...p, trackIds: [...p.trackIds, trackId] };
        }
        return p;
      })
    );
  };

  const removeTrackFromPlaylist = (playlistId: string, trackId: string) => {
    setUserPlaylists(prev =>
      prev.map(p => {
        if (p.id === playlistId) {
          return { ...p, trackIds: p.trackIds.filter(id => id !== trackId) };
        }
        return p;
      })
    );
  };

  const deletePlaylist = (playlistId: string) => {
    setUserPlaylists(prev => prev.filter(p => p.id !== playlistId));
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
        deletePlaylist,
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
