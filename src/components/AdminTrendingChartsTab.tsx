import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  RefreshCw,
  Globe,
  Music2,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  ExternalLink,
  Clock,
} from 'lucide-react';
import {
  Track,
  TrendingChartRegion,
  TrendingChartSnapshot,
} from '../types/music';
import { musicApi } from '../services/api';
import { usePlayer } from '../context/PlayerContext';

interface AdminTrendingChartsTabProps {
  tracks: Track[];
  charts: {
    vn: TrendingChartSnapshot | null;
    global: TrendingChartSnapshot | null;
  };
  onChartsUpdated: (charts: {
    vn: TrendingChartSnapshot | null;
    global: TrendingChartSnapshot | null;
  }) => void;
}

function formatSyncTime(iso?: string): string {
  if (!iso) return 'Chưa đồng bộ';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Chưa đồng bộ';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export const AdminTrendingChartsTab: React.FC<AdminTrendingChartsTabProps> = ({
  tracks,
  charts,
  onChartsUpdated,
}) => {
  const { playTrack, currentTrack } = usePlayer();

  const [selectedRegion, setSelectedRegion] = useState<TrendingChartRegion>('vn');
  const [inspectTab, setInspectTab] = useState<'matched' | 'missing'>('matched');
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [syncingTarget, setSyncingTarget] = useState<'all' | TrendingChartRegion | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const trackById = useMemo(() => new Map(tracks.map(t => [t.id, t])), [tracks]);
  const activeChart = selectedRegion === 'vn' ? charts.vn : charts.global;

  const matchedTracks = useMemo(() => {
    if (!activeChart) return [];
    return activeChart.entries
      .map(entry => {
        const track = trackById.get(entry.trackId);
        if (!track) return null;
        return { entry, track };
      })
      .filter((x): x is { entry: TrendingChartSnapshot['entries'][number]; track: Track } =>
        Boolean(x)
      );
  }, [activeChart, trackById]);

  const handleSync = async (
    region: TrendingChartRegion | 'all',
    options?: { customSpotifyUrl?: string; clearCustomUrl?: boolean }
  ) => {
    setSyncingTarget(region);
    setNotice(null);
    try {
      const updated = await musicApi.syncTrendingCharts({
        region,
        customSpotifyUrl: options?.customSpotifyUrl,
        clearCustomUrl: options?.clearCustomUrl,
        catalogTracks: tracks,
      });
      onChartsUpdated(updated);
      const vnCount = updated.vn?.matchedCount ?? 0;
      const globalCount = updated.global?.matchedCount ?? 0;
      setNotice({
        type: 'success',
        message:
          region === 'all'
            ? `Đã đồng bộ BXH Spotify thành công: Việt Nam khớp ${vnCount}/${updated.vn?.totalSpotifyEntries ?? 50} bài · Toàn cầu khớp ${globalCount}/${updated.global?.totalSpotifyEntries ?? 50} bài.`
            : region === 'vn'
              ? `Đã đồng bộ BXH Spotify Việt Nam: khớp ${vnCount}/${updated.vn?.totalSpotifyEntries ?? 50} bài có sẵn trên Soundly.`
              : `Đã đồng bộ BXH Spotify Toàn cầu: khớp ${globalCount}/${updated.global?.totalSpotifyEntries ?? 50} bài có sẵn trên Soundly.`,
      });
      if (options?.clearCustomUrl) setCustomUrlInput('');
    } catch (err: unknown) {
      setNotice({
        type: 'error',
        message: err instanceof Error ? err.message : 'Đồng bộ BXH Spotify thất bại.',
      });
    } finally {
      setSyncingTarget(null);
    }
  };

  const renderRegionSummaryCard = (
    region: TrendingChartRegion,
    label: string,
    snap: TrendingChartSnapshot | null
  ) => {
    const isSelected = selectedRegion === region;
    const isBusy = syncingTarget === region || syncingTarget === 'all';
    return (
      <div
        className={`p-5 rounded-2xl border transition-colors ${
          isSelected
            ? 'bg-[#18234a] border-[#f47b64]/60'
            : 'bg-[#141d3d] border-[#222f5e]'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              {region === 'vn' ? (
                <Music2 className="w-4 h-4 text-[#f47b64] shrink-0" />
              ) : (
                <Globe className="w-4 h-4 text-[#f47b64] shrink-0" />
              )}
              <h4 className="text-sm font-bold text-[#f7f5f0] truncate">{label}</h4>
            </div>
            <p className="text-xs text-[#a3aed0] truncate">
              {snap?.sourceLabel || 'Chưa có dữ liệu đồng bộ'}
            </p>
          </div>

          <button
            type="button"
            disabled={syncingTarget !== null}
            onClick={() => handleSync(region)}
            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] font-bold text-xs flex items-center gap-1.5 shrink-0 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
            <span>{isBusy ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-[#222f5e] text-xs">
          <div>
            <p className="text-[11px] text-[#8d99be]">Bài khớp có file Soundly</p>
            <p className="font-mono tabular-nums text-base font-extrabold text-[#f7f5f0] mt-0.5">
              {snap ? `${snap.matchedCount} / ${snap.totalSpotifyEntries}` : '0 / 50'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[#8d99be]">Cập nhật lần cuối</p>
            <p className="font-mono tabular-nums text-xs font-semibold text-[#cbd5f5] mt-1">
              {formatSyncTime(snap?.updatedAt)}
            </p>
          </div>
        </div>

        {snap?.customSpotifyUrl && (
          <p className="mt-2.5 text-[11px] text-[#f47b64] truncate">
            Nguồn tuỳ chỉnh: {snap.customSpotifyUrl}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="p-6 rounded-2xl bg-[#141d3d] border border-[#222f5e] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-[#f7f5f0] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#f47b64]" />
            <span>Quản lý Bảng Xếp Hạng Thịnh Hành Spotify</span>
          </h3>
          <p className="text-xs text-[#a3aed0] leading-relaxed">
            Hệ thống tự động làm mới BXH Spotify Việt Nam & Toàn cầu mỗi 12 giờ và chỉ hiển thị những bài đã có file âm thanh trên Soundly. Nút đồng bộ này chỉ hiển thị với Admin.
          </p>
        </div>

        <button
          type="button"
          disabled={syncingTarget !== null}
          onClick={() => handleSync('all')}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] font-extrabold text-xs flex items-center gap-2 shadow-lg shrink-0 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          <RefreshCw className={`w-4 h-4 ${syncingTarget === 'all' ? 'animate-spin' : ''}`} />
          <span>{syncingTarget === 'all' ? 'Đang đồng bộ tất cả...' : 'Đồng bộ cả 2 BXH Spotify'}</span>
        </button>
      </div>

      {notice && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 ${
            notice.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Region Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderRegionSummaryCard('vn', 'Spotify Top 50 Việt Nam', charts.vn)}
        {renderRegionSummaryCard('global', 'Spotify Top 50 Toàn Cầu', charts.global)}
      </div>

      {/* Custom Playlist Override & Auto-Sync Info */}
      <div className="p-5 rounded-2xl bg-[#141d3d] border border-[#222f5e] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-[#f7f5f0]">
              Nguồn Playlist BXH tuỳ chỉnh cho {selectedRegion === 'vn' ? 'Việt Nam' : 'Toàn cầu'} (tuỳ chọn)
            </h4>
            <p className="text-xs text-[#a3aed0] mt-0.5">
              Mặc định hệ thống lấy Top 50 Spotify chính thức. Admin có thể dán link Playlist Spotify khác nếu muốn ghi đè BXH khu vực đang chọn.
            </p>
          </div>
          {activeChart?.nextAutoSyncAt && (
            <span className="text-[11px] font-mono tabular-nums text-[#a3aed0] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#f47b64]" />
              Tự động kế tiếp: {formatSyncTime(activeChart.nextAutoSyncAt)}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="url"
            value={customUrlInput}
            onChange={(e) => setCustomUrlInput(e.target.value)}
            placeholder="https://open.spotify.com/playlist/..."
            className="flex-1 bg-[#0d142c] border border-[#222f5e] rounded-xl px-3.5 py-2.5 text-xs text-[#f7f5f0] focus:outline-none focus:border-[#f47b64]"
          />
          <button
            type="button"
            disabled={syncingTarget !== null || !customUrlInput.trim()}
            onClick={() =>
              handleSync(selectedRegion, { customSpotifyUrl: customUrlInput.trim() })
            }
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#1c2852] hover:bg-[#25356b] border border-[#2b3b75] text-xs font-bold text-[#f7f5f0] disabled:opacity-45 transition-colors whitespace-nowrap"
          >
            Áp dụng link này
          </button>
          {activeChart?.customSpotifyUrl && (
            <button
              type="button"
              disabled={syncingTarget !== null}
              onClick={() => handleSync(selectedRegion, { clearCustomUrl: true })}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0d142c] hover:bg-[#1c2852] border border-[#222f5e] text-xs font-semibold text-[#a3aed0] hover:text-[#f7f5f0] flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Về nguồn mặc định</span>
            </button>
          )}
        </div>
      </div>

      {/* Inspection Table (Matched Tracks vs Missing Trending Tracks) */}
      <div className="p-5 rounded-2xl bg-[#141d3d] border border-[#222f5e] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222f5e] pb-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0d142c] border border-[#222f5e]">
            <button
              type="button"
              onClick={() => setSelectedRegion('vn')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap ${
                selectedRegion === 'vn'
                  ? 'bg-[#f47b64] text-[#070b1a]'
                  : 'text-[#a3aed0] hover:text-[#f7f5f0]'
              }`}
            >
              Việt Nam ({charts.vn?.matchedCount ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setSelectedRegion('global')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap ${
                selectedRegion === 'global'
                  ? 'bg-[#f47b64] text-[#070b1a]'
                  : 'text-[#a3aed0] hover:text-[#f7f5f0]'
              }`}
            >
              Toàn cầu ({charts.global?.matchedCount ?? 0})
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0d142c] border border-[#222f5e]">
            <button
              type="button"
              onClick={() => setInspectTab('matched')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap ${
                inspectTab === 'matched'
                  ? 'bg-[#1c2852] text-[#f7f5f0]'
                  : 'text-[#a3aed0] hover:text-[#f7f5f0]'
              }`}
            >
              Đã khớp trên Soundly ({matchedTracks.length})
            </button>
            <button
              type="button"
              onClick={() => setInspectTab('missing')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap ${
                inspectTab === 'missing'
                  ? 'bg-[#1c2852] text-[#f7f5f0]'
                  : 'text-[#a3aed0] hover:text-[#f7f5f0]'
              }`}
            >
              Chưa có file ({activeChart?.missingEntries?.length ?? 0})
            </button>
          </div>
        </div>

        {inspectTab === 'matched' ? (
          matchedTracks.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#a3aed0]">
              Chưa có bài hát nào khớp cho khu vực này. Hãy bấm Đồng bộ ngay từ Spotify để cập nhật.
            </div>
          ) : (
            <div className="divide-y divide-[#1e2a54] max-h-[460px] overflow-y-auto pr-1">
              {matchedTracks.map(({ entry, track }, idx) => (
                <div
                  key={`${track.id}-${entry.spotifyRank}`}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-[#1c2852]/50 px-2 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 text-center font-mono tabular-nums font-bold text-[#f7f5f0]">
                      {idx + 1}
                    </span>
                    <span className="w-10 text-center font-mono tabular-nums text-[11px]">
                      {entry.isNew ? (
                        <span className="text-[#f47b64] font-bold">Mới</span>
                      ) : entry.rankDelta > 0 ? (
                        <span className="text-emerald-400 font-bold">▲{entry.rankDelta}</span>
                      ) : entry.rankDelta < 0 ? (
                        <span className="text-rose-400 font-bold">▼{Math.abs(entry.rankDelta)}</span>
                      ) : (
                        <span className="text-[#6e7ba8]">—</span>
                      )}
                    </span>
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p
                        className={`font-semibold truncate ${
                          currentTrack?.id === track.id ? 'text-[#f47b64]' : 'text-[#f7f5f0]'
                        }`}
                      >
                        {track.title}
                      </p>
                      <p className="text-[11px] text-[#a3aed0] truncate">
                        {track.artist} · Hạng Spotify #{entry.spotifyRank}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      playTrack(
                        track,
                        matchedTracks.map(m => m.track)
                      )
                    }
                    className="w-8 h-8 rounded-full bg-[#0d142c] hover:bg-[#f47b64] text-[#f7f5f0] hover:text-[#070b1a] flex items-center justify-center shrink-0 transition-colors"
                    title="Nghe thử"
                  >
                    <Play className="w-3.5 h-3.5 ml-0.5" />
                  </button>
                </div>
              ))}
            </div>
          )
        ) : !activeChart || activeChart.missingEntries.length === 0 ? (
          <div className="py-10 text-center text-xs text-[#a3aed0]">
            Kho nhạc của bạn đã khớp trọn vẹn BXH khu vực này!
          </div>
        ) : (
          <div className="divide-y divide-[#1e2a54] max-h-[460px] overflow-y-auto pr-1">
            {activeChart.missingEntries.map(item => (
              <div
                key={`miss-${item.spotifyRank}-${item.title}`}
                className="py-2.5 flex items-center justify-between gap-3 text-xs px-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 text-center font-mono tabular-nums font-bold text-[#a3aed0]">
                    #{item.spotifyRank}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-[#f7f5f0] truncate">{item.title}</p>
                    <p className="text-[11px] text-[#8d99be] truncate">{item.artist}</p>
                  </div>
                </div>
                {item.spotifyUrl && (
                  <a
                    href={item.spotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#f47b64] hover:underline flex items-center gap-1 shrink-0"
                  >
                    <span>Spotify</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
