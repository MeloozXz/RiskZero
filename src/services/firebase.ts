import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'securityproject-67800',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:755006353966:web:5970d92f77307c4cd025bf',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'securityproject-67800.firebasestorage.app',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCyQACRBbmWUxX0fYcXHkQaLo80bpV9Txo',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'securityproject-67800.firebaseapp.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '755006353966',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-8331VW6BPG'
};

// Inicializa o Firebase com proteção contra crash
let app;
try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
} catch (error) {
  console.warn('[Firebase] Erro ao inicializar app Firebase:', error);
}

// Inicializa serviços do Firebase com proteção contra falhas de API key
let authInstance: Auth;
try {
  authInstance = app ? getAuth(app) : ({} as unknown as Auth);
} catch (error) {
  console.warn('[Firebase] Falha ao inicializar Auth com a configuração padrão:', error);
  authInstance = {
    currentUser: null,
    onAuthStateChanged: () => () => {},
    authStateReady: () => Promise.resolve()
  } as unknown as Auth;
}

let dbInstance: Firestore;
try {
  dbInstance = app ? getFirestore(app) : ({} as unknown as Firestore);
} catch (error) {
  console.warn('[Firebase] Falha ao inicializar Firestore:', error);
  dbInstance = {} as unknown as Firestore;
}

export const auth = authInstance;
export const db = dbInstance;

