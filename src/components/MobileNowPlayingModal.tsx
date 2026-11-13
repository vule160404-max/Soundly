import React from 'react';
import {
  ChevronDown,
  Heart,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Mic2,
  ListMusic,
  Moon,
  Activity,
  Volume2,
  VolumeX,
  Share2,
  FolderPlus,
  Check,
  AlertCircle
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePlayer } from '../context/PlayerContext';

interface MobileNowPlayingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSleepTimer: () => void;
}

export const MobileNowPlayingModal: React.FC<MobileNowPlayingModalProps> = ({
  isOpen,
  onClose,
  onOpenSleepTimer
}) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeatMode,
    playNext,
    playPrevious,
    toggleLike,
    isLiked,
    setIsLyricsOpen,
    setIsQueueOpen,
    setIsVisualizerOpen,
    openAlbumPicker,
    userPlaylists,
    audioError
  } = usePlayer();

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const liked = currentTrack ? isLiked(currentTrack.id) : false;

  return (
    <AnimatePresence>
      {isOpen && currentTrack && (
        <motion.div
          key="mobile-now-playing"
          initial={{ y: '100%', opacity: 0.6 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0.6 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="fixed inset-0 z-50 bg-gradient-to-b from-[#162252] via-[#0d142c] to-[#070b1a] flex flex-col md:hidden text-[#f7f5f0] select-none soundly-overlay-top-safe soundly-bottom-safe"
        >
      {/* Top Drag Indicator Pill */}
      <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-1 shrink-0" />

      {/* Top Bar / Minimize Header */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] rounded-xl bg-white/[0.08] active:bg-white/[0.16] border border-white/10 flex items-center justify-center text-[#f7f5f0] active:scale-95 transition-all shrink-0 touch-manipulation"
          title="Thu nhỏ"
          aria-label="Thu nhỏ trình phát nhạc"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        <div className="text-center truncate px-2 min-w-0 flex-1">
          <p className="text-[10px] uppercase font-bold tracking-wider text-[#a3aed0]">
            Đang phát trên Soundly
          </p>
          <p className="text-xs font-bold text-[#f7f5f0] truncate">
            {currentTrack.album || currentTrack.genre}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: currentTrack.title,
                text: `Nghe bài hát "${currentTrack.title}" của ${currentTrack.artist} trên Soundly!`,
                url: window.location.href,
              }).catch(() => {});
            }
          }}
          className="min-h-[44px] min-w-[44px] rounded-xl bg-white/[0.08] active:bg-white/[0.16] border border-white/10 flex items-center justify-center text-[#a3aed0] hover:text-[#f7f5f0] active:scale-95 transition-all shrink-0 touch-manipulation"
          title="Chia sẻ"
          aria-label="Chia sẻ bài hát"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col justify-between">
        {/* Large Album Artwork */}
        <motion.div
          animate={{ scale: isPlaying ? 1 : 0.94 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="w-full aspect-square max-h-[340px] mx-auto rounded-2xl overflow-hidden shadow-2xl my-auto ring-1 ring-[#2b3b75]"
        >
          <img
            src={currentTrack.coverUrl}
            alt={currentTrack.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </motion.div>

        {/* Track Title, Artist & Like Button */}
        <div className="mt-6 flex items-center justify-between">
          <div className="min-w-0 pr-3">
            <h2 className="text-2xl font-black text-[#f7f5f0] truncate">
              {currentTrack.title}
            </h2>
            <p className="text-sm font-semibold text-[#a3aed0] truncate mt-0.5">
              {currentTrack.artist}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => openAlbumPicker(currentTrack)}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full active:scale-110 transition-transform ${
                userPlaylists.some((pl) => pl.trackIds.includes(currentTrack.id))
                  ? 'text-[#f47b64]'
                  : 'text-[#a3aed0]'
              }`}
              title="Thêm vào album trong thư viện"
            >
              {userPlaylists.some((pl) => pl.trackIds.includes(currentTrack.id)) ? (
                <Check className="w-6 h-6 stroke-[2.5]" />
              ) : (
                <FolderPlus className="w-6 h-6" />
              )}
            </button>

            <button
              onClick={() => toggleLike(currentTrack.id)}
              className="min-h-[48px] min-w-[48px] flex items-center justify-center active:scale-125 transition-transform shrink-0"
              title={liked ? 'Xóa khỏi yêu thích' : 'Lưu vào yêu thích'}
            >
              <Heart className={`w-7 h-7 ${liked ? 'fill-[#f47b64] text-[#f47b64]' : 'text-[#a3aed0]'}`} />
            </button>
          </div>
        </div>

        {audioError && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-amber-950/70 border border-amber-500/40 text-[11px] text-amber-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="leading-snug">{audioError}</span>
          </div>
        )}

        {/* Precision Progress Scrubber */}
        <div className="mt-4">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.5}
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#222f5e] rounded-lg appearance-none cursor-pointer accent-[#f47b64]"
          />
          <div className="flex items-center justify-between text-xs font-mono tabular-nums text-[#a3aed0] mt-1.5">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Primary Playback Controls */}
        <div className="mt-3 flex items-center justify-between py-2">
          {/* Shuffle Toggle */}
          <button
            onClick={toggleShuffle}
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center relative transition-colors ${
              isShuffle ? 'text-[#f47b64]' : 'text-[#a3aed0]'
            }`}
          >
            <Shuffle className="w-5 h-5" />
            {isShuffle && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#f47b64]" />}
          </button>

          {/* Previous Track */}
          <button
            onClick={playPrevious}
            className="min-h-[48px] min-w-[48px] flex items-center justify-center text-[#f7f5f0] active:scale-90 transition-transform"
          >
            <SkipBack className="w-7 h-7 fill-[#f7f5f0]" />
          </button>

          {/* Soundly Big Ivory Circle Play / Pause */}
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-[#f7f5f0] text-[#070b1a] flex items-center justify-center shadow-xl active:scale-95 transition-all"
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-[#070b1a]" />
            ) : (
              <Play className="w-7 h-7 fill-[#070b1a] ml-1" />
            )}
          </button>

          {/* Next Track */}
          <button
            onClick={playNext}
            className="min-h-[48px] min-w-[48px] flex items-center justify-center text-[#f7f5f0] active:scale-90 transition-transform"
          >
            <SkipForward className="w-7 h-7 fill-[#f7f5f0]" />
          </button>

          {/* Repeat Cycle */}
          <button
            onClick={cycleRepeatMode}
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center relative transition-colors ${
              repeatMode !== 'off' ? 'text-[#f47b64]' : 'text-[#a3aed0]'
            }`}
          >
            {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
            {repeatMode !== 'off' && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#f47b64]" />}
          </button>
        </div>

        {/* Volume Scroller */}
        <div className="mt-2 flex items-center gap-3 px-2">
          <button
            onClick={toggleMute}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#a3aed0]"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-5 h-5 text-rose-500" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 h-1 bg-[#222f5e] rounded-lg appearance-none accent-[#f47b64]"
          />
        </div>

        {/* Secondary Tool Buttons Row */}
        <div className="mt-3 pt-3 border-t border-[#222f5e] flex items-center justify-around">
          <button
            onClick={() => {
              onClose();
              setIsLyricsOpen(true);
            }}
            className="flex flex-col items-center gap-1 text-[#a3aed0] active:text-[#f47b64] min-h-[44px] min-w-[44px] justify-center"
          >
            <Mic2 className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Lời bài hát</span>
          </button>

          <button
            onClick={() => {
              onClose();
              setIsQueueOpen(true);
            }}
            className="flex flex-col items-center gap-1 text-[#a3aed0] active:text-[#f47b64] min-h-[44px] min-w-[44px] justify-center"
          >
            <ListMusic className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Hàng đợi</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenSleepTimer();
            }}
            className="flex flex-col items-center gap-1 text-[#a3aed0] active:text-[#f47b64] min-h-[44px] min-w-[44px] justify-center"
          >
            <Moon className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Hẹn giờ</span>
          </button>

          <button
            onClick={() => {
              onClose();
              setIsVisualizerOpen(true);
            }}
            className="flex flex-col items-center gap-1 text-[#a3aed0] active:text-[#f47b64] min-h-[44px] min-w-[44px] justify-center"
          >
            <Activity className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Sóng nhạc</span>
          </button>
        </div>
      </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
