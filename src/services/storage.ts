import { Preferences } from '@capacitor/preferences';
import { UserProfile, AuditLog } from '../types';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

/**
 * Utilitários internos de persistência assíncrona.
 * Utiliza o @capacitor/preferences para armazenamento isolado nativo no Android
 * e faz fallback transparente para localStorage clássico caso falhe ou esteja no browser.
 */
async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    await Preferences.set({ key, value });
  } catch (e) {
    localStorage.setItem(key, value);
  }
}

async function getSecureItem(key: string): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key });
    return value;
  } catch (e) {
    return localStorage.getItem(key);
  }
}

async function removeSecureItem(key: string): Promise<void> {
  try {
    await Preferences.remove({ key });
  } catch (e) {
    localStorage.removeItem(key);
  }
}

/**
 * Chaves de Armazenamento local
 */
const KEYS = {
  USER_PROFILE: 'zk_user_profile',
  VAULT_ITEMS: 'zk_vault_items',     // Array de itens criptografados individuais ou blocos
  AUDIT_LOGS: 'zk_audit_logs',
  ACTIVE_PIN: 'zk_active_pin_hash',  // Hash do PIN temporário para re-entrada rápida
  FAILED_ATTEMPTS: 'zk_failed_login_attempts',
  LOCKOUT_UNTIL: 'zk_lockout_until',
  TERMS_ACCEPTED: 'zk_security_terms_accepted'
};

/**
 * Serviço de Storage
 */
