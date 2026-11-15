import React, { useMemo, useState } from 'react';
import {
  Disc3,
  Link2,
  Sparkles,
  Loader2,
  CheckCircle2,
  Check,
  AlertCircle,
  Search,
  XCircle,
  Plus,
  Trash2,
  Pencil,
  Play,
  Pause,
  ListMusic,
  X,
} from 'lucide-react';
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
import { normalizeSearchText } from '../utils/artistSync';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { SPOTIFY_GENRE_NAMES } from '../data/mockTracks';

interface AdminPublicAlbumsTabProps {
  tracks: Track[];
  publicAlbums: Playlist[];
  onPublicAlbumsUpdated: (albums: Playlist[]) => void;
  onNotify: (message: string) => void;
}

interface ScannedSpotifyItem {
  index: number;
  spotifyItem: SpotifyParsedTrackItem;
  matchedTrack: Track | null;
  isOnR2: boolean;
}

const DEFAULT_COVER = '/assets/aistudio/soundly-default-cover.svg';

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

export const AdminPublicAlbumsTab: React.FC<AdminPublicAlbumsTabProps> = ({
  tracks,
  publicAlbums,
  onPublicAlbumsUpdated,
  onNotify,
}) => {
  const { user } = useAuth();
  const { playTrack, currentTrack, isPlaying, togglePlay, openConfirmDialog } =
    usePlayer();

  const [createMode, setCreateMode] = useState<'spotify' | 'manual'>('spotify');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Spotify import state
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [isFetchingSpotify, setIsFetchingSpotify] = useState(false);
  const [parsedCollection, setParsedCollection] =
    useState<SpotifyParsedCollection | null>(null);
  const [spotifySelectedIds, setSpotifySelectedIds] = useState<Set<string>>(
    new Set()
  );
  const [spotifyFilterTab, setSpotifyFilterTab] = useState<
    'all' | 'matched' | 'missing'
  >('all');

  // Manual track picker state
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [manualGenreFilter, setManualGenreFilter] = useState('all');
  const [manualSelectedIds, setManualSelectedIds] = useState<Set<string>>(
    new Set()
  );

  // Manage existing album state
  const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null);
  const [manageAddSearch, setManageAddSearch] = useState('');
  const [editingAlbum, setEditingAlbum] = useState<Playlist | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [albumListFilter, setAlbumListFilter] = useState('');

  const trackById = useMemo(() => {
    const map = new Map<string, Track>();
    for (const t of tracks) {
      map.set(t.id, t);
    }
    return map;
  }, [tracks]);

  const scannedItems = useMemo<ScannedSpotifyItem[]>(() => {
    if (!parsedCollection) return [];
    return parsedCollection.tracks.map((spItem, idx) => {
      let matched = findDuplicateTrack(
        {
          spotifyTrackId: spItem.spotifyTrackId,
          title: spItem.title,
          artist: spItem.artist,
        },
        tracks
      );
      if (!matched) {
        const normSpTitle = normalizeTrackTitle(spItem.title);
        if (normSpTitle.length >= 2) {
          const candidates = tracks.filter(
            t => normalizeTrackTitle(t.title) === normSpTitle
          );
          if (candidates.length === 1) {
            matched = candidates[0];
          } else if (candidates.length > 1) {
            matched =
              candidates.find(t => isR2AudioUrl(t.audioUrl)) || candidates[0];
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
  }, [parsedCollection, tracks]);

  const matchedSpotifyItems = useMemo(
    () => scannedItems.filter(i => i.matchedTrack !== null),
    [scannedItems]
  );

  const missingSpotifyItems = useMemo(
    () => scannedItems.filter(i => i.matchedTrack === null),
    [scannedItems]
  );

  const visibleSpotifyItems = useMemo(() => {
    if (spotifyFilterTab === 'matched') return matchedSpotifyItems;
    if (spotifyFilterTab === 'missing') return missingSpotifyItems;
    return scannedItems;
  }, [
    scannedItems,
    matchedSpotifyItems,
    missingSpotifyItems,
    spotifyFilterTab,
  ]);

  const filteredManualCatalog = useMemo(() => {
    const q = normalizeSearchText(manualSearchQuery);
    return tracks
      .filter(t => {
        if (
          manualGenreFilter !== 'all' &&
          (t.genre || '').toLowerCase() !== manualGenreFilter.toLowerCase()
        ) {
          return false;
        }
        if (!q) return true;
        return (
          normalizeSearchText(t.title).includes(q) ||
          normalizeSearchText(t.artist).includes(q) ||
          normalizeSearchText(t.album || '').includes(q)
        );
      })
      .slice(0, 80);
  }, [tracks, manualSearchQuery, manualGenreFilter]);

  const filteredPublicAlbums = useMemo(() => {
    const q = normalizeSearchText(albumListFilter);
    if (!q) return publicAlbums;
    return publicAlbums.filter(
      a =>
        normalizeSearchText(a.title).includes(q) ||
        normalizeSearchText(a.description || '').includes(q)
    );
  }, [publicAlbums, albumListFilter]);

  const handleFetchSpotify = async (urlOverride?: string) => {
    const target = (urlOverride ?? spotifyUrl).trim();
    if (!target) {
      setFormError('Vui lòng dán đường dẫn Album hoặc Playlist từ Spotify.');
      return;
    }

    setIsFetchingSpotify(true);
    setFormError(null);
    setSpotifyFilterTab('all');

    try {
      const result = await musicApi.parseSpotifyAlbumUrl(target);
      setParsedCollection(result);
      setTitle(prev => prev.trim() || result.title);
      setDescription(
        prev => prev.trim() || `Album tuyển chọn · ${result.artist}`
      );
      setCoverUrl(prev => prev.trim() || result.coverUrl || '');

      const matchedIds = new Set<string>();
      for (const spItem of result.tracks) {
        let matched = findDuplicateTrack(
          {
            spotifyTrackId: spItem.spotifyTrackId,
            title: spItem.title,
            artist: spItem.artist,
          },
          tracks
        );
        if (!matched) {
          const normTitle = normalizeTrackTitle(spItem.title);
          if (normTitle.length >= 2) {
            const cands = tracks.filter(
              t => normalizeTrackTitle(t.title) === normTitle
            );
            if (cands.length > 0) {
              matched = cands.find(t => isR2AudioUrl(t.audioUrl)) || cands[0];
            }
          }
        }
        if (matched) matchedIds.add(matched.id);
      }
      setSpotifySelectedIds(matchedIds);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Không thể lấy thông tin Album/Playlist từ đường dẫn Spotify này.'
      );
    } finally {
      setIsFetchingSpotify(false);
    }
  };

  const handleSpotifyPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
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

  const toggleSetId = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string
  ) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetCreationForm = () => {
    setTitle('');
    setDescription('');
    setCoverUrl('');
    setFormError(null);
    setSpotifyUrl('');
    setParsedCollection(null);
    setSpotifySelectedIds(new Set());
    setManualSelectedIds(new Set());
    setManualSearchQuery('');
  };

  const handleCreatePublicAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError('Vui lòng nhập tên Album (ví dụ: Lofi chill, Vui vẻ yêu đời).');
      return;
    }

    const chosenTrackIds =
      createMode === 'spotify'
        ? Array.from(spotifySelectedIds)
        : Array.from(manualSelectedIds);

    const firstSelectedTrack = chosenTrackIds
      .map(id => trackById.get(id))
      .find(Boolean);

    const resolvedCover =
      coverUrl.trim() ||
      parsedCollection?.coverUrl ||
      firstSelectedTrack?.coverUrl ||
      DEFAULT_COVER;

    setIsSaving(true);
    setFormError(null);

    try {
      const saved = await musicApi.savePublicAlbum({
        id: `public-album-${Date.now()}`,
        title: cleanTitle,
        description:
          description.trim() || 'Album tuyển chọn trên Soundly',
        coverUrl: resolvedCover,
        trackIds: chosenTrackIds,
        isPublic: true,
        createdBy: user?.email || undefined,
        ...(createMode === 'spotify' && spotifyUrl.trim()
          ? { spotifyUrl: spotifyUrl.trim() }
          : {}),
      });

      const updated = [saved, ...publicAlbums.filter(a => a.id !== saved.id)];
      onPublicAlbumsUpdated(updated);
      resetCreationForm();
      setExpandedAlbumId(saved.id);
      onNotify(
        `Đã tạo Album công khai "${saved.title}" (${saved.trackIds.length} bài hát). Người dùng có thể tìm kiếm để mở!`
      );
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Không thể lưu Album công khai lúc này.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateAlbumTracks = async (
    album: Playlist,
    nextTrackIds: string[]
  ) => {
    const firstTrackCover = nextTrackIds
      .map(id => trackById.get(id)?.coverUrl)
      .find(c => c && c !== DEFAULT_COVER);
    const nextCover =
      album.coverUrl === DEFAULT_COVER && firstTrackCover
        ? firstTrackCover
        : album.coverUrl;

    const saved = await musicApi.savePublicAlbum({
      ...album,
      coverUrl: nextCover,
      trackIds: nextTrackIds,
    });
    onPublicAlbumsUpdated(
      publicAlbums.map(a => (a.id === saved.id ? saved : a))
    );
  };

  const handleSaveAlbumInfo = async () => {
    if (!editingAlbum) return;
    const cleanTitle = editTitle.trim();
    if (!cleanTitle) return;
    setIsSaving(true);
    try {
      const saved = await musicApi.savePublicAlbum({
        ...editingAlbum,
        title: cleanTitle,
        description: editDescription.trim(),
        coverUrl: editCoverUrl.trim() || editingAlbum.coverUrl || DEFAULT_COVER,
      });
      onPublicAlbumsUpdated(
        publicAlbums.map(a => (a.id === saved.id ? saved : a))
      );
      setEditingAlbum(null);
      onNotify(`Đã cập nhật thông tin album "${saved.title}".`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAlbum = (album: Playlist) => {
    openConfirmDialog({
      title: 'Xóa Album công khai khỏi ứng dụng',
      description:
        'Album này sẽ không còn xuất hiện trong kết quả tìm kiếm của người dùng:',
      highlight: album.title,
      confirmLabel: 'Xóa Album',
      cancelLabel: 'Giữ lại',
      tone: 'danger',
      onConfirm: async () => {
        await musicApi.deletePublicAlbum(album.id);
        onPublicAlbumsUpdated(publicAlbums.filter(a => a.id !== album.id));
        if (expandedAlbumId === album.id) setExpandedAlbumId(null);
        onNotify(`Đã xóa Album "${album.title}".`);
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Create Public App Album Panel */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#141d3d] border border-[#222f5e] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#f7f5f0] flex items-center gap-2">
              <Disc3 className="w-5 h-5 text-[#f47b64]" />
              <span>Thêm Album cho ứng dụng (Tìm kiếm công khai)</span>
            </h3>
            <p className="text-xs text-[#a3aed0] mt-1">
              Tạo các album theo chủ đề như Lofi chill, Vui vẻ yêu đời... Các album này sẽ không hiển thị ở Trang chủ mà chỉ xuất hiện khi người dùng gõ tìm kiếm.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-[#0d142c] p-1 rounded-xl border border-[#222f5e] self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                setCreateMode('spotify');
                setFormError(null);
              }}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                createMode === 'spotify'
                  ? 'bg-[#f47b64] text-[#070b1a]'
                  : 'text-[#a3aed0] hover:text-[#f7f5f0]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Dán link Spotify</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateMode('manual');
                setFormError(null);
              }}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                createMode === 'manual'
                  ? 'bg-[#f47b64] text-[#070b1a]'
                  : 'text-[#a3aed0] hover:text-[#f7f5f0]'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo thủ công</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleCreatePublicAlbum} className="space-y-4">
          {createMode === 'spotify' && (
            <div className="p-4 rounded-xl bg-[#0d142c] border border-[#222f5e] space-y-3">
              <label className="text-xs font-bold text-[#f7f5f0] block">
                Dán đường dẫn Album hoặc Playlist từ Spotify
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Link2 className="w-4 h-4 text-[#a3aed0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={spotifyUrl}
                    onChange={e => setSpotifyUrl(e.target.value)}
                    onPaste={handleSpotifyPaste}
                    placeholder="https://open.spotify.com/playlist/... hoặc album/..."
                    className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl bg-[#141d3d] border border-[#222f5e] focus:border-[#f47b64] text-xs text-[#f7f5f0] placeholder-[#6875a3] outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleFetchSpotify()}
                  disabled={isFetchingSpotify || !spotifyUrl.trim()}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] font-extrabold text-xs disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap"
                >
                  {isFetchingSpotify ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>
                    {isFetchingSpotify ? 'Đang quét...' : 'Quét bài hát'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {formError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Album Title, Description & Optional Cover */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-semibold text-[#a3aed0] block mb-1">
                Tên Album hiển thị khi tìm kiếm <span className="text-[#f47b64]">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="VD: Lofi chill, Vui vẻ yêu đời, Nhạc Acoustic đêm khuya..."
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0d142c] border border-[#222f5e] focus:border-[#f47b64] text-xs sm:text-sm text-[#f7f5f0] placeholder-[#6875a3] outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#a3aed0] block mb-1">
                Mô tả ngắn (tùy chọn)
              </label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="VD: Những bản nhạc nhẹ nhàng giúp thư giãn và tập trung..."
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#0d142c] border border-[#222f5e] focus:border-[#f47b64] text-xs sm:text-sm text-[#f7f5f0] placeholder-[#6875a3] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#a3aed0] block mb-1">
              URL Ảnh bìa Album (tùy chọn — mặc định lấy từ Spotify hoặc bài hát đầu tiên)
            </label>
            <input
              type="text"
              value={coverUrl}
              onChange={e => setCoverUrl(e.target.value)}
              placeholder="Để trống để tự động dùng ảnh bìa phù hợp..."
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0d142c] border border-[#222f5e] focus:border-[#f47b64] text-xs text-[#f7f5f0] placeholder-[#6875a3] outline-none"
            />
          </div>

          {/* Spotify Scanned Results */}
          {createMode === 'spotify' && parsedCollection && (
            <div className="p-4 rounded-xl bg-[#0d142c] border border-[#222f5e] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#1e2a54]">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={parsedCollection.coverUrl || DEFAULT_COVER}
                    alt={parsedCollection.title}
                    referrerPolicy="no-referrer"
                    onError={e => {
                      e.currentTarget.src = DEFAULT_COVER;
                    }}
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#f7f5f0] truncate">
                      {parsedCollection.title}
                    </p>
                    <p className="text-[11px] text-[#a3aed0] tabular-nums">
                      Khớp {matchedSpotifyItems.length}/{scannedItems.length} bài có sẵn trên Soundly · Đã chọn {spotifySelectedIds.size} bài
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { id: 'all', label: `Tất cả (${scannedItems.length})` },
                      { id: 'matched', label: `Có sẵn (${matchedSpotifyItems.length})` },
                      { id: 'missing', label: `Chưa có (${missingSpotifyItems.length})` },
                    ] as const
                  ).map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSpotifyFilterTab(tab.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                        spotifyFilterTab === tab.id
                          ? 'bg-[#f47b64] text-[#070b1a]'
                          : 'bg-[#141d3d] text-[#a3aed0] hover:text-[#f7f5f0]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                {visibleSpotifyItems.map(item => {
                  const matched = item.matchedTrack;
                  const checked = matched ? spotifySelectedIds.has(matched.id) : false;
                  return (
                    <div
                      key={`${item.index}-${item.spotifyItem.spotifyTrackId}`}
                      onClick={() => {
                        if (matched) toggleSetId(setSpotifySelectedIds, matched.id);
                      }}
                      className={`flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-xs ${
                        matched
                          ? 'hover:bg-[#162047] cursor-pointer'
                          : 'opacity-55'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {matched ? (
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                              checked
                                ? 'bg-[#f47b64] border-[#f47b64] text-[#070b1a]'
                                : 'border-[#334480]'
                            }`}
                          >
                            {checked && <Check className="w-3 h-3 stroke-[3]" />}
                          </span>
                        ) : (
                          <XCircle className="w-4 h-4 text-[#7f8bb3] shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-[#f7f5f0] truncate">
                            {matched ? matched.title : item.spotifyItem.title}
                          </p>
                          <p className="text-[11px] text-[#8d99be] truncate">
                            {matched ? matched.artist : item.spotifyItem.artist}
                          </p>
                        </div>
                      </div>

                      <span className="text-[11px] text-[#8d99be] font-mono shrink-0">
                        {matched ? 'Có trên Soundly' : 'Chưa có file'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Manual Track Picker */}
          {createMode === 'manual' && (
            <div className="p-4 rounded-xl bg-[#0d142c] border border-[#222f5e] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-[#f7f5f0]">
                    Chọn bài hát thêm vào Album ({manualSelectedIds.size} bài đã chọn)
                  </p>
                  <p className="text-[11px] text-[#8d99be]">
                    Tìm tên bài hát hoặc ca sĩ trong kho Soundly để tích chọn vào album này (có thể bổ sung thêm sau).
                  </p>
                </div>

                {manualSelectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setManualSelectedIds(new Set())}
                    className="text-[11px] font-bold text-rose-300 hover:text-rose-200 self-start sm:self-auto"
                  >
                    Bỏ chọn tất cả
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#8d99be] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={manualSearchQuery}
                    onChange={e => setManualSearchQuery(e.target.value)}
                    placeholder="Tìm bài hát, nghệ sĩ trong kho nhạc..."
                    className="w-full min-h-[40px] pl-9 pr-3 py-1.5 rounded-lg bg-[#141d3d] border border-[#222f5e] focus:border-[#f47b64] text-xs text-[#f7f5f0] outline-none"
                  />
                </div>
                <select
                  value={manualGenreFilter}
                  onChange={e => setManualGenreFilter(e.target.value)}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[#141d3d] border border-[#222f5e] text-xs font-semibold text-[#f7f5f0] outline-none focus:border-[#f47b64]"
                >
                  <option value="all">Tất cả thể loại</option>
                  {SPOTIFY_GENRE_NAMES.map(g => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                {filteredManualCatalog.length === 0 ? (
                  <p className="text-xs text-[#8d99be] py-6 text-center">
                    Không tìm thấy bài hát phù hợp.
                  </p>
                ) : (
                  filteredManualCatalog.map(track => {
                    const isSelected = manualSelectedIds.has(track.id);
                    return (
                      <div
                        key={track.id}
                        onClick={() =>
                          toggleSetId(setManualSelectedIds, track.id)
                        }
                        className={`flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#f47b64]/15 border border-[#f47b64]/40'
                            : 'hover:bg-[#162047] border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                              isSelected
                                ? 'bg-[#f47b64] border-[#f47b64] text-[#070b1a]'
                                : 'border-[#334480]'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </span>
                          <img
                            src={track.coverUrl || DEFAULT_COVER}
                            alt={track.title}
                            loading="lazy"
                            onError={e => {
                              e.currentTarget.src = DEFAULT_COVER;
                            }}
                            className="w-9 h-9 rounded object-cover shrink-0 bg-[#141d3d]"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#f7f5f0] truncate">
                              {track.title}
                            </p>
                            <p className="text-[11px] text-[#8d99be] truncate">
                              {track.artist} · {track.genre}
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-[#8d99be] shrink-0">
                          {formatDuration(track.duration)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            {(title || description || parsedCollection || manualSelectedIds.size > 0) && (
              <button
                type="button"
                onClick={resetCreationForm}
                className="min-h-[42px] px-4 py-2 rounded-full bg-[#0d142c] hover:bg-[#1c2852] text-xs font-semibold text-[#a3aed0]"
              >
                Làm mới form
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving || !title.trim()}
              className="min-h-[44px] px-6 py-2.5 rounded-full bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] font-extrabold text-xs shadow-lg disabled:opacity-50 flex items-center gap-2 transition-all"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              )}
              <span>
                {isSaving ? 'Đang lưu Album...' : 'Tạo Album công khai'}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Existing Public App Albums Management */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#141d3d] border border-[#222f5e] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#f7f5f0] flex items-center gap-2">
              <ListMusic className="w-5 h-5 text-[#f47b64]" />
              <span>Danh sách Album trên App ({publicAlbums.length})</span>
            </h3>
            <p className="text-xs text-[#a3aed0] mt-0.5">
              Tất cả người dùng có thể gõ tên các album bên dưới vào thanh tìm kiếm để nghe.
            </p>
          </div>

          {publicAlbums.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-[#8d99be] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={albumListFilter}
                onChange={e => setAlbumListFilter(e.target.value)}
                placeholder="Lọc album đã tạo..."
                className="w-full min-h-[40px] pl-9 pr-3 py-1.5 rounded-xl bg-[#0d142c] border border-[#222f5e] focus:border-[#f47b64] text-xs text-[#f7f5f0] outline-none"
              />
            </div>
          )}
        </div>

        {filteredPublicAlbums.length === 0 ? (
          <div className="py-12 text-center rounded-xl bg-[#0d142c]/60 border border-dashed border-[#222f5e] space-y-2">
            <Disc3 className="w-8 h-8 text-[#f47b64]/50 mx-auto" />
            <p className="text-sm font-bold text-[#f7f5f0]">
              {publicAlbums.length === 0
                ? 'Chưa có Album công khai nào trên hệ thống'
                : 'Không tìm thấy Album phù hợp'}
            </p>
            <p className="text-xs text-[#8d99be] max-w-md mx-auto">
              Tạo album bằng form phía trên (dán link Spotify hoặc tạo thủ công). Album sẽ xuất hiện ngay khi người dùng tìm kiếm tên album.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPublicAlbums.map(album => {
              const isExpanded = expandedAlbumId === album.id;
              const albumTracks = album.trackIds
                .map(id => trackById.get(id))
                .filter((t): t is Track => Boolean(t));
              const addCandidates = isExpanded
                ? tracks
                    .filter(t => !album.trackIds.includes(t.id))
                    .filter(t => {
                      const q = normalizeSearchText(manageAddSearch);
                      if (!q) return true;
                      return (
                        normalizeSearchText(t.title).includes(q) ||
                        normalizeSearchText(t.artist).includes(q)
                      );
                    })
                    .slice(0, 30)
                : [];

              return (
                <div
                  key={album.id}
                  className="rounded-xl bg-[#0d142c] border border-[#222f5e] overflow-hidden"
                >
                  <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <img
                        src={album.coverUrl || DEFAULT_COVER}
                        alt={album.title}
                        referrerPolicy="no-referrer"
                        onError={e => {
                          e.currentTarget.src = DEFAULT_COVER;
                        }}
                        className="w-14 h-14 rounded-lg object-cover shrink-0 bg-[#141d3d]"
                      />
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-[#f7f5f0] truncate">
                          {album.title}
                        </h4>
                        <p className="text-xs text-[#a3aed0] truncate mt-0.5">
                          {album.description || 'Album tuyển chọn trên Soundly'}
                        </p>
                        <p className="text-[11px] text-[#7f8bb3] mt-1 tabular-nums">
                          {albumTracks.length} bài hát · Chỉ hiển thị khi tìm kiếm
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedAlbumId(isExpanded ? null : album.id);
                          setManageAddSearch('');
                        }}
                        className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                          isExpanded
                            ? 'bg-[#f47b64] text-[#070b1a]'
                            : 'bg-[#141d3d] hover:bg-[#1c2852] text-[#f7f5f0] border border-[#222f5e]'
                        }`}
                      >
                        <ListMusic className="w-3.5 h-3.5" />
                        <span>{isExpanded ? 'Đóng danh sách' : 'Quản lý bài hát'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingAlbum(album);
                          setEditTitle(album.title);
                          setEditDescription(album.description || '');
                          setEditCoverUrl(album.coverUrl || '');
                        }}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#141d3d] hover:bg-[#1c2852] border border-[#222f5e] text-xs font-semibold text-[#a3aed0] hover:text-[#f7f5f0] flex items-center gap-1.5"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Sửa</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteAlbum(album)}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#141d3d] hover:bg-rose-950/60 border border-[#222f5e] hover:border-rose-500/40 text-xs font-semibold text-rose-400 flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Inline Track Manager */}
                  {isExpanded && (
                    <div className="border-t border-[#1e2a54] p-4 bg-[#0a1024] grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left: Current Tracks inside Album */}
                      <div className="space-y-2.5">
                        <p className="text-xs font-bold text-[#f7f5f0]">
                          Bài hát đang có trong album ({albumTracks.length})
                        </p>
                        <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                          {albumTracks.length === 0 ? (
                            <p className="text-xs text-[#8d99be] py-6 text-center rounded-lg border border-dashed border-[#1e2a54]">
                              Album này chưa có bài hát nào. Chọn bài bên cạnh để thêm vào!
                            </p>
                          ) : (
                            albumTracks.map((song, idx) => {
                              const isCurrent = currentTrack?.id === song.id;
                              const isSongPlaying = isCurrent && isPlaying;
                              return (
                                <div
                                  key={song.id}
                                  className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[#141d3d]/70 hover:bg-[#141d3d]"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (isCurrent) togglePlay();
                                        else playTrack(song, albumTracks);
                                      }}
                                      className="w-7 h-7 rounded-full bg-[#0d142c] text-[#f47b64] flex items-center justify-center shrink-0"
                                      aria-label={isSongPlaying ? 'Tạm dừng' : 'Phát thử'}
                                    >
                                      {isSongPlaying ? (
                                        <Pause className="w-3.5 h-3.5 fill-current" />
                                      ) : (
                                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                      )}
                                    </button>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-[#f7f5f0] truncate">
                                        {idx + 1}. {song.title}
                                      </p>
                                      <p className="text-[11px] text-[#8d99be] truncate">
                                        {song.artist}
                                      </p>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleUpdateAlbumTracks(
                                        album,
                                        album.trackIds.filter(id => id !== song.id)
                                      )
                                    }
                                    className="p-1.5 text-[#8d99be] hover:text-rose-400 rounded-lg shrink-0"
                                    title="Gỡ khỏi album"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Right: Add Tracks from Catalog */}
                      <div className="space-y-2.5">
                        <p className="text-xs font-bold text-[#f7f5f0]">
                          Thêm bài hát từ kho Soundly
                        </p>
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-[#8d99be] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={manageAddSearch}
                            onChange={e => setManageAddSearch(e.target.value)}
                            placeholder="Tìm tên bài hát hoặc ca sĩ để thêm..."
                            className="w-full min-h-[38px] pl-8 pr-3 py-1.5 rounded-lg bg-[#141d3d] border border-[#222f5e] focus:border-[#f47b64] text-xs text-[#f7f5f0] outline-none"
                          />
                        </div>

                        <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                          {addCandidates.map(song => (
                            <div
                              key={song.id}
                              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#141d3d]"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img
                                  src={song.coverUrl || DEFAULT_COVER}
                                  alt={song.title}
                                  loading="lazy"
                                  onError={e => {
                                    e.currentTarget.src = DEFAULT_COVER;
                                  }}
                                  className="w-8 h-8 rounded object-cover shrink-0 bg-[#141d3d]"
                                />
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-[#f7f5f0] truncate">
                                    {song.title}
                                  </p>
                                  <p className="text-[11px] text-[#8d99be] truncate">
                                    {song.artist}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleUpdateAlbumTracks(album, [
                                    ...album.trackIds,
                                    song.id,
                                  ])
                                }
                                className="px-2.5 py-1 rounded-lg bg-[#f47b64]/15 hover:bg-[#f47b64] text-[#f47b64] hover:text-[#070b1a] text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Thêm</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Public Album Metadata Modal */}
      {editingAlbum && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d142c] border border-[#222f5e] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#f7f5f0]">
                Chỉnh sửa Album trên App
              </h3>
              <button
                type="button"
                onClick={() => setEditingAlbum(null)}
                className="text-[#8d99be] hover:text-[#f7f5f0] p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#a3aed0] mb-1">
                  Tên Album
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full min-h-[42px] bg-[#152046] border border-[#222f5e] rounded-xl px-3.5 py-2 text-[#f7f5f0] outline-none focus:border-[#f47b64]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#a3aed0] mb-1">
                  Mô tả
                </label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  className="w-full min-h-[42px] bg-[#152046] border border-[#222f5e] rounded-xl px-3.5 py-2 text-[#f7f5f0] outline-none focus:border-[#f47b64]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#a3aed0] mb-1">
                  URL Ảnh bìa
                </label>
                <input
                  type="text"
                  value={editCoverUrl}
                  onChange={e => setEditCoverUrl(e.target.value)}
                  className="w-full min-h-[42px] bg-[#152046] border border-[#222f5e] rounded-xl px-3.5 py-2 text-[#f7f5f0] outline-none focus:border-[#f47b64]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingAlbum(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#152046] text-[#a3aed0] text-xs font-bold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleSaveAlbumInfo()}
                disabled={isSaving || !editTitle.trim()}
                className="min-h-[40px] px-5 py-2 rounded-xl bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] text-xs font-extrabold disabled:opacity-50"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
