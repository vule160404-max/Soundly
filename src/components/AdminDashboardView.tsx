import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  Music,
  Upload,
  Trash2,
  Play,
  Pause,
  CheckCircle2,
  FileAudio,
  Layers,
  Sparkles,
  Clock,
  Radio,
  Wand2,
  Loader2,
  AlertCircle,
  Cloud,
  HardDrive,
  Key,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { musicApi } from '../services/api';
import { Track } from '../types/music';
import { SPOTIFY_GENRE_NAMES } from '../data/mockTracks';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

interface AdminDashboardViewProps {
  tracks: Track[];
  onTracksUpdated: (tracks: Track[]) => void;
}

interface UserProfileDoc {
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  lastLoginAt?: string;
}

interface StagedFile {
  file: File;
  id: string;
  fileName: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  mood?: string;
  bpm?: number;
  aiClassified: boolean;
  aiReason?: string;
  duration: number;
  objectUrl: string;
  sizeFormatted: string;
  lyricsText?: string;
}

function getAudioDuration(objectUrl: string): Promise<number> {
  return new Promise(resolve => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = objectUrl;
    const timeout = setTimeout(() => resolve(210), 2500);
    audio.onloadedmetadata = () => {
      clearTimeout(timeout);
      const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.duration) : 210;
      resolve(dur);
    };
    audio.onerror = () => {
      clearTimeout(timeout);
      resolve(210);
    };
  });
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  tracks,
  onTracksUpdated,
}) => {
  const { user, isAdmin } = useAuth();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();

  const [activeTab, setActiveTab] = useState<'upload' | 'users' | 'tracks' | 'spotflow' | 'r2'>('upload');
  const [usersList, setUsersList] = useState<UserProfileDoc[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);

  // Cloudflare R2 Storage State
  const [r2Status, setR2Status] = useState<{
    isConfigured: boolean;
    accountId: string;
    bucketName: string;
    publicDomain: string;
    missingVars?: string[];
    serverError?: string;
  }>({ isConfigured: false, accountId: '', bucketName: '', publicDomain: '', missingVars: [] });
  const [isTestingR2, setIsTestingR2] = useState<boolean>(false);
  const [r2Notice, setR2Notice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);

  // SpotFlow MP3 integration state
  const [spotflowUrl, setSpotflowUrl] = useState<string>('');
  const [spotflowApiKey, setSpotflowApiKey] = useState<string>('');
  const [spotflowSaveToR2, setSpotflowSaveToR2] = useState<boolean>(true);
  const [isSyncingSpotflow, setIsSyncingSpotflow] = useState<boolean>(false);
  const [spotflowMessage, setSpotflowMessage] = useState<string | null>(null);

  // Batch upload state (FILES ONLY, NO URLS!)
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isClassifyingAI, setIsClassifyingAI] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccessToast, setUploadSuccessToast] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [defaultBatchGenre, setDefaultBatchGenre] = useState<string>('AUTO_AI');
  const [isReclassifyingCatalog, setIsReclassifyingCatalog] = useState<boolean>(false);

  // Fetch logged in users list from Firestore
  useEffect(() => {
    let isMounted = true;

    async function fetchUsers() {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const users: UserProfileDoc[] = [];
        querySnapshot.forEach(docSnap => {
          users.push(docSnap.data() as UserProfileDoc);
        });

        if (isMounted) {
          if (users.length === 0 && user) {
            users.push({
              userId: user.uid,
              email: user.email || 'vule160404@gmail.com',
              displayName: user.displayName || 'Vũ Lê (Quản Trị Viên)',
              photoURL: user.photoURL || '',
              lastLoginAt: new Date().toISOString(),
            });
          }
          setUsersList(users);
        }
      } catch (err) {
        console.warn('Could not fetch users list:', err);
        if (isMounted && user) {
          setUsersList([
            {
              userId: user.uid,
              email: user.email || 'vule160404@gmail.com',
              displayName: user.displayName || 'Quản Trị Viên',
              photoURL: user.photoURL || '',
              lastLoginAt: new Date().toISOString(),
            },
          ]);
        }
      } finally {
        if (isMounted) setIsLoadingUsers(false);
      }
    }

    fetchUsers();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Fetch Cloudflare R2 connection status on mount
  useEffect(() => {
    let isMounted = true;
    async function loadR2() {
      try {
        const status = await musicApi.getR2Status();
        if (isMounted) {
          setR2Status(status);
        }
      } catch (err) {
        console.warn('Could not fetch R2 status:', err);
      }
    }
    loadR2();
    return () => {
      isMounted = false;
    };
  }, []);

  // Run AI Classification on staged items
  const runAIClassificationForStaged = async (itemsToClassify: StagedFile[]) => {
    if (itemsToClassify.length === 0) return;

    setIsClassifyingAI(true);
    setAiError(null);

    try {
      const results = await musicApi.classifyTracksWithAI(
        itemsToClassify.map(item => ({
          id: item.id,
          title: item.title,
          artist: item.artist,
          fileName: item.fileName,
          album: item.album,
          duration: item.duration,
        }))
      );

      const resultMap = new Map(results.map(r => [r.id, r]));
      setStagedFiles(prev =>
        prev.map(item => {
          const ai = resultMap.get(item.id);
          if (!ai) return item;
          return {
            ...item,
            title: ai.suggestedTitle || item.title,
            artist: ai.suggestedArtist || item.artist,
            genre: ai.genre,
            mood: ai.mood,
            bpm: ai.bpm,
            aiClassified: true,
            aiReason: ai.reason,
          };
        })
      );
    } catch (err: unknown) {
      console.error('AI classification failed:', err);
      const msg = err instanceof Error ? err.message : 'Không thể phân loại nhạc tự động bằng AI.';
      setAiError(msg);
    } finally {
      setIsClassifyingAI(false);
    }
  };

  // Handle Multi-file selection (Multiple files at once)
  const handleMultipleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError(null);
    setAiError(null);

    const fileArray = Array.from(files);
    const newStagedList: StagedFile[] = await Promise.all(
      fileArray.map(async (file, index) => {
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        let parsedTitle = cleanName;
        let parsedArtist = 'Nghệ sĩ chưa rõ';

        if (cleanName.includes('-')) {
          const parts = cleanName.split('-');
          if (parts.length >= 2) {
            parsedArtist = parts[0].replace(/^[0-9.\s]+/, '').trim() || 'Nghệ sĩ chưa rõ';
            parsedTitle = parts.slice(1).join('-').trim() || cleanName;
          }
        }

        const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
        const objectUrl = URL.createObjectURL(file);
        const realDuration = await getAudioDuration(objectUrl);

        return {
          file,
          id: `staged-${Date.now()}-${index}`,
          fileName: file.name,
          title: parsedTitle || file.name,
          artist: parsedArtist,
          album: 'Kho nhạc Soundly',
          genre: defaultBatchGenre === 'AUTO_AI' ? 'Pop' : defaultBatchGenre,
          aiClassified: false,
          duration: realDuration,
          objectUrl,
          sizeFormatted: `${sizeInMb} MB`,
          lyricsText: '',
        };
      })
    );

    setStagedFiles(prev => [...prev, ...newStagedList]);
    e.target.value = '';

    // Automatically classify using Gemini AI if AUTO_AI mode is selected
    if (defaultBatchGenre === 'AUTO_AI') {
      await runAIClassificationForStaged(newStagedList);
    }
  };

  // Remove a staged file before upload
  const handleRemoveStaged = (id: string) => {
    setStagedFiles(prev => prev.filter(f => f.id !== id));
  };

  // Update a single staged item's metadata
  const handleUpdateStaged = (
    id: string,
    field: 'title' | 'artist' | 'genre' | 'lyricsText',
    val: string
  ) => {
    setStagedFiles(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              [field]: val,
              ...(field === 'genre' ? { aiClassified: false, aiReason: 'Chỉnh sửa thủ công bởi Admin' } : {}),
            }
          : item
      )
    );
  };

  // Execute batch upload to server & Cloudflare R2
  const handleExecuteBatchUpload = async () => {
    if (stagedFiles.length === 0) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadProgressText(null);

    try {
      const tracksPayload = [];
      for (let i = 0; i < stagedFiles.length; i++) {
        const item = stagedFiles[i];
        let finalAudioUrl = item.objectUrl;

        // Upload to Cloudflare R2 if configured
        if (r2Status.isConfigured && item.file) {
          setUploadProgressText(
            `Đang tải lên Cloudflare R2 (${i + 1}/${stagedFiles.length}): ${item.title}...`
          );
          const r2Res = await musicApi.uploadAudioToR2(item.file);
          finalAudioUrl = r2Res.audioUrl;
        }

        tracksPayload.push({
          title: item.title.trim(),
          artist: item.artist.trim() || 'Nghệ sĩ chưa rõ',
          album: item.album.trim(),
          audioUrl: finalAudioUrl,
          genre: item.genre,
          duration: item.duration,
          bpm: item.bpm,
          mood: item.mood,
          aiClassified: item.aiClassified,
          aiReason:
            item.aiReason ||
            (finalAudioUrl.includes('r2.')
              ? 'Lưu trữ trên Cloudflare R2 CDN'
              : 'Tải lên bởi quản trị viên'),
          lyricsText: item.lyricsText,
          coverUrl:
            'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
        });
      }

      setUploadProgressText('Đang ghi nhận bài hát vào cơ sở dữ liệu...');
      const addedTracks = await musicApi.addBatchTracks(tracksPayload);
      onTracksUpdated([...addedTracks, ...tracks]);

      setUploadSuccessToast(
        r2Status.isConfigured
          ? `Đã lưu thành công ${stagedFiles.length} bài hát lên Cloudflare R2 & kho nhạc Soundly!`
          : `Đã tải lên thành công ${stagedFiles.length} bài hát vào kho Soundly!`
      );
      setStagedFiles([]);

      setTimeout(() => setUploadSuccessToast(null), 4000);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Tải lên thất bại. Vui lòng thử lại.';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
      setUploadProgressText(null);
    }
  };

  // Re-classify existing tracks in catalog using AI
  const handleReclassifyCatalogWithAI = async () => {
    if (tracks.length === 0) return;
    setIsReclassifyingCatalog(true);
    setAiError(null);

    try {
      const results = await musicApi.classifyTracksWithAI(
        tracks.map(t => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          duration: t.duration,
        }))
      );

      const map = new Map(results.map(r => [r.id, r]));
      const updated = await Promise.all(
        tracks.map(async track => {
          const ai = map.get(track.id);
          if (!ai) return track;
          const patch = {
            genre: ai.genre,
            mood: ai.mood,
            bpm: ai.bpm,
            aiClassified: true,
            aiReason: ai.reason,
          };
          await musicApi.updateTrack(track.id, patch);
          return { ...track, ...patch };
        })
      );

      onTracksUpdated(updated);
      setUploadSuccessToast(`AI đã phân loại lại toàn bộ ${updated.length} bài hát trên Soundly!`);
      setTimeout(() => setUploadSuccessToast(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi phân loại lại kho nhạc bằng AI.';
      setAiError(msg);
    } finally {
      setIsReclassifyingCatalog(false);
    }
  };

  // Delete a track from the catalog
  const handleDeleteTrack = async (trackId: string, title: string) => {
    if (confirm(`Xác nhận xóa bài hát "${title}" khỏi hệ thống?`)) {
      await musicApi.deleteTrack(trackId);
      onTracksUpdated(tracks.filter(t => t.id !== trackId));
    }
  };

  // Sync tracks from SpotFlow MP3 API
  const handleSyncSpotflow = async () => {
    if (!spotflowUrl.trim() || !spotflowApiKey.trim()) {
      setSpotflowMessage('Vui lòng nhập đầy đủ URL SpotFlow và API Key.');
      return;
    }
    setIsSyncingSpotflow(true);
    setSpotflowMessage(null);
    try {
      const result = await musicApi.syncSpotflowTracks(
        spotflowUrl.trim(),
        spotflowApiKey.trim(),
        spotflowSaveToR2
      );
      onTracksUpdated([...result.tracks, ...tracks]);
      setSpotflowMessage(`Đồng bộ thành công ${result.count} bài hát từ SpotFlow MP3 vào kho Soundly!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đồng bộ thất bại.';
      setSpotflowMessage(msg);
    } finally {
      setIsSyncingSpotflow(false);
    }
  };

  // Cloudflare R2 Handlers
  const handleRefreshR2Status = async () => {
    setIsTestingR2(true);
    setR2Notice(null);
    try {
      const status = await musicApi.getR2Status();
      setR2Status(status);
      if (!status.isConfigured) {
        setR2Notice({
          type: 'error',
          message:
            status.serverError ||
            (status.missingVars && status.missingVars.length > 0
              ? `Thiếu biến môi trường trên server: ${status.missingVars.join(', ')}. Hãy kiểm tra Vercel Environment Variables và Redeploy.`
              : 'Không nhận được cấu hình Cloudflare R2 từ API server.'),
        });
        return;
      }
      const res = await musicApi.testR2Connection();
      setR2Notice({
        type: res.success ? 'success' : 'error',
        message: res.message,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kiểm tra kết nối thất bại.';
      setR2Notice({ type: 'error', message: msg });
    } finally {
      setIsTestingR2(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="py-24 text-center text-[#f7f5f0] select-none">
        <ShieldCheck className="w-12 h-12 mx-auto text-rose-500 mb-4" />
        <h2 className="text-xl font-bold">Truy cập bị từ chối</h2>
        <p className="text-xs text-[#a3aed0] mt-2 max-w-sm mx-auto">
          Khu vực này chỉ dành riêng cho tài khoản quản trị viên:{' '}
          <span className="text-[#f7f5f0] font-mono font-semibold">vule160404@gmail.com</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16 text-[#f7f5f0] select-none">
      {/* Toast Notification */}
      {uploadSuccessToast && (
        <div className="fixed top-16 right-4 md:right-8 z-50 bg-[#f47b64] text-[#070b1a] font-extrabold text-xs px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-[#070b1a] stroke-[3]" />
          <span>{uploadSuccessToast}</span>
        </div>
      )}

      {/* Admin Header Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-[#141d3d] via-[#18234a] to-[#262040] border border-[#222f5e] shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#f47b64] mb-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>Khu Vực Quản Trị Hệ Thống</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-[#f7f5f0] tracking-tight">
            Soundly Admin Control Panel
          </h2>
          <p className="text-xs sm:text-sm text-[#a3aed0] mt-1.5">
            Dành riêng cho quản trị viên:{' '}
            <span className="text-[#f7f5f0] font-mono font-semibold">{user?.email || 'vule160404@gmail.com'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#0d142c] px-4 py-2.5 rounded-xl border border-[#222f5e]">
          <Radio className="w-3.5 h-3.5 text-[#f47b64]" />
          <span className="text-xs font-semibold text-[#f7f5f0]">AI Phân loại Soundly sẵn sàng</span>
        </div>
      </div>

      {/* Statistics Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#141d3d] border border-[#222f5e]">
          <div className="flex items-center justify-between text-[#a3aed0] mb-2">
            <span className="text-xs font-bold">Người dùng truy cập</span>
            <Users className="w-4 h-4 text-[#f47b64]" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#f7f5f0] font-mono tabular-nums">
            {isLoadingUsers ? '...' : usersList.length}
          </p>
          <p className="text-[10px] text-[#8d99be] mt-1">Đã đăng nhập qua Google</p>
        </div>

        <div className="p-4 rounded-xl bg-[#141d3d] border border-[#222f5e]">
          <div className="flex items-center justify-between text-[#a3aed0] mb-2">
            <span className="text-xs font-bold">Kho bài hát</span>
            <Music className="w-4 h-4 text-[#f47b64]" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#f7f5f0] font-mono tabular-nums">
            {tracks.length}
          </p>
          <p className="text-[10px] text-[#8d99be] mt-1">Bản nhạc trực tuyến</p>
        </div>

        <div className="p-4 rounded-xl bg-[#141d3d] border border-[#222f5e]">
          <div className="flex items-center justify-between text-[#a3aed0] mb-2">
            <span className="text-xs font-bold">Thể loại nhạc</span>
            <Layers className="w-4 h-4 text-[#f47b64]" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#f7f5f0] font-mono tabular-nums">
            {SPOTIFY_GENRE_NAMES.length}
          </p>
          <p className="text-[10px] text-[#8d99be] mt-1">Phân loại tự động bằng AI</p>
        </div>

        <div className="p-4 rounded-xl bg-[#141d3d] border border-[#222f5e]">
          <div className="flex items-center justify-between text-[#a3aed0] mb-2">
            <span className="text-xs font-bold">Quyền hạn tải nhạc</span>
            <ShieldCheck className="w-4 h-4 text-[#f47b64]" />
          </div>
          <p className="text-sm font-bold text-[#f47b64] mt-1 truncate">Độc quyền Admin</p>
          <p className="text-[10px] text-[#8d99be] mt-1">Không dùng URL • Tệp Audio</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1e2a54] pb-3">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeTab === 'upload'
              ? 'bg-[#f47b64] text-[#070b1a] shadow-md'
              : 'bg-[#141d3d] text-[#a3aed0] hover:text-[#f7f5f0]'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Tải nhạc hàng loạt (Files Only)</span>
          {stagedFiles.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-[#070b1a] text-[#f47b64] rounded-full text-[10px]">
              {stagedFiles.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeTab === 'users'
              ? 'bg-[#f47b64] text-[#070b1a] shadow-md'
              : 'bg-[#141d3d] text-[#a3aed0] hover:text-[#f7f5f0]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Danh sách người truy cập ({usersList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tracks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeTab === 'tracks'
              ? 'bg-[#f47b64] text-[#070b1a] shadow-md'
              : 'bg-[#141d3d] text-[#a3aed0] hover:text-[#f7f5f0]'
          }`}
        >
          <Music className="w-4 h-4" />
          <span>Quản lý kho bài hát ({tracks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('spotflow')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeTab === 'spotflow'
              ? 'bg-[#f47b64] text-[#070b1a] shadow-md'
              : 'bg-[#141d3d] text-[#a3aed0] hover:text-[#f7f5f0]'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Đồng bộ SpotFlow MP3</span>
        </button>

        <button
          onClick={() => setActiveTab('r2')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeTab === 'r2'
              ? 'bg-[#f47b64] text-[#070b1a] shadow-md'
              : 'bg-[#141d3d] text-[#a3aed0] hover:text-[#f7f5f0]'
          }`}
        >
          <Cloud className="w-4 h-4" />
          <span>Kho lưu trữ Cloudflare R2</span>
          {r2Status.isConfigured ? (
            <span className="w-2 h-2 rounded-full bg-emerald-400" title="Đã kết nối R2" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-amber-400" title="Chưa kết nối" />
          )}
        </button>
      </div>

      {/* Global AI Error Alert */}
      {aiError && (
        <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Thông báo phân loại AI</p>
            <p className="text-[11px] text-amber-200/90 mt-0.5">{aiError}</p>
          </div>
        </div>
      )}

      {/* TAB CLOUDFLARE R2 STORAGE */}
      {activeTab === 'r2' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#141d3d] border border-[#222f5e] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#f7f5f0] flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-[#f47b64]" />
                  <span>Kho lưu trữ âm thanh Cloudflare R2 (100% Miễn phí)</span>
                </h3>
                <p className="text-xs text-[#a3aed0] mt-1">
                  Thay thế Firebase Cloud Storage bằng Cloudflare R2: Miễn phí 10 GB lưu trữ/tháng, 0$ chi phí băng thông tải nhạc (Zero Egress Fees), không yêu cầu thẻ tín dụng trả tiền.
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {r2Status.isConfigured ? (
                  <div className="flex items-center gap-2 bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 px-3.5 py-1.5 rounded-xl text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Đã kết nối Cloudflare R2</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-amber-950/50 border border-amber-500/40 text-amber-300 px-3.5 py-1.5 rounded-xl text-xs font-bold">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span>Chưa thiết lập R2</span>
                  </div>
                )}
              </div>
            </div>

            {r2Notice && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
                  r2Notice.type === 'success'
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                }`}
              >
                {r2Notice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{r2Notice.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#0d142c] border border-[#222f5e]">
                <p className="text-[11px] text-[#8d99be] font-semibold">Account ID (Server Env)</p>
                <p className="text-sm font-mono font-bold text-[#f7f5f0] mt-1">
                  {r2Status.accountId || 'Chưa thiết lập'}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#0d142c] border border-[#222f5e]">
                <p className="text-[11px] text-[#8d99be] font-semibold">Bucket Name</p>
                <p className="text-sm font-mono font-bold text-[#f7f5f0] mt-1">
                  {r2Status.bucketName || 'Chưa thiết lập'}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#0d142c] border border-[#222f5e]">
                <p className="text-[11px] text-[#8d99be] font-semibold">Public Domain / R2.dev</p>
                <p className="text-sm font-mono font-bold text-[#f7f5f0] mt-1 truncate">
                  {r2Status.publicDomain || 'Chưa cấu hình Public URL'}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0d142c] border border-[#222f5e] space-y-2 text-xs">
              <p className="font-bold text-[#f7f5f0]">
                Các biến môi trường Server / Vercel cần thiết:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px] text-[#a3aed0]">
                <span>• CLOUDFLARE_R2_ACCOUNT_ID</span>
                <span>• CLOUDFLARE_R2_ACCESS_KEY_ID</span>
                <span>• CLOUDFLARE_R2_SECRET_ACCESS_KEY</span>
                <span>• CLOUDFLARE_R2_BUCKET_NAME</span>
                <span className="sm:col-span-2">• CLOUDFLARE_R2_PUBLIC_DOMAIN (ví dụ: https://pub-xxxx.r2.dev)</span>
              </div>
              {r2Status.missingVars && r2Status.missingVars.length > 0 && (
                <p className="text-amber-300 text-[11px] pt-1">
                  Server đang thiếu: <b>{r2Status.missingVars.join(', ')}</b>. Sau khi thêm trên Vercel hãy bấm <b>Redeploy</b>.
                </p>
              )}
              <p className="text-[#8d99be] text-[11px] pt-1">
                Lưu ý: Để upload file nhạc lớn (&gt;4.5MB) từ Vercel trực tiếp lên R2, hãy bật CORS Policy trên Bucket R2 cho phép origin Vercel của bạn với method <code className="text-[#f47b64]">GET, PUT, HEAD</code>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleRefreshR2Status}
                disabled={isTestingR2}
                className="px-6 py-2.5 rounded-full bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] font-extrabold text-xs shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {isTestingR2 ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Cloud className="w-4 h-4 stroke-[2.5]" />
                )}
                <span>{isTestingR2 ? 'Đang kiểm tra kết nối R2...' : 'Kiểm tra kết nối Cloudflare R2'}</span>
              </button>
            </div>
          </div>

          {/* Step-by-Step Instructions Card */}
          <div className="p-6 rounded-2xl bg-[#0d142c] border border-[#1e2a54] space-y-4">
            <h4 className="text-sm font-bold text-[#f7f5f0] flex items-center gap-2">
              <Key className="w-4 h-4 text-[#f47b64]" />
              <span>Hướng dẫn 5 bước tạo kho lưu trữ Cloudflare R2 miễn phí 100%:</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#141d3d] border border-[#222f5e] space-y-1.5">
                <span className="w-6 h-6 rounded-full bg-[#f47b64] text-[#070b1a] font-black flex items-center justify-center text-xs">1</span>
                <p className="font-bold text-[#f7f5f0]">Tạo tài khoản</p>
                <p className="text-[11px] text-[#a3aed0]">Truy cập dash.cloudflare.com và đăng ký tài khoản Cloudflare hoàn toàn miễn phí.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#141d3d] border border-[#222f5e] space-y-1.5">
                <span className="w-6 h-6 rounded-full bg-[#f47b64] text-[#070b1a] font-black flex items-center justify-center text-xs">2</span>
                <p className="font-bold text-[#f7f5f0]">Tạo Bucket</p>
                <p className="text-[11px] text-[#a3aed0]">Chọn menu <b>R2 Object Storage</b> &rarr; Bấm <b>Create bucket</b> (ví dụ: <code className="text-[#f47b64]">soundly-music</code>).</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#141d3d] border border-[#222f5e] space-y-1.5">
                <span className="w-6 h-6 rounded-full bg-[#f47b64] text-[#070b1a] font-black flex items-center justify-center text-xs">3</span>
                <p className="font-bold text-[#f7f5f0]">Bật Public URL</p>
                <p className="text-[11px] text-[#a3aed0]">Trong Bucket &rarr; <b>Settings</b> &rarr; mục <b>Public access</b> &rarr; Bật <b>R2.dev subdomain</b> và copy URL.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#141d3d] border border-[#222f5e] space-y-1.5">
                <span className="w-6 h-6 rounded-full bg-[#f47b64] text-[#070b1a] font-black flex items-center justify-center text-xs">4</span>
                <p className="font-bold text-[#f7f5f0]">Tạo API Token</p>
                <p className="text-[11px] text-[#a3aed0]">Vào <b>Manage R2 API Tokens</b> &rarr; <b>Create API Token</b> &rarr; Chọn quyền <b>Object Read & Write</b>.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#141d3d] border border-[#222f5e] space-y-1.5">
                <span className="w-6 h-6 rounded-full bg-[#f47b64] text-[#070b1a] font-black flex items-center justify-center text-xs">5</span>
                <p className="font-bold text-[#f7f5f0]">Dán vào Soundly</p>
                <p className="text-[11px] text-[#a3aed0]">Copy Account ID, Access Key ID và Secret Key dán vào form ở trên rồi bấm Lưu là xong!</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB SPOTFLOW MP3 SYNC */}
      {activeTab === 'spotflow' && (
        <div className="p-6 rounded-2xl bg-[#141d3d] border border-[#222f5e] space-y-6">
          <div>
            <h3 className="text-lg font-bold text-[#f7f5f0] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#f47b64]" />
              <span>Đồng bộ tự động từ SpotFlow MP3 API</span>
            </h3>
            <p className="text-xs text-[#a3aed0] mt-1">
              Kết nối với công cụ tải nhạc SpotFlow MP3 của bạn để tự động đồng bộ bài hát, ảnh bìa và lời bài hát đồng bộ (syncedLyrics).
            </p>
          </div>

          {spotflowMessage && (
            <div className="p-3.5 rounded-xl bg-[#0d142c] border border-[#f47b64]/30 text-xs text-[#f7f5f0] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#f47b64] shrink-0" />
              <span>{spotflowMessage}</span>
            </div>
          )}

          <div className="space-y-4 max-w-xl">
            <div>
              <label className="text-xs text-[#8d99be] font-semibold block mb-1">
                URL Tool SpotFlow MP3 (Base URL hoặc REST API Endpoint):
              </label>
              <input
                type="text"
                placeholder="https://musictool-ytsg.onrender.com/api/external/tracks"
                value={spotflowUrl}
                onChange={e => setSpotflowUrl(e.target.value)}
                className="w-full bg-[#0d142c] border border-[#222f5e] rounded-lg px-3 py-2 text-xs text-[#f7f5f0] outline-none focus:border-[#f47b64]"
              />
            </div>

            <div>
              <label className="text-xs text-[#8d99be] font-semibold block mb-1">
                API Key (X-API-Key / Bearer):
              </label>
              <input
                type="password"
                placeholder="sf_api_key_xxxxxxxx..."
                value={spotflowApiKey}
                onChange={e => setSpotflowApiKey(e.target.value)}
                className="w-full bg-[#0d142c] border border-[#222f5e] rounded-lg px-3 py-2 text-xs text-[#f7f5f0] outline-none focus:border-[#f47b64]"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="spotflowSaveToR2"
                checked={spotflowSaveToR2}
                onChange={e => setSpotflowSaveToR2(e.target.checked)}
                className="w-4 h-4 rounded text-[#f47b64] accent-[#f47b64]"
              />
              <label htmlFor="spotflowSaveToR2" className="text-xs text-[#f7f5f0] cursor-pointer">
                Lưu bản sao file MP3 sang Cloudflare R2 (Khuyên dùng - giúp lưu trữ vĩnh viễn)
              </label>
            </div>

            <button
              onClick={handleSyncSpotflow}
              disabled={isSyncingSpotflow}
              className="px-6 py-2.5 rounded-full bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] font-extrabold text-xs shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {isSyncingSpotflow ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 stroke-[3]" />
              )}
              <span>{isSyncingSpotflow ? 'Đang đồng bộ...' : 'Kết nối & Đồng bộ ngay'}</span>
            </button>
          </div>

          <div className="border-t border-[#1e2a54] pt-4 text-xs text-[#8d99be] space-y-1">
            <p className="font-semibold text-[#f7f5f0]">Webhook Receiver Endpoint cho SpotFlow:</p>
            <p className="font-mono bg-[#0d142c] p-2 rounded text-[11px] text-[#f47b64]">
              POST {window.location.origin}/api/webhooks/spotflow
            </p>
            <p>Bạn có thể cấu hình SpotFlow tự động POST bài hát mới hoàn thành vào webhook này.</p>
          </div>
        </div>
      )}

      {/* TAB 1: BATCH AUDIO UPLOAD (FILES ONLY, NO URLS!) + AI AUTO GENRE */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#141d3d] border border-[#222f5e]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#f7f5f0] flex items-center gap-2">
                  <FileAudio className="w-5 h-5 text-[#f47b64]" />
                  <span>Khu vực tải tệp âm thanh hàng loạt</span>
                </h3>
                <p className="text-xs text-[#a3aed0] mt-1">
                  Chỉ cho phép tải bằng các file âm thanh trực tiếp từ thiết bị (không dùng URL). AI sẽ{' '}
                  <span className="text-[#f47b64] font-semibold">tự động phân tích & phân loại thể loại</span>{' '}
                  ngay khi bạn chọn tệp.
                </p>
              </div>

              {/* Mode / Default Genre Selector */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-[#a3aed0] font-semibold">Chế độ phân loại:</span>
                <select
                  value={defaultBatchGenre}
                  onChange={e => setDefaultBatchGenre(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-[#0d142c] text-xs font-semibold text-[#f7f5f0] border border-[#2b3b75] outline-none focus:border-[#f47b64]"
                >
                  <option value="AUTO_AI">AI Tự động phân loại (Khuyên dùng)</option>
                  {SPOTIFY_GENRE_NAMES.map(g => (
                    <option key={g} value={g}>
                      Cố định: {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cloudflare R2 Status Banner */}
            {r2Status.isConfigured ? (
              <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Kho lưu trữ <b>Cloudflare R2</b> sẵn sàng: Tệp âm thanh sẽ được lưu trữ vĩnh viễn trên Bucket <code className="text-[#f7f5f0]">{r2Status.bucketName}</code> (10GB Miễn phí & 0$ băng thông).
                  </span>
                </div>
                <span className="text-[10px] bg-emerald-900/60 text-emerald-200 px-2 py-0.5 rounded font-mono font-bold shrink-0">
                  R2 CDN Active
                </span>
              </div>
            ) : (
              <div
                onClick={() => setActiveTab('r2')}
                className="cursor-pointer mb-4 p-3 rounded-xl bg-amber-950/50 border border-amber-500/40 text-xs text-amber-200 flex items-center justify-between hover:bg-amber-950/70 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Chưa kết nối Cloudflare R2! Nhấn vào đây để thiết lập lưu trữ miễn phí, tránh mất file khi tải lại trang.
                  </span>
                </div>
                <span className="font-bold underline text-[11px] shrink-0 text-[#f47b64]">
                  Cấu hình R2 ngay &rarr;
                </span>
              </div>
            )}

            {uploadError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300">
                {uploadError}
              </div>
            )}

            {/* Big Drag and Drop Zone */}
            <label className="border-2 border-dashed border-[#2b3b75] hover:border-[#f47b64] transition-colors rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-[#0d142c]/70 group text-center block">
              <input
                type="file"
                multiple
                accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg"
                onChange={handleMultipleFilesChange}
                className="hidden"
              />
              <div className="w-16 h-16 rounded-full bg-[#1c2852] group-hover:bg-[#f47b64] transition-colors flex items-center justify-center text-[#a3aed0] group-hover:text-[#070b1a] mb-3 shadow-lg">
                <Upload className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-[#f7f5f0]">
                Nhấp để chọn hoặc kéo thả nhiều file nhạc cùng lúc
              </p>
              <p className="text-xs text-[#8d99be] mt-1">
                Hỗ trợ MP3, WAV, FLAC, M4A, OGG • Tự động tải lên Cloudflare R2 & phân loại AI
              </p>
            </label>
          </div>

          {/* Staged Files Preview List */}
          {stagedFiles.length > 0 && (
            <div className="p-6 rounded-2xl bg-[#141d3d] border border-[#222f5e]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-[#f7f5f0] flex items-center gap-2">
                    <span>Danh sách file sẵn sàng tải lên</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#f47b64] text-[#070b1a] font-extrabold">
                      {stagedFiles.length} bài
                    </span>
                    {isClassifyingAI && (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-[#f47b64]/15 text-[#f47b64] border border-[#f47b64]/35">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        AI đang phân loại...
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-[#a3aed0] mt-0.5">
                    Kiểm tra lại tên bài hát, nghệ sĩ và thể loại mà AI đã phân loại trước khi lưu
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => runAIClassificationForStaged(stagedFiles)}
                    disabled={isClassifyingAI || isUploading}
                    className="px-3.5 py-2 rounded-full bg-[#0d142c] hover:bg-[#1c2852] border border-[#f47b64]/45 text-xs font-bold text-[#f47b64] flex items-center gap-1.5 disabled:opacity-50 transition-all"
                  >
                    {isClassifyingAI ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5" />
                    )}
                    <span>AI Phân loại lại</span>
                  </button>

                  <button
                    onClick={() => setStagedFiles([])}
                    disabled={isUploading}
                    className="px-3 py-2 rounded-full bg-[#0d142c] hover:bg-[#1c2852] text-xs font-semibold text-[#a3aed0] hover:text-[#f7f5f0]"
                  >
                    Hủy tất cả
                  </button>

                  <button
                    onClick={handleExecuteBatchUpload}
                    disabled={isUploading || isClassifyingAI}
                    className="px-6 py-2.5 rounded-full bg-[#f47b64] hover:bg-[#ff8d76] text-[#070b1a] font-extrabold text-xs shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                    )}
                    <span>
                      {isUploading
                        ? (uploadProgressText || 'Đang lưu vào kho...')
                        : `Tải lên toàn bộ (${stagedFiles.length} file)`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="divide-y divide-[#1e2a54] max-h-[460px] overflow-y-auto pr-1">
                {stagedFiles.map((item, idx) => (
                  <div key={item.id} className="py-3.5 space-y-2 text-xs">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="w-6 text-center text-xs font-mono text-[#6e7ba8]">
                          {idx + 1}
                        </span>
                        <div className="w-9 h-9 rounded-md bg-[#0d142c] flex items-center justify-center text-[#f47b64] shrink-0">
                          <FileAudio className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-[#8d99be] font-semibold block">
                              Tên bài hát:
                            </label>
                            <input
                              type="text"
                              value={item.title}
                              onChange={e => handleUpdateStaged(item.id, 'title', e.target.value)}
                              className="w-full bg-[#0d142c] border border-[#222f5e] rounded px-2 py-1 text-xs text-[#f7f5f0] font-semibold outline-none focus:border-[#f47b64]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-[#8d99be] font-semibold block">
                              Nghệ sĩ:
                            </label>
                            <input
                              type="text"
                              value={item.artist}
                              onChange={e => handleUpdateStaged(item.id, 'artist', e.target.value)}
                              className="w-full bg-[#0d142c] border border-[#222f5e] rounded px-2 py-1 text-xs text-[#f7f5f0] outline-none focus:border-[#f47b64]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-[#8d99be] font-semibold block">
                              Thể loại:
                            </label>
                            <select
                              value={item.genre}
                              onChange={e => handleUpdateStaged(item.id, 'genre', e.target.value)}
                              className="w-full bg-[#0d142c] border border-[#222f5e] rounded px-2 py-1 text-xs text-[#f47b64] font-bold outline-none focus:border-[#f47b64]"
                            >
                              {SPOTIFY_GENRE_NAMES.map(g => (
                                <option key={g} value={g}>
                                  {g}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 pl-9 lg:pl-0">
                        <span className="text-[11px] font-mono text-[#8d99be]">
                          {item.sizeFormatted}
                        </span>
                        {item.aiClassified && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#f47b64]/15 text-[#f47b64] font-bold border border-[#f47b64]/35">
                            <Sparkles className="w-3 h-3" />
                            AI: {item.genre}
                          </span>
                        )}
                        <button
                          onClick={() => handleRemoveStaged(item.id)}
                          className="p-1.5 text-[#a3aed0] hover:text-rose-400 rounded transition-colors"
                          title="Xóa khỏi danh sách chờ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {item.aiReason && (
                      <div className="pl-9 text-[11px] text-[#a3aed0] flex flex-wrap items-center gap-2">
                        <Sparkles className="w-3 h-3 text-[#f47b64] shrink-0" />
                        <span>{item.aiReason}</span>
                        {item.mood && (
                          <span className="px-1.5 py-0.5 rounded bg-[#0d142c] text-[#f7f5f0] text-[10px]">
                            Tâm trạng: {item.mood}
                          </span>
                        )}
                        {item.bpm && (
                          <span className="px-1.5 py-0.5 rounded bg-[#0d142c] text-[#f7f5f0] text-[10px] font-mono">
                            ~{item.bpm} BPM
                          </span>
                        )}
                      </div>
                    )}

                    <div className="pl-9 pt-1">
                      <label className="text-[10px] text-[#8d99be] font-semibold block mb-1">
                        Thêm lời bài hát (Mỗi dòng một câu):
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Nhập hoặc dán lời bài hát (tuỳ chọn)..."
                        value={item.lyricsText || ''}
                        onChange={e => handleUpdateStaged(item.id, 'lyricsText', e.target.value)}
                        className="w-full bg-[#0d142c] border border-[#222f5e] rounded p-2 text-xs text-[#f7f5f0] outline-none focus:border-[#f47b64] resize-y"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REGISTERED USERS MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="p-6 rounded-2xl bg-[#141d3d] border border-[#222f5e]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-[#f7f5f0] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#f47b64]" />
                <span>Danh sách người dùng đã truy cập</span>
              </h3>
              <p className="text-xs text-[#a3aed0] mt-1">
                Theo dõi tất cả các tài khoản Google đã đăng nhập vào Soundly.
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums px-3 py-1 rounded-full bg-[#0d142c] text-[#f47b64] font-bold border border-[#222f5e]">
              {usersList.length} tài khoản
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#222f5e] text-[#8d99be] uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Người dùng</th>
                  <th className="py-3 px-3">Địa chỉ Google Mail</th>
                  <th className="py-3 px-3">Lần đăng nhập cuối</th>
                  <th className="py-3 px-3 text-right">Vai trò / Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2a54]">
                {usersList.map((u, idx) => {
                  const isUserAdmin =
                    u.email?.toLowerCase() === 'vule160404@gmail.com' ||
                    u.email?.toLowerCase() === 'cycloneielts@gmail.com';
                  const formattedDate = u.lastLoginAt
                    ? new Date(u.lastLoginAt).toLocaleString('vi-VN')
                    : 'Hôm nay';

                  return (
                    <tr key={u.userId || idx} className="hover:bg-[#1c2852]/70 transition-colors">
                      <td className="py-3 px-3 flex items-center gap-3">
                        {u.photoURL ? (
                          <img
                            src={u.photoURL}
                            alt={u.displayName}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#0d142c] text-[#f7f5f0] font-bold flex items-center justify-center shrink-0">
                            {u.displayName?.[0] || 'U'}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-[#f7f5f0]">
                            {u.displayName || 'Người dùng Soundly'}
                          </p>
                          <p className="text-[10px] text-[#8d99be] font-mono">
                            ID: {u.userId?.slice(0, 10)}...
                          </p>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-[#a3aed0]">{u.email}</td>

                      <td className="py-3 px-3 text-[#a3aed0]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#8d99be]" />
                          <span>{formattedDate}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right">
                        {isUserAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-[#f47b64]/15 text-[#f47b64] border border-[#f47b64]/40">
                            <ShieldCheck className="w-3 h-3" />
                            Quản trị viên
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#0d142c] text-[#a3aed0] border border-[#222f5e]">
                            Thành viên
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TRACK CATALOG MANAGEMENT */}
      {activeTab === 'tracks' && (
        <div className="p-6 rounded-2xl bg-[#141d3d] border border-[#222f5e]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-bold text-[#f7f5f0] flex items-center gap-2">
                <Music className="w-5 h-5 text-[#f47b64]" />
                <span>Quản lý kho bài hát trực tuyến</span>
              </h3>
              <p className="text-xs text-[#a3aed0] mt-1">
                Xem toàn bộ các bài hát đang có trên hệ thống, chạy AI phân loại lại hoặc xóa bỏ.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {tracks.length > 0 && (
                <button
                  onClick={handleReclassifyCatalogWithAI}
                  disabled={isReclassifyingCatalog}
                  className="px-3.5 py-1.5 rounded-full bg-[#f47b64]/15 hover:bg-[#f47b64]/25 text-[#f47b64] border border-[#f47b64]/40 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-all"
                >
                  {isReclassifyingCatalog ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  <span>AI Phân loại tất cả</span>
                </button>
              )}

              <span className="text-xs font-mono tabular-nums px-3 py-1 rounded-full bg-[#0d142c] text-[#f7f5f0] font-bold border border-[#222f5e]">
                {tracks.length} bài hát
              </span>
            </div>
          </div>

          {tracks.length === 0 ? (
            <div className="py-12 text-center text-[#a3aed0]">
              <Music className="w-10 h-10 mx-auto mb-2 text-[#f47b64]/45" />
              <p className="text-sm font-bold text-[#f7f5f0]">Chưa có bài hát nào trong kho</p>
              <p className="text-xs text-[#8d99be] mt-1">
                Chuyển sang tab &quot;Tải nhạc hàng loạt&quot; để tải lên các tệp âm thanh từ thiết bị.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#1e2a54]">
              {tracks.map((t, idx) => {
                const isCurrent = currentTrack?.id === t.id;
                const isThisPlaying = isCurrent && isPlaying;

                return (
                  <div
                    key={t.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs hover:bg-[#1c2852]/70 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="w-6 text-center text-xs font-mono text-[#6e7ba8]">
                        {idx + 1}
                      </span>
                      <button
                        onClick={() => {
                          if (isCurrent) togglePlay();
                          else playTrack(t, tracks);
                        }}
                        className="w-8 h-8 rounded-full bg-[#0d142c] hover:bg-[#f47b64] text-[#f7f5f0] hover:text-[#070b1a] flex items-center justify-center transition-colors shrink-0"
                      >
                        {isThisPlaying ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        )}
                      </button>
                      <img
                        src={t.coverUrl}
                        alt={t.title}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-md object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <p
                          className={`font-bold truncate ${
                            isCurrent ? 'text-[#f47b64]' : 'text-[#f7f5f0]'
                          }`}
                        >
                          {t.title}
                        </p>
                        <div className="flex items-center gap-1.5 text-[#a3aed0] text-[11px] truncate">
                          <span>{t.artist}</span>
                          <span>•</span>
                          <span className="text-[#f47b64] font-semibold">{t.genre}</span>
                          {t.aiClassified && (
                            <Sparkles className="w-3 h-3 text-[#f47b64] inline shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] font-mono text-[#8d99be]">
                        {Math.floor(t.duration / 60)}:
                        {(t.duration % 60).toString().padStart(2, '0')}
                      </span>
                      <button
                        onClick={() => handleDeleteTrack(t.id, t.title)}
                        className="p-2 text-[#8d99be] hover:text-rose-400 hover:bg-[#0d142c] rounded-lg transition-colors"
                        title="Xóa bài hát khỏi hệ thống"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
