import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** Chưa cấu hình thì ứng dụng lùi về chế độ dữ liệu mẫu thay vì sập. */
export const FIREBASE_READY = Boolean(config.apiKey && config.projectId);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (FIREBASE_READY) {
  app = initializeApp(config);
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
}

export function requireAuth(): Auth {
  if (!authInstance) throw new Error('Chưa cấu hình Firebase');
  return authInstance;
}

export function requireDb(): Firestore {
  if (!dbInstance) throw new Error('Chưa cấu hình Firebase');
  return dbInstance;
}

/**
 * Cây gia phả mở sẵn khi URL chưa chỉ định và máy chưa nhớ cây nào.
 *
 * Để trống là bình thường — khi đó ứng dụng hỏi người dùng chọn cây. Biến này
 * chỉ có ích cho bản dựng riêng phục vụ đúng một dòng họ.
 */
export const DEFAULT_CLAN_ID: string = import.meta.env.VITE_DEFAULT_CLAN_ID ?? '';
