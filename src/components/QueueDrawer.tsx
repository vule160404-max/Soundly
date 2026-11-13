import React from 'react';
import { X, ListMusic, Trash2, Play, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePlayer } from '../context/PlayerContext';

export const QueueDrawer: React.FC = () => {
  const {
    currentTrack,
    queue,
    queueIndex,
    playTrack,
    removeFromQueue,
    clearQueue,
    isQueueOpen,
    setIsQueueOpen
  } = usePlayer();

  const upcomingTracks = queue.slice(queueIndex + 1);

  return (
    <AnimatePresence>
      {isQueueOpen && (
        <motion.div
          key="queue-drawer"
          initial={{ x: '100%', opacity: 0.4 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.4 }}
          transition={{ type: 'spring', stiffness: 360, damping: 34 }}
          className="fixed inset-0 md:inset-auto md:right-0 md:top-0 md:bottom-[88px] w-full md:w-[420px] bg-[#0d142c] backdrop-blur-xl md:border-l md:border-[#222f5e] shadow-2xl z-50 flex flex-col text-[#f7f5f0]"
        >
      {/* Header */}
      <div className="p-4 px-6 border-b border-[#1e2a54] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#f47b64] text-[#070b1a] flex items-center justify-center">
            <ListMusic className="w-4 h-4 fill-[#070b1a]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#f7f5f0]">Danh sách chờ</h3>
            <p className="text-[11px] text-[#a3aed0] font-mono tabular-nums">
              {queue.length} bài hát trong hàng đợi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {queue.length > 1 && (
            <button
              onClick={clearQueue}
              title="Xóa danh sách chờ"
              className="text-xs font-bold text-[#a3aed0] hover:text-[#f7f5f0] px-2.5 py-1.5 rounded-full hover:bg-[#162047] transition-colors"
            >
              Xóa sạch
            </button>
          )}

          <button
            onClick={() => setIsQueueOpen(false)}
            title="Đóng hàng đợi"
            className="p-1.5 rounded-full text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-[#162047] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Currently Playing Card */}
        {currentTrack && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#f47b64] mb-2.5">
              Đang phát
            </p>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#141d3d] border border-[#2b3b75]">
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-md object-cover shadow-sm shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#f47b64] truncate">
                  {currentTrack.title}
                </p>
                <p className="text-xs text-[#a3aed0] truncate mt-0.5">
                  {currentTrack.artist}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Up Next List */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#a3aed0] mb-2.5">
            Tiếp theo ({upcomingTracks.length})
          </p>

          {upcomingTracks.length > 0 ? (
            <div className="space-y-1">
              {upcomingTracks.map((track, idx) => {
                const actualIndex = queueIndex + 1 + idx;

                return (
                  <div
                    key={`${track.id}-${actualIndex}`}
                    onClick={() => playTrack(track, queue)}
                    className="group flex items-center justify-between p-2 rounded-md hover:bg-[#141d3d] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <span className="w-5 text-center text-xs font-mono text-[#6e7ba8] group-hover:hidden">
                        {idx + 1}
                      </span>
                      <button className="w-5 hidden group-hover:flex items-center justify-center text-[#f7f5f0]">
                        <Play className="w-3.5 h-3.5 fill-[#f7f5f0]" />
                      </button>

                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-md object-cover shrink-0"
                      />

                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#f7f5f0] truncate">
                          {track.title}
                        </p>
                        <p className="text-[11px] text-[#a3aed0] truncate">
                          {track.artist}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromQueue(actualIndex);
                      }}
                      title="Xóa khỏi hàng đợi"
                      className="p-1.5 text-[#a3aed0] hover:text-rose-400 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-[#a3aed0] border border-dashed border-[#222f5e] rounded-xl">
              <Sparkles className="w-6 h-6 mx-auto mb-2 text-[#f47b64]/45" />
              <p className="text-xs font-semibold text-[#f7f5f0]">Hàng đợi đang trống</p>
              <p className="text-[11px] text-[#8d99be] mt-1 max-w-xs mx-auto">
                Nhấp vào ba chấm bên cạnh bất kỳ bài hát nào để thêm vào hàng đợi.
              </p>
            </div>
          )}
        </div>
      </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
