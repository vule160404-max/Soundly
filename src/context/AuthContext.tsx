import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  auth,
  signInWithGoogle,
  signInWithGoogleRedirect,
  getRedirectResult,
  prewarmGooglePopupAuth,
  logoutUser,
  onAuthStateChanged,
  db,
  isEmbeddedIframe,
  REDIRECT_PENDING_KEY,
} from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: (open: boolean) => void;
  loginWithGoogle: () => Promise<void>;
  loginWithRedirectFallback: () => Promise<void>;
  logout: () => Promise<void>;
  authError: string | null;
  authErrorCode: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function formatFirebaseAuthError(err: unknown): { code: string; message: string } {
  const code = (err as { code?: string })?.code || '';
  const rawMessage = err instanceof Error ? err.message : 'Đăng nhập Google thất bại';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

  if (code === 'auth/popup-blocked') {
    if (isEmbeddedIframe()) {
      return {
        code,
        message:
          'Trình duyệt đã chặn cửa sổ bật lên (Popup). Vui lòng bấm vào biểu tượng "Cửa sổ bị chặn" trên thanh địa chỉ trình duyệt và chọn "Luôn cho phép popup", hoặc mở app ở tab mới.',
      };
    }
    return {
      code,
      message:
        'Trình duyệt đang chặn cửa sổ bật lên (auth/popup-blocked). Vui lòng bấm biểu tượng "Cửa sổ bị chặn" trên thanh địa chỉ để cho phép Pop-up hoặc bấm nút thử lại.',
    };
  }

  if (code === 'auth/unauthorized-domain') {
    return {
      code,
      message: `Tên miền "${hostname}" chưa được cấp quyền trong Firebase Authentication. Vào Firebase Console > Authentication > Settings > Authorized domains và thêm "${hostname}".`,
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      code,
      message:
        'Lỗi kết nối mạng tới máy chủ Google Firebase. Vui lòng kiểm tra kết nối internet và thử lại.',
    };
  }

  return { code, message: rawMessage };
}

async function syncUserProfile(currentUser: User) {
  try {
    const userDocRef = doc(db, 'users', currentUser.uid);
    await setDoc(
      userDocRef,
      {
        userId: currentUser.uid,
        email: currentUser.email || '',
        displayName: currentUser.displayName || 'Người dùng Soundly',
        photoURL: currentUser.photoURL || '',
        lastLoginAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not sync user profile to Firestore:', err);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let authStateSettled = false;
    let redirectSettled = false;
    let prewarmSettled = false;
    let redirectErrorOccurred = false;
    let redirectUser: User | null = null;
    let authStateUser: User | null = null;

    let hadRedirectPending = false;
    try {
      hadRedirectPending = sessionStorage.getItem(REDIRECT_PENDING_KEY) === '1';
      sessionStorage.removeItem(REDIRECT_PENDING_KEY);
    } catch {
      hadRedirectPending = false;
    }

    const resolveInitialAuth = () => {
      if (!isMounted || !authStateSettled || !redirectSettled || !prewarmSettled) return;

      const finalUser = redirectUser || authStateUser || auth.currentUser;
      setUser(finalUser);
      setIsLoading(false);

      if (finalUser) {
        setAuthError(null);
        setAuthErrorCode(null);
        syncUserProfile(finalUser);
      } else if (hadRedirectPending && !redirectErrorOccurred) {
        setAuthErrorCode('auth/redirect-incomplete');
        setAuthError(
          'Phiên đăng nhập Google chưa hoàn tất khi quay lại trang. Vui lòng thử bấm "Tiếp tục bằng tài khoản Google" lại.'
        );
      }
    };

    Promise.race([
      prewarmGooglePopupAuth(),
      new Promise<void>((resolve) => setTimeout(resolve, 2000)),
    ]).finally(() => {
      prewarmSettled = true;
      resolveInitialAuth();
    });

    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          redirectUser = result.user;
        }
      })
      .catch((err: unknown) => {
        redirectErrorOccurred = true;
        console.error('Redirect sign-in error:', err);
        const formatted = formatFirebaseAuthError(err);
        if (isMounted) {
          setAuthError(formatted.message);
          setAuthErrorCode(formatted.code);
        }
      })
      .finally(() => {
        redirectSettled = true;
        resolveInitialAuth();
      });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      authStateUser = currentUser;
      if (!authStateSettled) {
        authStateSettled = true;
        resolveInitialAuth();
      } else if (isMounted) {
        // Subsequent auth state changes (e.g. popup login or logout)
        const activeUser = currentUser || redirectUser;
        setUser(activeUser);
        if (activeUser) {
          setAuthError(null);
          setAuthErrorCode(null);
          syncUserProfile(activeUser);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const loginWithGoogle = async () => {
    try {
      // Call signInWithPopup immediately inside click event before any setState
      const signedInUser = await signInWithGoogle();
      if (signedInUser) {
        setAuthError(null);
        setAuthErrorCode(null);
        setUser(signedInUser);
        setIsLoginModalOpen(false);
      }
    } catch (err: unknown) {
      console.error('Google Sign In error:', err);
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      const formatted = formatFirebaseAuthError(err);
      setAuthError(formatted.message);
      setAuthErrorCode(formatted.code);
    }
  };

  const loginWithRedirectFallback = async () => {
    try {
      await signInWithGoogleRedirect();
    } catch (err: unknown) {
      console.error('Google Redirect Sign In error:', err);
      const formatted = formatFirebaseAuthError(err);
      setAuthError(formatted.message);
      setAuthErrorCode(formatted.code);
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const ADMIN_EMAILS = ['vule160404@gmail.com', 'cycloneielts@gmail.com'];
  const isAdmin = !!(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase().trim()));

  const clearAuthError = () => {
    setAuthError(null);
    setAuthErrorCode(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isLoading,
        isLoginModalOpen,
        setIsLoginModalOpen,
        loginWithGoogle,
        loginWithRedirectFallback,
        logout,
        authError,
        authErrorCode,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
