import React from 'react';
import { History } from 'lucide-react';
import { TrackTable } from './TrackTable';
import { usePlayer } from '../context/PlayerContext';

export const HistoryView: React.FC = () => {
  const { recentHistory, playTrack } = usePlayer();

  return (
    <div className="space-y-6 pb-12 text-[#f7f5f0]">
      {/* Header */}
      <div className="p-6 sm:p-8 rounded-xl bg-[#141d3d] border border-[#222f5e] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#f47b64] mb-1">
            <History className="w-4 h-4" />
            <span>Gần đây</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#f7f5f0] tracking-tight">
            Lịch sử nghe nhạc
          </h2>
          <p className="text-xs sm:text-sm text-[#a3aed0] mt-1">
            Các bản nhạc bạn đã phát gần đây nhất trên Soundly.
          </p>
        </div>

        <span className="text-xs font-mono tabular-nums px-3 py-1.5 rounded-full bg-[#0d142c] text-[#a3aed0] font-semibold self-start sm:self-auto border border-[#222f5e]">
          {recentHistory.length} bài hát
        </span>
      </div>

      {/* Tracks Table */}
      <div className="bg-[#0d142c] rounded-xl p-2">
        {recentHistory.length > 0 ? (
          <TrackTable tracks={recentHistory} onPlayList={(list, idx) => playTrack(list[idx], list)} />
        ) : (
          <div className="py-16 text-center text-[#a3aed0]">
            <History className="w-10 h-10 mx-auto mb-3 text-[#f47b64]/45" />
            <p className="text-base font-bold text-[#f7f5f0]">Chưa có lịch sử phát</p>
            <p className="text-xs text-[#8d99be] mt-1">
              Bài hát bạn nghe sẽ tự động được lưu lại tại đây.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
