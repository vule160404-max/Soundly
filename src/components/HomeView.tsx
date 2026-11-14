import React, { useMemo } from 'react';
import {
  Play,
  Pause,
  Music2,
  Sparkles,
  Compass,
  FolderPlus,
  Check,
  Plus,
  Disc3,
  Mic2,
  ArrowRight,
  TrendingUp,
  Globe,
  Headphones,
  Radio,
} from 'lucide-react';
import { Track, Playlist, ArtistProfile } from '../types/music';
import { TrackTable } from './TrackTable';
import { ArtistAvatar } from './ArtistAvatar';
import { usePlayer, getAutoVibePlaylists } from '../context/PlayerContext';
import { buildArtistDirectory } from '../utils/artistSync';
import {
  MUSIC_SPACES,
  MusicSpaceId,
  filterTracksBySpace,
} from '../utils/musicSpaces';

interface HomeViewProps {
  tracks: Track[];
  playlists: Playlist[];
  artists: ArtistProfile[];
  activeSpace: MusicSpaceId;
  onChangeSpace: (space: MusicSpaceId) => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onSelectArtist: (artist: ArtistProfile) => void;
  onSelectArtistByName: (artistName: string) => void;
  onOpenArtists: () => void;
  onExploreGenres: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  tracks,
  playlists,
  artists,
  activeSpace,
  onChangeSpace,
  onSelectPlaylist,
  onSelectArtist,
  onSelectArtistByName,
  onOpenArtists,
  onExploreGenres,
}) => {
  const {
    playTrack,
    currentTrack,
    isPlaying,
    togglePlay,
    userPlaylists,
    openAlbumPicker,
    openCreateAlbumModal,
    playRandomShuffle,
  } = usePlayer();

  const spaceCounts = useMemo(() => {
    const map: Record<MusicSpaceId, number> = {
      all: tracks.length,
      vn: filterTracksBySpace(tracks, 'vn').length,
      'us-uk': filterTracksBySpace(tracks, 'us-uk').length,
      kpop: filterTracksBySpace(tracks, 'kpop').length,
      chill: filterTracksBySpace(tracks, 'chill').length,
    };
    return map;
  }, [tracks]);

  const spaceTracks = useMemo(
    () => filterTracksBySpace(tracks, activeSpace),
    [tracks, activeSpace]
  );

  const spaceArtists = useMemo(
    () => (activeSpace === 'all' ? artists : buildArtistDirectory(spaceTracks)),
    [activeSpace, artists, spaceTracks]
  );

  const vibePlaylists = useMemo(
    () => getAutoVibePlaylists(spaceTracks, activeSpace),
    [spaceTracks, activeSpace]
  );

  const currentSpaceMeta = useMemo(
    () => MUSIC_SPACES.find(s => s.id === activeSpace) || MUSIC_SPACES[0],
    [activeSpace]
  );

  const getSpaceIcon = (spaceId: MusicSpaceId) => {
    if (spaceId === 'us-uk') return <Globe className="w-4 h-4 shrink-0" />;
    if (spaceId === 'vn') return <Music2 className="w-4 h-4 shrink-0" />;
    if (spaceId === 'kpop') return <Sparkles className="w-4 h-4 shrink-0" />;
    if (spaceId === 'chill') return <Headphones className="w-4 h-4 shrink-0" />;
    return <Radio className="w-4 h-4 shrink-0" />;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  };

  const quickPicks = useMemo(() => {
    const isReliable = (t: Track) => {
      const url = (t.audioUrl || '').trim();
      return (
        Boolean(url) &&
        !url.startsWith('blob:') &&
        !url.includes('/api/download/file/') &&
        !url.includes('onrender.com')
      );
    };
    const reliable = spaceTracks.filter(isReliable);
    const others = spaceTracks.filter((t) => !isReliable(t));
    return [...reliable, ...others].slice(0, 6);
  }, [spaceTracks]);

  const top50Tracks = useMemo(
    () =>
      [...spaceTracks]
        .sort(
          (a, b) =>
            (Number(b.plays) || 0) - (Number(a.plays) || 0) ||
            a.title.localeCompare(b.title, 'vi')
        )
        .slice(0, 50),
    [spaceTracks]
  );

  const handleQuickPlay = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, spaceTracks);
    }
  };

  return (
    <div className="space-y-8 pb-12 text-[#f7f5f0]">
      {/* Top Greeting Headline */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#f7f5f0]">
            {getGreeting()}
          </h2>
          <p className="text-xs text-[#a3aed0] mt-0.5">
            Soundly — Nghe nhạc hoàn toàn miễn phí, theo cách riêng của bạn
          </p>
        </div>
        <button
          onClick={onExploreGenres}
          className="text-xs font-bold text-[#a3aed0] hover:text-[#f7f5f0] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
        >
          <Compass className="w-4 h-4 text-[#f47b64]" />
          <span>Khám phá thể loại</span>
        </button>
      </div>

      {/* Empty Catalog Hero State when no tracks available yet */}
      {tracks.length === 0 ? (
        <section className="p-8 sm:p-12 rounded-2xl bg-gradient-to-br from-[#142152] via-[#0f183b] to-[#0b1129] border border-[#222f5e] text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#f47b64]/15 border border-[#f47b64]/35 flex items-center justify-center mx-auto text-[#f47b64]">
            <Music2 className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-xl sm:text-2xl font-black text-[#f7f5f0]">
              Không gian âm nhạc miễn phí của bạn
            </h3>
            <p className="text-xs sm:text-sm text-[#a3aed0] leading-relaxed">
              Thưởng thức âm nhạc hoàn toàn miễn phí, không quảng cáo, chất lượng âm thanh sắc nét cùng lời bài hát đồng bộ mượt mà trên mọi thiết bị.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onExploreGenres}
              className="px-6 py-3 rounded-full bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Khám phá kho thể loại</span>
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* Music Listening Spaces Selector */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-[#f7f5f0] tracking-tight flex items-center gap-2">
                  <Globe className="w-5 h-5 text-[#f47b64]" />
                  <span>Không gian nghe nhạc</span>
                </h3>
                <p className="text-xs text-[#a3aed0] mt-0.5">
                  Chuyển nhanh giữa không gian Nhạc Việt, US-UK quốc tế, K-Pop và Chill.
                </p>
              </div>
              {activeSpace !== 'all' && (
                <button
                  type="button"
                  onClick={() => onChangeSpace('all')}
                  className="text-xs font-bold text-[#f47b64] hover:text-[#ff8d76] whitespace-nowrap shrink-0"
                >
                  Xem tất cả
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
              {MUSIC_SPACES.map((space) => {
                const isActive = activeSpace === space.id;
                const count = spaceCounts[space.id];
                return (
                  <button
                    key={space.id}
                    type="button"
                    onClick={() => onChangeSpace(space.id)}
                    className={`min-h-[76px] p-3.5 rounded-2xl text-left transition-all duration-150 border flex flex-col justify-between gap-2 touch-manipulation ${
                      isActive
                        ? `bg-gradient-to-br ${space.accentGradient} border-[#f47b64] ring-1 ring-[#f47b64]/60 shadow-lg`
                        : 'bg-[#141d3d]/85 hover:bg-[#1c2852] border-[#1e2a54]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isActive
                            ? 'bg-[#f47b64] text-[#070b1a]'
                            : 'bg-[#0d142c] text-[#f47b64] border border-[#222f5e]'
                        }`}
                      >
                        {getSpaceIcon(space.id)}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-[#a3aed0]">
                        {count} bài
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-[#f7f5f0] truncate">
                        {space.shortTitle}
                      </p>
                      <p className="text-[11px] text-[#a3aed0] truncate mt-0.5">
                        {space.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Space Banner when inside a dedicated space (e.g. US-UK) */}
            {activeSpace !== 'all' && (
              <div
                className={`p-5 sm:p-6 rounded-2xl bg-gradient-to-r ${currentSpaceMeta.accentGradient} border border-[#2b3b75] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl`}
              >
                <div className="space-y-1 min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#f47b64]">
                    Đang nghe trong không gian
                  </p>
                  <h3 className="text-xl sm:text-2xl font-black text-[#f7f5f0] tracking-tight">
                    {currentSpaceMeta.title}
                  </h3>
                  <p className="text-xs text-[#cbd5f5] max-w-2xl leading-relaxed">
                    {currentSpaceMeta.description} ({spaceTracks.length} bài hát · {spaceArtists.length} nghệ sĩ)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={spaceTracks.length === 0}
                    onClick={() => {
                      if (spaceTracks.length > 0) playTrack(spaceTracks[0], spaceTracks);
                    }}
                    className="min-h-[44px] px-5 py-2.5 rounded-full bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] font-extrabold text-xs flex items-center gap-2 shadow-lg active:scale-95 disabled:opacity-40 transition-all whitespace-nowrap"
                  >
                    <Play className="w-4 h-4 fill-[#070b1a]" />
                    <span>Phát ngay</span>
                  </button>
                  <button
                    type="button"
                    disabled={spaceTracks.length === 0}
                    onClick={() => playRandomShuffle(spaceTracks)}
                    className="min-h-[44px] px-4 py-2.5 rounded-full bg-[#0d142c]/80 hover:bg-[#162047] border border-[#2b3b75] text-[#f7f5f0] font-bold text-xs flex items-center gap-2 active:scale-95 disabled:opacity-40 transition-all whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#f47b64]" />
                    <span>Trộn ngẫu nhiên</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Soundly 6-card Quick Picks Grid */}
          {quickPicks.length > 0 ? (
            <section>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                {quickPicks.map((track) => {
                  const isCurrent = currentTrack?.id === track.id;
                  const isThisPlaying = isCurrent && isPlaying;
                  const isInAlbum = userPlaylists.some((pl) => pl.trackIds.includes(track.id));

                  return (
                    <div
                      key={track.id}
                      onClick={() => playTrack(track, spaceTracks)}
                      className={`group flex items-center justify-between rounded-lg bg-[#141d3d]/85 hover:bg-[#1c2852] border border-[#1e2a54] md:hover:-translate-y-0.5 transition-colors duration-150 cursor-pointer overflow-hidden ${
                        isCurrent ? 'bg-[#1c2852] border-[#f47b64]/45' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 pr-2">
                        <img
                          src={track.coverUrl}
                          alt={track.title}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 object-cover shrink-0 shadow-md"
                        />
                        <div className="min-w-0">
                          <p
                            className={`text-xs sm:text-sm font-bold truncate ${
                              isCurrent ? 'text-[#f47b64]' : 'text-[#f7f5f0]'
                            }`}
                          >
                            {track.title}
                          </p>
                          <p className="text-[11px] text-[#a3aed0] truncate mt-0.5">
                            {track.artist}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pr-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAlbumPicker(track);
                          }}
                          title={isInAlbum ? 'Đã lưu trong album • Nhấn để quản lý' : 'Thêm vào album của bạn'}
                          className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${
                            isInAlbum
                              ? 'bg-[#f47b64]/15 text-[#f47b64] border-[#f47b64]/45'
                              : 'bg-[#0d142c]/80 text-[#a3aed0] border-[#222f5e] hover:text-[#f7f5f0] hover:border-[#f47b64]/50'
                          }`}
                        >
                          {isInAlbum ? (
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          ) : (
                            <FolderPlus className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={(e) => handleQuickPlay(track, e)}
                          title={isThisPlaying ? 'Tạm dừng' : 'Phát bài hát'}
                          className={`w-9 h-9 rounded-full bg-[#f47b64] text-[#070b1a] flex items-center justify-center shrink-0 shadow-xl hover:scale-105 active:scale-95 transition-all ${
                            isThisPlaying
                              ? 'opacity-100 scale-100'
                              : 'opacity-90 sm:opacity-0 sm:translate-y-1 sm:group-hover:opacity-100 sm:group-hover:translate-y-0'
                          }`}
                        >
                          <Play className="w-4 h-4 fill-[#070b1a] ml-0.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            <section className="p-8 rounded-2xl bg-[#141d3d]/60 border border-[#1e2a54] text-center space-y-3">
              <Globe className="w-8 h-8 text-[#f47b64]/60 mx-auto" />
              <p className="text-sm font-bold text-[#f7f5f0]">
                Chưa có bài hát nào trong {currentSpaceMeta.title}
              </p>
              <p className="text-xs text-[#a3aed0] max-w-md mx-auto">
                Hãy tải thêm nhạc hoặc chạy AI Phân loại để tự động sắp xếp bài hát vào không gian này.
              </p>
              <button
                type="button"
                onClick={() => onChangeSpace('all')}
                className="px-4 py-2 rounded-full bg-[#f47b64] text-[#070b1a] font-bold text-xs"
              >
                Quay lại tất cả không gian
              </button>
            </section>
          )}

          {/* Featured Artists (Spotify-style circular cards) */}
          {spaceArtists.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-[#f7f5f0] tracking-tight flex items-center gap-2">
                  <Mic2 className="w-5 h-5 text-[#f47b64]" />
                  <span>
                    {activeSpace === 'us-uk'
                      ? 'Nghệ sĩ US-UK & Quốc Tế'
                      : activeSpace === 'vn'
                        ? 'Nghệ sĩ Việt Nam'
                        : 'Nghệ sĩ trên Soundly'}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={onOpenArtists}
                  className="text-xs font-bold text-[#a3aed0] hover:text-[#f7f5f0] flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Hiện tất cả ({spaceArtists.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {spaceArtists.slice(0, 6).map((artist) => {
                  const isArtistActive =
                    currentTrack &&
                    artist.tracks.some((t) => t.id === currentTrack.id);
                  const isArtistPlaying = Boolean(isArtistActive && isPlaying);

                  return (
                    <div
                      key={artist.id}
                      onClick={() => onSelectArtist(artist)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectArtist(artist);
                        }
                      }}
                      className="group p-3.5 rounded-2xl bg-[#141d3d]/85 hover:bg-[#1c2852] border border-[#1e2a54] md:hover:-translate-y-0.5 transition-colors duration-150 cursor-pointer flex flex-col items-center text-center"
                    >
                      <div className="relative w-24 h-24 sm:w-28 sm:h-28">
                        <ArtistAvatar
                          artist={artist}
                          sizeClass="w-full h-full"
                          textSizeClass="text-2xl"
                          className="group-hover:scale-[1.03] transition-transform"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (artist.tracks.length === 0) return;
                            if (isArtistPlaying) {
                              togglePlay();
                            } else {
                              playTrack(artist.tracks[0], artist.tracks);
                            }
                          }}
                          aria-label={
                            isArtistPlaying
                              ? `Tạm dừng nhạc của ${artist.name}`
                              : `Phát nhạc của ${artist.name}`
                          }
                          className={`absolute right-0 bottom-0 w-9 h-9 rounded-full bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all ${
                            isArtistPlaying
                              ? 'opacity-100 translate-y-0'
                              : 'opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0'
                          }`}
                        >
                          {isArtistPlaying ? (
                            <Pause className="w-4 h-4 fill-[#070b1a]" />
                          ) : (
                            <Play className="w-4 h-4 fill-[#070b1a] ml-0.5" />
                          )}
                        </button>
                      </div>

                      <h4
                        className={`text-xs sm:text-sm font-bold truncate w-full mt-3 ${
                          isArtistActive ? 'text-[#f47b64]' : 'text-[#f7f5f0]'
                        }`}
                      >
                        {artist.name}
                      </h4>
                      <p className="text-[11px] text-[#a3aed0] mt-0.5 truncate w-full tabular-nums">
                        Nghệ sĩ · {artist.trackCount} bài hát
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Auto-Generated Mood & Vibe Albums Section */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-xl font-bold text-[#f7f5f0] tracking-tight flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#f47b64]" />
                  <span>Album tâm trạng & Vibe (Tự động phân loại)</span>
                </h3>
                <p className="text-xs text-[#a3aed0] mt-0.5">
                  Nhạc chill, nhạc suy, vui vẻ yêu đời, lofi hay acoustic được tổng hợp tự động theo gu âm nhạc của bạn.
                </p>
              </div>

              <button
                type="button"
                onClick={() => playRandomShuffle(spaceTracks)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] font-extrabold text-xs shadow-lg hover:scale-105 active:scale-95 transition-all shrink-0 self-start sm:self-auto"
              >
                <Play className="w-3.5 h-3.5 fill-[#070b1a]" />
                <span>
                  {activeSpace === 'all'
                    ? 'Phát ngẫu nhiên tất cả (Shuffle)'
                    : `Phát ngẫu nhiên ${currentSpaceMeta.shortTitle}`}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
              {vibePlaylists.map((vibe) => (
                <div
                  key={vibe.id}
                  onClick={() => onSelectPlaylist(vibe)}
                  role="button"
                  tabIndex={0}
                  className="group p-3.5 rounded-2xl bg-[#141d3d]/85 hover:bg-[#1c2852] border border-[#1e2a54] md:hover:-translate-y-0.5 transition-colors duration-150 cursor-pointer flex flex-col justify-between"
                >
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-3 shadow-md bg-[#0d142c]">
                    <img
                      src={vibe.coverUrl}
                      alt={vibe.title}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover md:group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                      <span className="text-[11px] font-bold text-white bg-[#f47b64] px-2 py-0.5 rounded-full">
                        {vibe.trackIds.length} bài
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#f7f5f0] truncate">
                      {vibe.title}
                    </h4>
                    <p className="text-[11px] text-[#a3aed0] line-clamp-1 mt-0.5">
                      {vibe.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Personal Albums Section */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-xl font-bold text-[#f7f5f0] tracking-tight flex items-center gap-2">
                <Disc3 className="w-5 h-5 text-[#f47b64]" />
                <span>Album thư viện của bạn</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openCreateAlbumModal('spotify')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f47b64]/15 hover:bg-[#f47b64]/25 border border-[#f47b64]/40 text-xs font-bold text-[#ff9d8a] transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#f47b64]" />
                  <span>Tạo từ link Spotify</span>
                </button>
                <button
                  type="button"
                  onClick={() => openCreateAlbumModal('manual')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#141d3d] hover:bg-[#1c2852] border border-[#222f5e] hover:border-[#f47b64]/50 text-xs font-bold text-[#f7f5f0] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-[#f47b64]" />
                  <span>Tạo album mới</span>
                </button>
              </div>
            </div>

            {userPlaylists.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {userPlaylists.map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => onSelectPlaylist(pl)}
                    className="group p-3 bg-[#141d3d] hover:bg-[#1c2852] border border-[#1e2a54] rounded-xl md:hover:-translate-y-0.5 transition-colors duration-150 cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative aspect-square rounded-lg overflow-hidden mb-2.5 shadow-md bg-[#162047]">
                        <img
                          src={pl.coverUrl}
                          alt={pl.title}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute right-2 bottom-2 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
                          <div className="w-9 h-9 rounded-full bg-[#f47b64] text-[#070b1a] flex items-center justify-center shadow-xl">
                            <Play className="w-4 h-4 fill-[#070b1a] ml-0.5" />
                          </div>
                        </div>
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#f7f5f0] truncate">{pl.title}</h4>
                      <p className="text-[11px] text-[#a3aed0] mt-0.5">
                        {pl.trackIds.length} bài hát
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#141d3d]/60 border border-dashed border-[#222f5e] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-[#f7f5f0]">Chưa có album cá nhân nào</p>
                  <p className="text-[11px] text-[#a3aed0] mt-0.5">
                    Dán link Album/Playlist từ Spotify để Soundly tự động gom đủ bài hát hoặc tạo album riêng của bạn.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openCreateAlbumModal('spotify')}
                    className="px-4 py-2 rounded-full bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] font-extrabold text-xs shrink-0 transition-colors flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Dán link Spotify</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openCreateAlbumModal('manual')}
                    className="px-3.5 py-2 rounded-full bg-[#162047] hover:bg-[#1e2c60] text-[#f7f5f0] font-bold text-xs shrink-0 transition-colors border border-white/10"
                  >
                    + Tạo thủ công
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Top 50 Most Played Tracks on Soundly */}
          <section>
            <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xl font-bold text-[#f7f5f0] tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#f47b64]" />
                  <span>
                    {activeSpace === 'us-uk'
                      ? 'Top 50 US-UK nghe nhiều nhất'
                      : activeSpace === 'vn'
                        ? 'Top 50 Nhạc Việt nghe nhiều nhất'
                        : 'Top 50 nghe nhiều nhất'}
                  </span>
                </h3>
                <p className="text-xs text-[#a3aed0] mt-0.5">
                  {activeSpace === 'all'
                    ? 'Bảng xếp hạng những bản nhạc được nghe nhiều nhất trên Soundly'
                    : `Những bản nhạc nổi bật nhất trong ${currentSpaceMeta.title}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#a3aed0] font-mono tabular-nums">
                  Top {top50Tracks.length} bản nhạc
                </span>
                <button
                  type="button"
                  onClick={onExploreGenres}
                  className="text-xs font-bold text-[#f47b64] hover:text-[#ff8d76] flex items-center gap-1 active:scale-95 transition-all"
                >
                  <span>Xem kho nhạc</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="bg-[#0d142c] rounded-xl p-2 border border-[#1e2a54]/60">
              <TrackTable
                tracks={top50Tracks}
                showRankAndPlays
                onSelectArtist={onSelectArtistByName}
              />
            </div>
          </section>
        </>
      )}

      {/* Soundly Playlists Cards Grid (if any public playlists exist) */}
      {playlists.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-[#f7f5f0] tracking-tight">
              Tuyển tập dành cho bạn
            </h3>
            <button
              onClick={onExploreGenres}
              className="text-xs font-bold text-[#a3aed0] hover:text-[#f7f5f0] uppercase tracking-wider active:scale-95 transition-all"
            >
              Hiện tất cả
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => onSelectPlaylist(pl)}
                className="group p-4 bg-[#141d3d] hover:bg-[#1c2852] border border-[#1e2a54] rounded-xl md:hover:-translate-y-0.5 transition-colors duration-150 cursor-pointer flex flex-col justify-between relative"
              >
                <div>
                  <div className="relative aspect-square rounded-lg overflow-hidden mb-3.5 shadow-lg">
                    <img
                      src={pl.coverUrl}
                      alt={pl.title}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute right-2 bottom-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                      <div className="w-11 h-11 rounded-full bg-[#f47b64] text-[#070b1a] flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95">
                        <Play className="w-5 h-5 fill-[#070b1a] ml-0.5" />
                      </div>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-[#f7f5f0] truncate">{pl.title}</h4>
                  <p className="text-xs text-[#a3aed0] mt-1.5 line-clamp-2 leading-relaxed">
                    {pl.description}
                  </p>
                </div>

                <div className="mt-3 text-[11px] font-semibold text-[#7f8bb3]">
                  {pl.trackIds.length} bài hát
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
