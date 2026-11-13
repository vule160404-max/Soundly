import React from 'react';
import { Mic2, Heart, Music, AlertCircle, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isEmbeddedIframe } from '../lib/firebase';

export const LoginGate: React.FC = () => {
  const {
    loginWithGoogle,
    loginWithRedirectFallback,
    authError,
    authErrorCode,
    isLoading,
  } = useAuth();

  const inIframe = isEmbeddedIframe();

  return (
    <div className="min-h-screen w-screen bg-[#070b1a] text-[#f7f5f0] flex flex-col justify-between items-center p-5 sm:p-8 relative overflow-hidden select-none">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] bg-[#0c1957]/45 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] bg-[#f47b64]/12 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-5xl flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#f7f5f0] shadow-lg shadow-[#0c1957]/40 ring-1 ring-white/15 shrink-0">
            <img
              src="/assets/aistudio/Logo_Soundly_b8420ae4.svg"
              alt="Soundly Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="leading-tight">
            <span className="text-lg font-black tracking-tight text-[#f7f5f0] block">Soundly</span>
            <span className="text-[10px] font-semibold tracking-wider uppercase text-[#f47b64] block">
              Âm nhạc của bạn
            </span>
          </div>
        </div>
      </header>

      {/* Center Auth Card */}
      <main className="w-full max-w-md my-auto py-4 z-10 flex flex-col items-center text-center">
        {/* Official Soundly Full Lockup */}
        <div className="w-40 h-40 sm:w-44 sm:h-44 rounded-3xl overflow-hidden bg-[#f7f5f0] mb-5 shadow-2xl shadow-[#0c1957]/60 ring-2 ring-[#f47b64]/30 hover:scale-[1.02] transition-transform">
          <img
            src="/assets/aistudio/Logo_Soundly__1__041291db.svg"
            alt="Soundly - Âm nhạc của bạn, theo cách riêng"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Headlines */}
        <h1 className="text-2xl sm:text-3xl font-black text-[#f7f5f0] tracking-tight">
          Âm nhạc của bạn, theo cách riêng
        </h1>
        <p className="text-xs sm:text-sm text-[#a3aed0] mt-2.5 max-w-sm leading-relaxed">
          Nghe nhạc hoàn toàn <span className="text-[#f47b64] font-bold">miễn phí</span> mỗi ngày. Đăng nhập bằng <span className="text-[#f7f5f0] font-semibold">Google</span> để mở kho nhạc Soundly, lưu bài hát yêu thích và đồng bộ playlist của riêng bạn.
        </p>

        {/* Error Notification */}
        {authError && (
          <div className="w-full mt-4 p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300 flex flex-col gap-2.5 text-left">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Đăng nhập chưa thành công</p>
                <p className="text-[11px] text-rose-200/90 mt-0.5 leading-relaxed">{authError}</p>
              </div>
            </div>

            {authErrorCode === 'auth/popup-blocked' && !inIframe && (
              <button
                type="button"
                onClick={() => loginWithRedirectFallback()}
                className="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-[#f7f5f0] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Thử đăng nhập bằng chuyển hướng trang</span>
              </button>
            )}
          </div>
        )}

        {/* Big Google Mail Sign-In Button */}
        <div className="w-full mt-6 space-y-3">
          <button
            onClick={() => loginWithGoogle()}
            disabled={isLoading}
            className="w-full h-13 rounded-full bg-[#f7f5f0] hover:bg-white text-[#070b1a] font-extrabold text-sm sm:text-base flex items-center justify-center gap-3.5 px-6 shadow-xl shadow-[#0c1957]/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {/* Google 'G' Icon */}
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Tiếp tục bằng tài khoản Google</span>
          </button>
        </div>

        {/* Feature Highlights Grid */}
        <div className="w-full mt-6 pt-6 border-t border-[#1e2a54] grid grid-cols-1 gap-2.5 text-left">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#101836] border border-[#222f5e]">
            <div className="w-8 h-8 rounded-full bg-[#f47b64]/15 flex items-center justify-center text-[#f47b64] shrink-0">
              <Music className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#f7f5f0]">Nghe nhạc miễn phí 100%</p>
              <p className="text-[11px] text-[#a3aed0]">Thưởng thức âm thanh rõ nét, không giới hạn và không quảng cáo</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#101836] border border-[#222f5e]">
            <div className="w-8 h-8 rounded-full bg-[#f47b64]/15 flex items-center justify-center text-[#f47b64] shrink-0">
              <Mic2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#f7f5f0]">Lời bài hát đồng bộ thời gian thực</p>
              <p className="text-[11px] text-[#a3aed0]">Hát theo từng câu chữ mượt mà trên mọi thiết bị</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#101836] border border-[#222f5e]">
            <div className="w-8 h-8 rounded-full bg-[#f47b64]/15 flex items-center justify-center text-[#f47b64] shrink-0">
              <Heart className="w-4 h-4 fill-[#f47b64]" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#f7f5f0]">Playlist & Thư viện của riêng bạn</p>
              <p className="text-[11px] text-[#a3aed0]">Lưu bài hát yêu thích và đồng bộ danh sách phát mọi lúc mọi nơi</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl text-center py-3 text-[11px] text-[#6e7ba8] z-10 border-t border-[#162044]">
        Bằng cách đăng nhập, bạn đồng ý với Điều khoản Sử dụng và Chính sách Quyền riêng tư của Soundly.
      </footer>
    </div>
  );
};
