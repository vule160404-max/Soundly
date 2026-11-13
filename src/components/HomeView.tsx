import React from 'react';
import { Play, Pause, Music2, Sparkles, Compass, FolderPlus, Check, Plus, Disc3, Mic2, ArrowRight } from 'lucide-react';
import { Track, Playlist, ArtistProfile } from '../types/music';
import { TrackTable } from './TrackTable';
import { ArtistAvatar } from './ArtistAvatar';
import { usePlayer } from '../context/PlayerContext';

interface HomeViewProps {
  tracks: Track[];
  playlists: Playlist[];
  artists: ArtistProfile[];
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
    setIsCreateAlbumModalOpen,
  } = usePlayer();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  };

  const quickPicks = tracks.slice(0, 6);

  const handleQuickPlay = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, tracks);
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
          {/* Soundly 6-card Quick Picks Grid */}
          <section>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
              {quickPicks.map((track) => {
                const isCurrent = currentTrack?.id === track.id;
                const isThisPlaying = isCurrent && isPlaying;
                const isInAlbum = userPlaylists.some((pl) => pl.trackIds.includes(track.id));

                return (
                  <div
                    key={track.id}
                    onClick={() => playTrack(track, tracks)}
                    className={`group flex items-center justify-between rounded-lg bg-[#141d3d]/85 hover:bg-[#1c2852] border border-[#1e2a54] transition-colors cursor-pointer overflow-hidden ${
                      isCurrent ? 'bg-[#1c2852] border-[#f47b64]/45' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 pr-2">
                      <img
                        src={track.coverUrl}
                        alt={track.title}
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

          {/* Featured Artists (Spotify-style circular cards) */}
          {artists.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-[#f7f5f0] tracking-tight flex items-center gap-2">
                  <Mic2 className="w-5 h-5 text-[#f47b64]" />
                  <span>Nghệ sĩ trên Soundly</span>
                </h3>
                <button
                  type="button"
                  onClick={onOpenArtists}
                  className="text-xs font-bold text-[#a3aed0] hover:text-[#f7f5f0] flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Hiện tất cả ({artists.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {artists.slice(0, 6).map((artist) => {
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
                      className="group p-3.5 rounded-2xl bg-[#141d3d]/85 hover:bg-[#1c2852] border border-[#1e2a54] transition-all cursor-pointer flex flex-col items-center text-center"
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

          {/* Personal Albums Section */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold text-[#f7f5f0] tracking-tight flex items-center gap-2">
                <Disc3 className="w-5 h-5 text-[#f47b64]" />
                <span>Album thư viện của bạn</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateAlbumModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#141d3d] hover:bg-[#1c2852] border border-[#222f5e] hover:border-[#f47b64]/50 text-xs font-bold text-[#f7f5f0] transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-[#f47b64]" />
                <span>Tạo album mới</span>
              </button>
            </div>

            {userPlaylists.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {userPlaylists.map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => onSelectPlaylist(pl)}
                    className="group p-3 bg-[#141d3d] hover:bg-[#1c2852] border border-[#1e2a54] rounded-xl transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative aspect-square rounded-lg overflow-hidden mb-2.5 shadow-md bg-[#162047]">
                        <img
                          src={pl.coverUrl}
                          alt={pl.title}
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
                    Tạo album riêng rồi bấm nút thêm (+) trên từng bài hát để lưu vào bộ sưu tập của bạn.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateAlbumModalOpen(true)}
                  className="px-4 py-2 rounded-full bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] font-extrabold text-xs shrink-0 transition-colors"
                >
                  + Tạo album ngay
                </button>
              </div>
            )}
          </section>

          {/* All Available Tracks Table */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold text-[#f7f5f0] tracking-tight flex items-center gap-2">
                <span>Toàn bộ kho nhạc</span>
              </h3>
              <span className="text-xs text-[#a3aed0] font-mono tabular-nums">
                {tracks.length} bản nhạc
              </span>
            </div>

            <div className="bg-[#0d142c] rounded-xl p-2">
              <TrackTable tracks={tracks} onSelectArtist={onSelectArtistByName} />
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
              className="text-xs font-bold text-[#a3aed0] hover:text-[#f7f5f0] uppercase tracking-wider"
            >
              Hiện tất cả
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => onSelectPlaylist(pl)}
                className="group p-4 bg-[#141d3d] hover:bg-[#1c2852] border border-[#1e2a54] rounded-xl transition-all duration-300 cursor-pointer flex flex-col justify-between relative"
              >
                <div>
                  <div className="relative aspect-square rounded-lg overflow-hidden mb-3.5 shadow-lg">
                    <img
                      src={pl.coverUrl}
                      alt={pl.title}
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