export const StorageService = {
  /**
   * Salva o perfil do usuário indexado por e-mail no Firestore
   */
  async saveUserProfile(email: string, profile: UserProfile): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const docRef = doc(db, 'users', uid);
    await setDoc(docRef, {
      totpEnabled: profile.totpEnabled,
      encryptedTotpSecret: profile.encryptedTotpSecret || null,
      totpSecret: profile.totpSecret || null
    }, { merge: true });
    await this.addRegisteredAccount(email);
  },

  /**
   * Obtém o perfil do usuário indexado por e-mail do Firestore
   */
  async getUserProfile(email: string): Promise<UserProfile | null> {
    const uid = auth.currentUser?.uid;
    if (!uid) return null;
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        username: data.email || email,
        salt: data.salt,
        passwordHash: data.passwordHash || '',
        totpEnabled: data.totpEnabled || false,
        encryptedTotpSecret: data.encryptedTotpSecret || undefined,
        totpSecret: data.totpSecret || undefined,
        createdAt: data.createdAt || new Date().toISOString()
      };
    }
    return null;
  },

  /**
   * Salva a base do cofre criptografada (Ciphertext geral) no Firestore
   */
  async saveEncryptedVault(email: string, encryptedBlob: string): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, {
      encryptedVault: encryptedBlob
    });
  },

  /**
   * Obtém a base do cofre criptografada (Ciphertext) do Firestore
   */
  async getEncryptedVault(email: string): Promise<string | null> {
    const uid = auth.currentUser?.uid;
    if (!uid) return null;
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().encryptedVault || null;
    }
    return null;
  },

  /**
   * Limpa todos os dados locais (Reset de fábrica do app)
   */
  async clearAllData(): Promise<void> {
    localStorage.clear();
    try {
      await Preferences.clear();
    } catch (e) {
      console.warn(e);
    }
  },

  /**
   * Salva PIN de Acesso Local indexado por e-mail (Mantido Localmente)
   */
  async savePINHash(email: string, pinHash: string): Promise<void> {
    const key = `${KEYS.ACTIVE_PIN}_${email.toLowerCase().trim()}`;
    await setSecureItem(key, pinHash);
  },

  /**
   * Obtém PIN de Acesso Local indexado por e-mail (Mantido Localmente)
   */
  async getPINHash(email: string): Promise<string | null> {
    const key = `${KEYS.ACTIVE_PIN}_${email.toLowerCase().trim()}`;
    return await getSecureItem(key);
  },

  /**
   * Registra um evento de auditoria de segurança no Firestore
   */
  async addAuditLog(email: string, action: AuditLog['action'], details: string): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const emailKey = email.toLowerCase().trim();
    const logs = await this.getAuditLogs(emailKey);
    const newLog: AuditLog = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      timestamp: new Date().toISOString(),
      action,
      details
    };
    
    const updatedLogs = [newLog, ...logs].slice(0, 100);
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, {
      auditLogs: updatedLogs
    });
  },

  /**
   * Obtém lista de logs de auditoria do Firestore
   */
  async getAuditLogs(email: string): Promise<AuditLog[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().auditLogs || [];
    }
    return [];
  },

  /**
   * Persiste estado de tentativas fracas e bloqueio temporário (Global)
   */
  async saveLockoutState(attempts: number, lockoutUntil: string | null): Promise<void> {
    await setSecureItem(KEYS.FAILED_ATTEMPTS, String(attempts));
    if (lockoutUntil) {
      await setSecureItem(KEYS.LOCKOUT_UNTIL, lockoutUntil);
    } else {
      await removeSecureItem(KEYS.LOCKOUT_UNTIL);
    }
  },

  /**
   * Carrega estado de tentativas fracas e bloqueio (Global)
   */
  async getLockoutState(): Promise<{ attempts: number; lockoutUntil: string | null }> {
    const attemptsStr = await getSecureItem(KEYS.FAILED_ATTEMPTS);
    const lockoutUntil = await getSecureItem(KEYS.LOCKOUT_UNTIL);
    
    return {
      attempts: attemptsStr ? Number(attemptsStr) : 0,
      lockoutUntil: lockoutUntil || null
    };
  },

  /**
   * Adiciona um e-mail à lista global de contas registradas localmente
   */
  async addRegisteredAccount(email: string): Promise<void> {
    const list = await this.getRegisteredAccounts();
    const emailKey = email.toLowerCase().trim();
    if (!list.includes(emailKey)) {
      list.push(emailKey);
      await setSecureItem('zk_registered_emails', JSON.stringify(list));
    }
  },

  /**
   * Obtém a lista global de contas registradas localmente
   */
  async getRegisteredAccounts(): Promise<string[]> {
    const data = await getSecureItem('zk_registered_emails');
    if (!data) return [];
    try {
      return JSON.parse(data) as string[];
    } catch {
      return [];
    }
  },

  /**
   * Verifica se há alguma conta cadastrada no dispositivo
   */
  async hasAnyAccount(): Promise<boolean> {
    const list = await this.getRegisteredAccounts();
    return list.length > 0;
  },

  /**
   * Salva o aceite dos Termos de Segurança e Privacidade no Storage seguro do Ionic
   */
  async saveSecurityTermsAccepted(email: string, version: string = 'v1.0'): Promise<void> {
    const payload = JSON.stringify({
      accepted: true,
      timestamp: new Date().toISOString(),
      version
    });
    // Salva a nível global do dispositivo
    await setSecureItem(`${KEYS.TERMS_ACCEPTED}_global`, payload);
    // Se houver e-mail específico, salva também para o e-mail
    if (email && email !== 'global') {
      const emailKey = email.toLowerCase().trim();
      await setSecureItem(`${KEYS.TERMS_ACCEPTED}_${emailKey}`, payload);
    }
  },

  /**
   * Obtém o estado de aceite dos Termos de Segurança e Privacidade
   */
  async getSecurityTermsAccepted(email?: string | null): Promise<{ accepted: boolean; timestamp?: string; version?: string }> {
    // 1. Verifica se já aceitou globalmente neste dispositivo
    const globalData = await getSecureItem(`${KEYS.TERMS_ACCEPTED}_global`);
    if (globalData) {
      try {
        const parsed = JSON.parse(globalData);
        if (parsed && parsed.accepted) return parsed;
      } catch {}
    }

    // 2. Se houver e-mail, verifica se já aceitou nessa conta
    if (email) {
      const emailKey = email.toLowerCase().trim();
      const userData = await getSecureItem(`${KEYS.TERMS_ACCEPTED}_${emailKey}`);
      if (userData) {
        try {
          const parsed = JSON.parse(userData);
          if (parsed && parsed.accepted) return parsed;
        } catch {}
      }
    }

    return { accepted: false };
  }
};
