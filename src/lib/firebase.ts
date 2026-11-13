import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

function getEffectiveAuthDomain(): string {
  if (typeof window === 'undefined') {
    return firebaseConfig.authDomain;
  }
  const hostname = window.location.hostname;
  const isLocalOrManagedHost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.run.app') ||
    hostname.endsWith('.firebaseapp.com') ||
    hostname.endsWith('.web.app');

  // On Vercel or custom domains, use same-origin authDomain paired with vercel.json /__/auth/* proxy
  // so both popup and redirect auth run 100% first-party (works in Edge InPrivate & Chrome Incognito).
  return isLocalOrManagedHost ? firebaseConfig.authDomain : window.location.host;
}

const runtimeFirebaseConfig = {
  ...firebaseConfig,
  authDomain: getEffectiveAuthDomain(),
};

const app = initializeApp(runtimeFirebaseConfig);

// CRITICAL: Initialize Firestore with explicit database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Pre-warm Firebase Auth popup iframe/resolver on all browsers (including Desktop Chrome/Edge)
// so signInWithPopup opens synchronously inside the click gesture without triggering auth/popup-blocked.
let prewarmPromise: Promise<void> | null = null;
export function prewarmGooglePopupAuth(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (prewarmPromise) return prewarmPromise;

  prewarmPromise = (async () => {
    try {
      const internalAuth = auth as unknown as {
        _initializationPromise?: Promise<void>;
        _popupRedirectResolver?: {
          _initialize?: (a: typeof auth) => Promise<unknown>;
        };
      };
      if (internalAuth._initializationPromise) {
        await internalAuth._initializationPromise;
      }
      if (internalAuth._popupRedirectResolver?._initialize) {
        await internalAuth._popupRedirectResolver._initialize(auth);
      }
    } catch {
      // Non-fatal: signInWithPopup will retry initialization if needed
    }
  })();

  return prewarmPromise;
}

if (typeof window !== 'undefined') {
  prewarmGooglePopupAuth();
}



export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export function isEmbeddedIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export const REDIRECT_PENDING_KEY = 'spotify_auth_redirect_pending';

export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (
      (code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/web-storage-unsupported') &&
      !isEmbeddedIframe()
    ) {
      await signInWithGoogleRedirect();
      return null;
    }
    throw err;
  }
};

export const signInWithGoogleRedirect = async (): Promise<void> => {
  try {
    sessionStorage.setItem(REDIRECT_PENDING_KEY, '1');
  } catch {
    // ignore storage errors
  }
  await signInWithRedirect(auth, googleProvider);
};

export const logoutUser = async (): Promise<void> => {
  await signOut(auth);
};

export { onAuthStateChanged, getRedirectResult };
export type { User };
