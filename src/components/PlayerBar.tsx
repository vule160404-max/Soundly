import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Volume1,
  Heart,
  Mic2,
  ListMusic,
  Activity,
  Sparkles,
  AlertCircle,
  FolderPlus,
  Check
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePlayer } from '../context/PlayerContext';

interface PlayerBarProps {
  onOpenMobileNowPlaying?: () => void;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({ onOpenMobileNowPlaying }) => {
  const {
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
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeatMode,
    setPlaybackRate,
    playNext,
    playPrevious,
    toggleLike,
    isLiked,
    isLyricsOpen,
    setIsLyricsOpen,
    isQueueOpen,
    setIsQueueOpen,
    isVisualizerOpen,
    setIsVisualizerOpen,
    openAlbumPicker,
    userPlaylists
  } = usePlayer();

  const [, setIsHoveringSeek] = useState(false);

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    seek(val);
  };

  const handleSpeedCycle = () => {
    const speeds = [1, 1.25, 1.5];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    setPlaybackRate(speeds[nextIdx]);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const liked = currentTrack ? isLiked(currentTrack.id) : false;

  return (
    <>
      {/* ======================================================== */}
      {/* MOBILE MINI PLAYER BAR (Soundly Navy floating card)      */}
      {/* ======================================================== */}
      <AnimatePresence>
        {currentTrack && (
          <motion.div
            key="mobile-mini-player"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            onClick={onOpenMobileNowPlaying}
            className="fixed bottom-[68px] left-2 right-2 z-40 bg-[#141d3d] rounded-xl border border-[#2b3b75] shadow-xl md:hidden flex flex-col overflow-hidden select-none cursor-pointer active:scale-[0.98] transition-transform duration-150"
          >
          <div className="flex items-center justify-between p-2 pl-2.5 gap-3 h-14">
            {/* Artwork & Info */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-lg object-cover shrink-0 shadow-sm"
              />
              <div className="min-w-0 pr-1">
                <p className="text-xs font-bold text-[#f7f5f0] truncate">
                  {currentTrack.title}
                </p>
                {audioError ? (
                  <p className="text-[10px] text-amber-400 flex items-center gap-1 truncate mt-0.5">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span className="truncate">{audioError}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-[#a3aed0] truncate">
                    {currentTrack.artist}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Actions (Like & Play) */}
            <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => toggleLike(currentTrack.id)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#a3aed0] active:scale-125 transition-transform"
                title={liked ? 'Xóa khỏi yêu thích' : 'Lưu vào yêu thích'}
              >
                <Heart className={`w-5 h-5 ${liked ? 'fill-[#f47b64] text-[#f47b64]' : ''}`} />
              </button>

              <button
                onClick={togglePlay}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#f7f5f0] active:scale-95 transition-transform"
                title={isPlaying ? 'Tạm dừng' : 'Phát'}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 fill-[#f7f5f0]" />
                ) : (
                  <Play className="w-6 h-6 fill-[#f7f5f0] ml-0.5" />
                )}
              </button>

              <button
                onClick={playNext}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#a3aed0] active:scale-90 transition-transform"
                title="Bài kế tiếp"
              >
                <SkipForward className="w-5 h-5 fill-[#a3aed0]" />
              </button>
            </div>
          </div>

          {/* Thin bottom progress strip */}
          <div className="w-full bg-[#222f5e] h-0.5">
            <div
              className="bg-[#f47b64] h-full transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* DESKTOP FULL PLAYER BAR (Soundly Navy desktop dock)      */}
      {/* ======================================================== */}
      <footer className="hidden md:flex fixed bottom-0 left-0 right-0 z-40 bg-[#070b1a] border-t border-[#1e2a54] h-[88px] px-6 items-center justify-between select-none shadow-2xl text-[#f7f5f0]">
        {/* LEFT ZONE: Currently Playing Track Info */}
        <div className="flex items-center gap-3.5 w-1/4 min-w-[200px] max-w-[320px]">
          {currentTrack ? (
            <>
              <div className="relative group shrink-0">
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-md object-cover shadow-sm"
                />
                {isPlaying && (
                  <div className="absolute inset-0 bg-[#070b1a]/45 rounded-md flex items-center justify-center">
                    <div className="flex items-end gap-0.5 h-3.5">
                      <span className="w-0.5 h-full bg-[#f47b64] rounded-full soundly-eq-bar" style={{ animationDelay: '0ms' }} />
                      <span className="w-0.5 h-full bg-[#f47b64] rounded-full soundly-eq-bar" style={{ animationDelay: '180ms' }} />
                      <span className="w-0.5 h-full bg-[#f47b64] rounded-full soundly-eq-bar" style={{ animationDelay: '340ms' }} />
                    </div>
                  </div>
                )}
              </div>

              <div className="min-w-0 pr-1">
                <p className="text-sm font-bold text-[#f7f5f0] truncate hover:underline cursor-pointer">
                  {currentTrack.title}
                </p>
                <p className="text-xs text-[#a3aed0] truncate hover:text-[#f7f5f0] hover:underline cursor-pointer">
                  {currentTrack.artist}
                </p>
                {audioError && (
                  <p className="text-[10px] text-amber-400 flex items-center gap-1 mt-0.5">
                    <AlertCircle className="w-2.5 h-2.5" />
                    <span className="truncate">{audioError}</span>
                  </p>
                )}
              </div>

              <button
                onClick={() => toggleLike(currentTrack.id)}
                title={liked ? 'Xóa khỏi danh sách yêu thích' : 'Lưu bài hát yêu thích'}
                className="p-1.5 rounded-lg text-[#a3aed0] hover:text-[#f7f5f0] transition-colors shrink-0"
              >
                <Heart className={`w-4 h-4 ${liked ? 'fill-[#f47b64] text-[#f47b64]' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => openAlbumPicker(currentTrack)}
                title="Thêm vào album trong thư viện"
                className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                  userPlaylists.some((pl) => pl.trackIds.includes(currentTrack.id))
                    ? 'text-[#f47b64] hover:text-[#ff8d76]'
                    : 'text-[#a3aed0] hover:text-[#f7f5f0]'
                }`}
              >
                {userPlaylists.some((pl) => pl.trackIds.includes(currentTrack.id)) ? (
                  <Check className="w-4 h-4 stroke-[2.5]" />
                ) : (
                  <FolderPlus className="w-4 h-4" />
                )}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3 text-[#a3aed0]">
              <div className="w-12 h-12 rounded-md bg-[#141d3d] flex items-center justify-center text-[#f47b64]/70">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#f7f5f0]">Chưa chọn bài hát</p>
                <p className="text-[11px] text-[#a3aed0]">Chọn bài hát để phát</p>
              </div>
            </div>
          )}
        </div>

        {/* CENTER ZONE: Playback Controls & Precision Seek Slider */}
        <div className="flex flex-col items-center justify-center flex-1 max-w-xl px-4 md:px-6">
          {/* Playback Buttons */}
          <div className="flex items-center gap-5 mb-1.5">
            {/* Shuffle Toggle */}
            <button
              onClick={toggleShuffle}
              title={isShuffle ? 'Tắt phát ngẫu nhiên' : 'Bật phát ngẫu nhiên'}
              className={`p-1.5 rounded-lg transition-colors relative ${
                isShuffle ? 'text-[#f47b64]' : 'text-[#a3aed0] hover:text-[#f7f5f0]'
              }`}
            >
              <Shuffle className="w-4 h-4" />
              {isShuffle && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#f47b64]" />}
            </button>

            {/* Previous Track */}
            <button
              onClick={playPrevious}
              disabled={!currentTrack}
              title="Bài trước đó"
              className="p-1.5 rounded-lg text-[#a3aed0] hover:text-[#f7f5f0] disabled:opacity-30 transition-colors"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            {/* Soundly Signature Play/Pause Button */}
            <button
              onClick={togglePlay}
              disabled={!currentTrack}
              title={isPlaying ? 'Tạm dừng' : 'Phát'}
              className="w-9 h-9 rounded-full bg-[#f7f5f0] text-[#070b1a] flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 transition-all shadow-md"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-[#070b1a]" />
              ) : (
                <Play className="w-4 h-4 fill-[#070b1a] ml-0.5" />
              )}
            </button>

            {/* Next Track */}
            <button
              onClick={playNext}
              disabled={!currentTrack}
              title="Bài kế tiếp"
              className="p-1.5 rounded-lg text-[#a3aed0] hover:text-[#f7f5f0] disabled:opacity-30 transition-colors"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            {/* Repeat Mode Cycle */}
            <button
              onClick={cycleRepeatMode}
              title={
                repeatMode === 'one'
                  ? 'Đang lặp lại 1 bài'
                  : repeatMode === 'all'
                  ? 'Đang lặp lại danh sách'
                  : 'Lặp lại đã tắt'
              }
              className={`p-1.5 rounded-lg transition-colors relative ${
                repeatMode !== 'off' ? 'text-[#f47b64]' : 'text-[#a3aed0] hover:text-[#f7f5f0]'
              }`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
              {repeatMode !== 'off' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#f47b64]" />}
            </button>
          </div>

          {/* Progress & Seekbar */}
          <div className="w-full flex items-center gap-2.5 text-[11px] font-mono tabular-nums text-[#a3aed0]">
            <span className="w-9 text-right shrink-0">{formatTime(currentTime)}</span>

            <div
              className="relative flex-1 group flex items-center py-1 cursor-pointer"
              onMouseEnter={() => setIsHoveringSeek(true)}
              onMouseLeave={() => setIsHoveringSeek(false)}
            >
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.5}
                value={currentTime}
                onChange={handleSeekChange}
                disabled={!currentTrack}
                className="w-full h-1 bg-[#222f5e] group-hover:bg-[#2d3e7a] rounded-lg appearance-none cursor-pointer accent-[#f47b64] transition-all"
              />
            </div>

            <span className="w-9 text-left shrink-0">{formatTime(duration)}</span>
          </div>
        </div>

        {/* RIGHT ZONE: Utility Drawer Toggles & Volume */}
        <div className="flex items-center justify-end gap-2 md:gap-3 w-1/4 min-w-[160px] max-w-[280px]">
          {/* Speed Adjustment */}
          <button
            onClick={handleSpeedCycle}
            title={`Tốc độ phát: ${playbackRate}x`}
            className="hidden sm:inline-flex px-2 py-1 text-[11px] font-mono font-semibold rounded-md text-[#a3aed0] hover:text-[#f7f5f0] transition-colors"
          >
            {playbackRate}x
          </button>

          {/* Lyrics Button */}
          <button
            onClick={() => setIsLyricsOpen(!isLyricsOpen)}
            title="Lời bài hát đồng bộ"
            className={`p-2 rounded-full transition-colors ${
              isLyricsOpen ? 'text-[#f47b64]' : 'text-[#a3aed0] hover:text-[#f7f5f0]'
            }`}
          >
            <Mic2 className="w-4 h-4" />
          </button>

          {/* Queue Button */}
          <button
            onClick={() => setIsQueueOpen(!isQueueOpen)}
            title="Hàng đợi bài hát"
            className={`p-2 rounded-full transition-colors ${
              isQueueOpen ? 'text-[#f47b64]' : 'text-[#a3aed0] hover:text-[#f7f5f0]'
            }`}
          >
            <ListMusic className="w-4 h-4" />
          </button>

          {/* Visualizer Button */}
          <button
            onClick={() => setIsVisualizerOpen(!isVisualizerOpen)}
            title="Hiệu ứng sóng âm thanh"
            className={`p-2 rounded-full transition-colors ${
              isVisualizerOpen ? 'text-[#f47b64]' : 'text-[#a3aed0] hover:text-[#f7f5f0]'
            }`}
          >
            <Activity className="w-4 h-4" />
          </button>

          {/* Volume Controls */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-[#1e2a54]">
            <button
              onClick={toggleMute}
              title={isMuted ? 'Bật âm thanh' : 'Tắt tiếng'}
              className="p-1.5 text-[#a3aed0] hover:text-[#f7f5f0] transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-500" />
              ) : volume < 0.5 ? (
                <Volume1 className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>

            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              title={`Âm lượng: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
              className="w-16 md:w-22 h-1 bg-[#222f5e] hover:bg-[#2d3e7a] rounded-lg appearance-none cursor-pointer accent-[#f47b64] transition-all"
            />
          </div>
        </div>
      </footer>
    </>
  );
};
