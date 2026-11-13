import React, { useState, useEffect, useMemo } from 'react';
import {
  Disc3,
  X,
  Link2,
  Sparkles,
  Loader2,
  CheckCircle2,
  Check,
  AlertCircle,
  Search,
  XCircle,
  Copy,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { Playlist, Track } from '../types/music';
import {
  musicApi,
  SpotifyParsedCollection,
  SpotifyParsedTrackItem,
} from '../services/api';
import {
  findDuplicateTrack,
  isR2AudioUrl,
  normalizeTrackTitle,
} from '../utils/trackDedupe';

interface CreateAlbumModalProps {
  allTracks?: Track[];
  onTracksAdded?: (tracks: Track[]) => void;
  onCreated?: (playlist: Playlist) => void;
}

interface ScannedSpotifyTrackItem {
  index: number;
  spotifyItem: SpotifyParsedTrackItem;
  matchedTrack: Track | null;
  isOnR2: boolean;
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

export const CreateAlbumModal: React.FC<CreateAlbumModalProps> = ({
  allTracks = [],
  onCreated,
}) => {
  const {
    isCreateAlbumModalOpen,
    setIsCreateAlbumModalOpen,
    createAlbumModalInitialMode,
    userPlaylists,
    createPlaylist,
  } = usePlayer();

  const [mode, setMode] = useState<'spotify' | 'manual'>('spotify');

  // Manual form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Spotify scan states
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [isFetchingSpotify, setIsFetchingSpotify] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const [parsedCollection, setParsedCollection] =
    useState<SpotifyParsedCollection | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(
    new Set()
  );
  const [filterTab, setFilterTab] = useState<'all' | 'matched' | 'missing'>(
    'all'
  );
  const [copiedMissing, setCopiedMissing] = useState(false);

  useEffect(() => {
    if (!isCreateAlbumModalOpen) return;
    setMode(createAlbumModalInitialMode || 'spotify');
    setTitle('');
    setDescription('');
    setSpotifyUrl('');
    setSpotifyError(null);
    setParsedCollection(null);
    setSelectedTrackIds(new Set());
    setFilterTab('all');
    setCopiedMissing(false);
    setIsFetchingSpotify(false);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCreateAlbumModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isCreateAlbumModalOpen,
    createAlbumModalInitialMode,
    setIsCreateAlbumModalOpen,
  ]);

  // Scan Spotify tracklist strictly against tracks already in the Soundly app
  const scannedItems = useMemo<ScannedSpotifyTrackItem[]>(() => {
    if (!parsedCollection) return [];

    return parsedCollection.tracks.map((spItem, idx) => {
      // 1. Match by spotifyTrackId or normalized Vietnamese title + artist
      let matched = findDuplicateTrack(
        {
          spotifyTrackId: spItem.spotifyTrackId,
          title: spItem.title,
          artist: spItem.artist,
        },
        allTracks
      );

      // 2. Fallback: match by normalized core title if present in Soundly catalog
      if (!matched) {
        const normSpTitle = normalizeTrackTitle(spItem.title);
        if (normSpTitle.length >= 2) {
          const sameTitleCandidates = allTracks.filter(
            (t) => normalizeTrackTitle(t.title) === normSpTitle
          );
          if (sameTitleCandidates.length === 1) {
            matched = sameTitleCandidates[0];
          } else if (sameTitleCandidates.length > 1) {
            matched =
              sameTitleCandidates.find((t) => isR2AudioUrl(t.audioUrl)) ||
              sameTitleCandidates[0];
          }
        }
      }

      return {
        index: idx + 1,
        spotifyItem: spItem,
        matchedTrack: matched,
        isOnR2: matched ? isR2AudioUrl(matched.audioUrl) : false,
      };
    });
  }, [parsedCollection, allTracks]);

  const matchedItems = useMemo(
    () => scannedItems.filter((item) => item.matchedTrack !== null),
    [scannedItems]
  );

  const missingItems = useMemo(
    () => scannedItems.filter((item) => item.matchedTrack === null),
    [scannedItems]
  );

  const visibleItems = useMemo(() => {
    if (filterTab === 'matched') return matchedItems;
    if (filterTab === 'missing') return missingItems;
    return scannedItems;
  }, [scannedItems, matchedItems, missingItems, filterTab]);

  // Automatically select all matched tracks whenever scan results update
  useEffect(() => {
    const ids = new Set<string>();
    for (const item of matchedItems) {
      if (item.matchedTrack) {
        ids.add(item.matchedTrack.id);
      }
    }
    setSelectedTrackIds(ids);
  }, [matchedItems]);

  if (!isCreateAlbumModalOpen) return null;

  const handleFetchSpotify = async (urlToFetch?: string) => {
    const targetUrl = (urlToFetch ?? spotifyUrl).trim();
    if (!targetUrl) {
      setSpotifyError(
        'Vui lòng dán đường dẫn Album hoặc Playlist từ Spotify.'
      );
      return;
    }

    setIsFetchingSpotify(true);
    setSpotifyError(null);
    setFilterTab('all');

    try {
      const result = await musicApi.parseSpotifyAlbumUrl(targetUrl);
      setParsedCollection(result);
      setTitle(result.title);
      setDescription(
        `Album từ Spotify • ${result.artist}`
      );
    } catch (err) {
      setSpotifyError(
        err instanceof Error
          ? err.message
          : 'Không thể lấy danh sách bài hát từ link Spotify này.'
      );
    } finally {
      setIsFetchingSpotify(false);
    }
  };

  const handleSpotifyInputPaste = (
    e: React.ClipboardEvent<HTMLInputElement>
  ) => {
    const pasted = e.clipboardData.getData('text').trim();
    if (
      pasted &&
      (pasted.includes('spotify.com/') ||
        pasted.startsWith('spotify:') ||
        pasted.includes('spotify.link/') ||
        pasted.includes('spoti.fi/'))
    ) {
      e.preventDefault();
      setSpotifyUrl(pasted);
      void handleFetchSpotify(pasted);
    }
  };

  const toggleSelectMatchedTrack = (trackId: string) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  };

  const handleCopyMissingList = async () => {
    if (missingItems.length === 0) return;
    const text = missingItems
      .map(
        (item, idx) =>
          `${idx + 1}. ${item.spotifyItem.title} - ${item.spotifyItem.artist}`
      )
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMissing(true);
      setTimeout(() => setCopiedMissing(false), 2200);
    } catch {
      // ignore clipboard error
    }
  };

  const handleCreateFromSpotify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedCollection) {
      await handleFetchSpotify();
      return;
    }

    const finalTitle =
      title.trim() ||
      parsedCollection.title ||
      `Album Spotify #${userPlaylists.length + 1}`;
    const finalDesc =
      description.trim() ||
      `Đồng bộ từ Spotify • ${parsedCollection.artist} (${selectedTrackIds.size}/${parsedCollection.tracks.length} bài có sẵn)`;

    // Keep original Spotify album order for all selected existing Soundly tracks
    const orderedTrackIds: string[] = [];
    for (const item of matchedItems) {
      if (
        item.matchedTrack &&
        selectedTrackIds.has(item.matchedTrack.id) &&
        !orderedTrackIds.includes(item.matchedTrack.id)
      ) {
        orderedTrackIds.push(item.matchedTrack.id);
      }
    }

    const newAlbum = createPlaylist(finalTitle, finalDesc, undefined, {
      trackIds: orderedTrackIds,
      coverUrl: parsedCollection.coverUrl,
    });

    setIsCreateAlbumModalOpen(false);
    if (onCreated) onCreated(newAlbum);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle =
      title.trim() || `Album của tôi #${userPlaylists.length + 1}`;
    const newAlbum = createPlaylist(finalTitle, description);
    setIsCreateAlbumModalOpen(false);
    if (onCreated) onCreated(newAlbum);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-album-title"
      className="fixed inset-0 z-50 bg-[#040714]/80 backdrop-blur-md flex items-end sm:items-center justify-center p-2.5 sm:p-4 soundly-backdrop soundly-modal-safe"
      onClick={() => setIsCreateAlbumModalOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[580px] max-h-[85dvh] sm:max-h-[90vh] flex flex-col bg-[#0e1633]/95 backdrop-blur-xl rounded-3xl ring-1 ring-white/10 shadow-[0_24px_64px_-12px_rgba(3,7,22,0.92)] overflow-hidden text-[#f7f5f0] soundly-modal relative"
      >
        <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-32 rounded-full bg-[#f47b64]/18 blur-3xl" />

        <div className="relative p-5 sm:p-6 flex flex-col min-h-0 flex-1 space-y-4 overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-[#f47b64]/12 ring-1 ring-[#f47b64]/25 flex items-center justify-center text-[#f47b64] shrink-0">
                <Disc3 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3
                  id="create-album-title"
                  className="text-base font-bold text-[#f7f5f0]"
                >
                  Tạo album mới
                </h3>
                <p className="text-xs text-[#a3aed0] mt-0.5">
                  Quét bài hát có sẵn trong Soundly từ link Spotify hoặc tạo thủ công
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCreateAlbumModalOpen(false)}
              aria-label="Đóng hộp thoại"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/10 text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-white/10 active:scale-95 transition-all shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#090f24] border border-white/[0.07] shrink-0">
            <button
              type="button"
              onClick={() => setMode('spotify')}
              className={`min-h-[42px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                mode === 'spotify'
                  ? 'bg-[#f47b64] text-[#070b1a] shadow-md shadow-[#f47b64]/20'
                  : 'text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-white/[0.04]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Dán link Spotify</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`min-h-[42px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                mode === 'manual'
                  ? 'bg-[#f47b64] text-[#070b1a] shadow-md shadow-[#f47b64]/20'
                  : 'text-[#a3aed0] hover:text-[#f7f5f0] hover:bg-white/[0.04]'
              }`}
            >
              <Disc3 className="w-3.5 h-3.5" />
              <span>Tạo thủ công</span>
            </button>
          </div>

          {mode === 'spotify' ? (
            <form
              onSubmit={handleCreateFromSpotify}
              className="space-y-4 flex flex-col min-h-0"
            >
              {/* Spotify Link Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="spotify-album-url-input"
                  className="text-xs font-semibold text-[#d6ddf5] flex items-center justify-between"
                >
                  <span>Link Album hoặc Playlist Spotify</span>
                  <span className="text-[11px] font-normal text-[#8d99be]">
                    Tự động đối chiếu với kho nhạc Soundly
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Link2 className="w-4 h-4 text-[#7f8bb3] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="spotify-album-url-input"
                      type="text"
                      autoFocus
                      value={spotifyUrl}
                      onChange={(e) => {
                        setSpotifyUrl(e.target.value);
                        if (spotifyError) setSpotifyError(null);
                      }}
                      onPaste={handleSpotifyInputPaste}
                      placeholder="https://open.spotify.com/album/... hoặc /playlist/..."
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded-xl bg-[#152046]/80 border border-white/[0.08] focus:border-[#f47b64] focus:ring-2 focus:ring-[#f47b64]/20 text-base sm:text-sm text-[#f7f5f0] placeholder-[#6e7ba8] outline-none transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleFetchSpotify()}
                    disabled={isFetchingSpotify || !spotifyUrl.trim()}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1c2b5e] hover:bg-[#253775] disabled:opacity-45 text-xs font-bold text-[#f7f5f0] border border-white/10 flex items-center gap-1.5 shrink-0 transition-all"
                  >
                    {isFetchingSpotify ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#f47b64]" />
                        <span>Đang quét...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5 text-[#f47b64]" />
                        <span>Quét bài hát</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {spotifyError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs text-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{spotifyError}</span>
                </div>
              )}

              {/* Parsed & Scanned Spotify Album Report */}
              {parsedCollection && (
                <div className="space-y-3.5">
                  {/* Album Hero + Editable Name */}
                  <div className="p-3.5 rounded-2xl bg-[#131d42]/90 border border-white/[0.08] flex items-center gap-3.5">
                    <img
                      src={parsedCollection.coverUrl}
                      alt={parsedCollection.title}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shadow-lg shrink-0 ring-1 ring-white/10"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div>
                        <label
                          htmlFor="spotify-parsed-title"
                          className="text-[11px] font-semibold text-[#8d99be] block mb-1"
                        >
                          Tên album trên Soundly
                        </label>
                        <input
                          id="spotify-parsed-title"
                          type="text"
                          maxLength={100}
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-[#0b1129] border border-white/10 focus:border-[#f47b64] text-xs sm:text-sm font-bold text-[#f7f5f0] outline-none"
                        />
                      </div>
                      <p className="text-[11px] text-[#a3aed0] truncate">
                        Nghệ sĩ / Nguồn:{' '}
                        <strong className="text-[#f7f5f0]">
                          {parsedCollection.artist}
                        </strong>{' '}
                        • Tổng cộng {parsedCollection.tracks.length} bài trên Spotify
                      </p>
                    </div>
                  </div>

                  {/* Scan Summary Cards: Found vs Missing */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold text-emerald-300/90">
                          Đã có sẵn trong app
                        </p>
                        <p className="text-base sm:text-lg font-extrabold text-emerald-300 mt-0.5 tabular-nums">
                          {matchedItems.length} / {scannedItems.length} bài
                        </p>
                      </div>
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    </div>

                    <div
                      className={`p-3 rounded-2xl border flex items-center justify-between ${
                        missingItems.length > 0
                          ? 'bg-amber-500/10 border-amber-500/25'
                          : 'bg-white/[0.03] border-white/[0.08]'
                      }`}
                    >
                      <div>
                        <p
                          className={`text-[11px] font-semibold ${
                            missingItems.length > 0
                              ? 'text-amber-300/90'
                              : 'text-[#8d99be]'
                          }`}
                        >
                          Còn thiếu (chưa tải lên)
                        </p>
                        <p
                          className={`text-base sm:text-lg font-extrabold mt-0.5 tabular-nums ${
                            missingItems.length > 0
                              ? 'text-amber-300'
                              : 'text-[#f7f5f0]'
                          }`}
                        >
                          {missingItems.length} bài
                        </p>
                      </div>
                      <XCircle
                        className={`w-6 h-6 shrink-0 ${
                          missingItems.length > 0
                            ? 'text-amber-400'
                            : 'text-[#6e7ba8]'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Filter Tabs + Copy Missing Button */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-[#090f24] border border-white/[0.07]">
                      <button
                        type="button"
                        onClick={() => setFilterTab('all')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                          filterTab === 'all'
                            ? 'bg-[#1c2b5e] text-[#f7f5f0]'
                            : 'text-[#8d99be] hover:text-[#f7f5f0]'
                        }`}
                      >
                        Tất cả ({scannedItems.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterTab('matched')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                          filterTab === 'matched'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'text-[#8d99be] hover:text-emerald-300'
                        }`}
                      >
                        Đã có ({matchedItems.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterTab('missing')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                          filterTab === 'missing'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'text-[#8d99be] hover:text-amber-300'
                        }`}
                      >
                        Còn thiếu ({missingItems.length})
                      </button>
                    </div>

                    {missingItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void handleCopyMissingList()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-[11px] font-semibold text-[#d6ddf5] transition-colors"
                      >
                        {copiedMissing ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-300">
                              Đã chép tên {missingItems.length} bài thiếu
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-[#f47b64]" />
                            <span>Chép danh sách bài thiếu</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Detailed Tracklist Scan Results */}
                  <div className="max-h-56 overflow-y-auto rounded-2xl bg-[#090f24]/90 border border-white/[0.07] divide-y divide-white/[0.05]">
                    {visibleItems.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#8d99be]">
                        {filterTab === 'matched'
                          ? 'Chưa có bài hát nào trong album này nằm sẵn trong kho nhạc Soundly.'
                          : 'Tuyệt vời! Không còn thiếu bài hát nào.'}
                      </div>
                    ) : (
                      visibleItems.map((item) => {
                        const matched = item.matchedTrack;
                        const isSelected = matched
                          ? selectedTrackIds.has(matched.id)
                          : false;

                        return (
                          <div
                            key={`${item.spotifyItem.spotifyTrackId}-${item.index}`}
                            onClick={() => {
                              if (matched) toggleSelectMatchedTrack(matched.id);
                            }}
                            className={`flex items-center gap-3 px-3.5 py-2.5 transition-colors ${
                              matched
                                ? 'cursor-pointer bg-emerald-500/[0.03] hover:bg-emerald-500/[0.08]'
                                : 'bg-transparent opacity-75'
                            }`}
                          >
                            {matched ? (
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                                  isSelected
                                    ? 'bg-emerald-400 border-emerald-400 text-[#070b1a]'
                                    : 'border-white/25 bg-transparent'
                                }`}
                              >
                                {isSelected && (
                                  <Check className="w-3 h-3 stroke-[3]" />
                                )}
                              </div>
                            ) : (
                              <div className="w-4 h-4 rounded flex items-center justify-center shrink-0 border border-amber-500/35 bg-amber-500/10 text-amber-400">
                                <X className="w-2.5 h-2.5 stroke-[2.5]" />
                              </div>
                            )}

                            <span className="w-5 text-[11px] font-mono text-[#7f8bb3] tabular-nums shrink-0">
                              {item.index}
                            </span>

                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-[#f7f5f0] truncate">
                                {item.spotifyItem.title}
                              </p>
                              <p className="text-[11px] text-[#8d99be] truncate">
                                {item.spotifyItem.artist}
                              </p>
                            </div>

                            {matched ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300 shrink-0">
                                <CheckCircle2 className="w-3 h-3" />
                                Đã có sẵn
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-300 shrink-0">
                                <XCircle className="w-3 h-3" />
                                Còn thiếu
                              </span>
                            )}

                            <span className="text-[11px] font-mono text-[#7f8bb3] tabular-nums shrink-0">
                              {formatDuration(item.spotifyItem.duration)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Empty helper state before pasting link */}
              {!parsedCollection && !isFetchingSpotify && !spotifyError && (
                <div className="p-4 rounded-2xl bg-[#111a3a]/60 border border-white/[0.06] text-xs text-[#9aa6cc] space-y-1.5 leading-relaxed">
                  <p className="font-semibold text-[#d6ddf5]">
                    Cách hoạt động:
                  </p>
                  <p>
                    1. Dán liên kết <strong>Album hoặc Playlist từ Spotify</strong> vào ô bên trên.
                  </p>
                  <p>
                    2. Soundly sẽ tự động quét kho nhạc hiện có trong ứng dụng, báo cáo chi tiết <strong>đã có bao nhiêu bài</strong> và <strong>còn thiếu những bài nào</strong> để tạo album ngay.
                  </p>
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateAlbumModalOpen(false)}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.11] text-xs sm:text-sm font-semibold text-[#d6ddf5] transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={
                    isFetchingSpotify ||
                    (!parsedCollection && !spotifyUrl.trim())
                  }
                  className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#f47b64] hover:bg-[#ff8d76] disabled:opacity-45 text-[#070b1a] shadow-lg shadow-[#f47b64]/20 active:scale-[0.98] transition-all flex items-center gap-2"
                >
                  {parsedCollection ? (
                    <span>
                      Tạo album ({selectedTrackIds.size}/
                      {parsedCollection.tracks.length} bài có sẵn)
                    </span>
                  ) : (
                    <span>Quét Album Spotify</span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="album-title-input"
                  className="text-xs font-semibold text-[#d6ddf5] block"
                >
                  Tên album
                </label>
                <input
                  id="album-title-input"
                  type="text"
                  autoFocus
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`Album của tôi #${userPlaylists.length + 1}`}
                  className="w-full px-4 py-3 rounded-xl bg-[#152046]/80 border border-white/[0.08] focus:border-[#f47b64] focus:ring-2 focus:ring-[#f47b64]/20 text-sm text-[#f7f5f0] placeholder-[#6e7ba8] outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="album-desc-input"
                  className="text-xs font-semibold text-[#d6ddf5] block"
                >
                  Mô tả ngắn{' '}
                  <span className="text-[#7f8bb3] font-normal">(tuỳ chọn)</span>
                </label>
                <textarea
                  id="album-desc-input"
                  rows={2}
                  maxLength={250}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ghi chú tâm trạng hoặc chủ đề của album..."
                  className="w-full px-4 py-3 rounded-xl bg-[#152046]/80 border border-white/[0.08] focus:border-[#f47b64] focus:ring-2 focus:ring-[#f47b64]/20 text-sm text-[#f7f5f0] placeholder-[#6e7ba8] outline-none transition-all resize-none"
                />
              </div>

              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateAlbumModalOpen(false)}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.11] text-xs sm:text-sm font-semibold text-[#d6ddf5] transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] shadow-lg shadow-[#f47b64]/20 active:scale-[0.98] transition-all"
                >
                  Tạo album
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
