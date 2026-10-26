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
  } catch {
    localStorage.setItem(key, value);
  }
}

async function getSecureItem(key: string): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key });
    return value;
  } catch {
    return localStorage.getItem(key);
  }
}

async function removeSecureItem(key: string): Promise<void> {
  try {
    await Preferences.remove({ key });
  } catch {
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
  TERMS_ACCEPTED: 'zk_security_terms_accepted',
  HIBP_API_KEY: 'zk_hibp_api_key',
  REMEMBER_SESSION: 'zk_remember_session',
  PERSISTED_SESSION: 'zk_persisted_session',
  DEVICE_PROTECTOR_SALT: 'zk_device_protector_salt'
};

/**
 * Funções de persistência estritamente locais para a chave da API do Have I Been Pwned (HIBP).
 * Em total conformidade com o princípio Zero-Knowledge: a chave nunca é sincronizada com a nuvem ou Firestore.
 */
export async function setHibpApiKey(key: string): Promise<void> {
  await setSecureItem(KEYS.HIBP_API_KEY, key.trim());
}

export async function getHibpApiKey(): Promise<string | null> {
  const val = await getSecureItem(KEYS.HIBP_API_KEY);
  return val ? val.trim() : null;
}

export async function clearHibpApiKey(): Promise<void> {
  await removeSecureItem(KEYS.HIBP_API_KEY);
}


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
      totpSecret: profile.totpSecret || null,
      kdfAlgorithm: profile.kdfAlgorithm || 'argon2id',
      subscription: profile.subscription || null
    }, { merge: true });
    await this.addRegisteredAccount(email);
  },

  /**
   * Atualiza o salt criptográfico e algoritmo KDF do usuário no Firestore
   */
  async updateUserKdf(salt: string, kdfAlgorithm: 'argon2id' | 'pbkdf2' = 'argon2id'): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, { salt, kdfAlgorithm });
  },

  /**
   * Atualiza o salt criptográfico do usuário no Firestore
   */
  async updateUserSalt(salt: string): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, { salt });
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
        kdfAlgorithm: data.kdfAlgorithm || 'pbkdf2', // Contas sem campo explícito são tratadas como PBKDF2 para migração
        passwordHash: data.passwordHash || '',
        totpEnabled: data.totpEnabled || false,
        encryptedTotpSecret: data.encryptedTotpSecret || undefined,
        totpSecret: data.totpSecret || undefined,
        subscription: data.subscription || undefined,
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
  async getEncryptedVault(_email: string): Promise<string | null> {
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
    // Retenção aumentada para 200 eventos (conformidade LGPD / ISO 27001)
    const updatedLogs = [newLog, ...logs].slice(0, 200);
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, {
      auditLogs: updatedLogs
    });
  },

  /**
   * Exporta os logs de auditoria em formato CSV (RFC 4180) para conformidade LGPD/ISO 27001.
   */
  async exportAuditLogsCSV(email: string): Promise<string> {
    const logs = await this.getAuditLogs(email);
    const header = '"ID","Timestamp","Ação","Detalhes"';
    const rows = logs.map((l) =>
      `"${l.id}","${l.timestamp}","${l.action}","${l.details.replace(/"/g, '""')}"`
    );
    const csvContent = [header, ...rows].join('\r\n');
    return `\uFEFF${csvContent}`; // BOM UTF-8 para compatibilidade com Excel
  },

  /**
   * Exporta os logs de auditoria em formato JSON estruturado com cabeçalho de conformidade LGPD.
   */
  async exportAuditLogsJSON(email: string): Promise<string> {
    const logs = await this.getAuditLogs(email);
    const report = {
      relatorio_auditoria: {
        versao: '1.0',
        gerado_em: new Date().toISOString(),
        titular_dos_dados: email,
        responsavel_pelo_tratamento: 'ZeroKnowledge Vault — TCC de Segurança da Informação',
        finalidade: 'Registro de eventos de segurança para conformidade com LGPD (Lei nº 13.709/2018) e ISO/IEC 27001:2022.',
        base_legal: 'Legítimo interesse do titular e obrigação legal de segurança (Art. 7º, IX, LGPD)',
        total_eventos: logs.length,
        periodo: logs.length > 0 ? {
          primeiro: logs[logs.length - 1]?.timestamp,
          ultimo: logs[0]?.timestamp
        } : null,
        eventos: logs
      }
    };
    return JSON.stringify(report, null, 2);
  },

  /**
   * Obtém lista de logs de auditoria do Firestore
   */
  async getAuditLogs(_email: string): Promise<AuditLog[]> {
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

    // Sincroniza estado de lockout no Firestore para defesa server-side (A-1)
    const uid = auth.currentUser?.uid;
    if (uid) {
      try {
        const docRef = doc(db, 'users', uid);
        await updateDoc(docRef, {
          lockoutState: {
            attempts,
            lockoutUntil
          }
        });
      } catch {
        // Ignora silenciosamente se offline ou erro transitório
      }
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
      } catch {
        // Ignora erro de parsing e segue para checagem por conta
      }
    }

    // 2. Se houver e-mail, verifica se já aceitou nessa conta
    if (email) {
      const emailKey = email.toLowerCase().trim();
      const userData = await getSecureItem(`${KEYS.TERMS_ACCEPTED}_${emailKey}`);
      if (userData) {
        try {
          const parsed = JSON.parse(userData);
          if (parsed && parsed.accepted) return parsed;
        } catch {
          // Ignora erro de parsing
        }
      }
    }

    return { accepted: false };
  },

  /**
   * Armazena a API Key do Have I Been Pwned de forma segura e estritamente local (Zero-Knowledge)
   */
  async setHibpApiKey(key: string): Promise<void> {
    return setHibpApiKey(key);
  },

  /**
   * Recupera a API Key do Have I Been Pwned salva localmente
   */
  async getHibpApiKey(): Promise<string | null> {
    return getHibpApiKey();
  },

  /**
   * Remove a API Key do Have I Been Pwned do dispositivo
   */
  async clearHibpApiKey(): Promise<void> {
    return clearHibpApiKey();
  },

  /**
   * Verifica se a persistência de sessão (Manter conectado ao atualizar / F5) está ativada.
   * Por padrão, retorna true para conveniência e facilidade de uso do usuário.
   */
  async isRememberSessionEnabled(): Promise<boolean> {
    const val = await getSecureItem(KEYS.REMEMBER_SESSION);
    if (val === null) return true; // Ativado por padrão
    return val === 'true';
  },

  /**
   * Ativa ou desativa a persistência de sessão ao recarregar a página
   */
  async setRememberSessionEnabled(enabled: boolean): Promise<void> {
    await setSecureItem(KEYS.REMEMBER_SESSION, enabled ? 'true' : 'false');
    if (!enabled) {
      await this.clearPersistedSession();
    }
  },

  /**
   * Salva o payload cifrado da sessão persistida
   */
  async savePersistedSession(payload: string): Promise<void> {
    await setSecureItem(KEYS.PERSISTED_SESSION, payload);
  },

  /**
   * Recupera o payload cifrado da sessão persistida
   */
  async getPersistedSession(): Promise<string | null> {
    return await getSecureItem(KEYS.PERSISTED_SESSION);
  },

  /**
   * Limpa a sessão persistida (usado no logout ou desativação)
   */
  async clearPersistedSession(): Promise<void> {
    await removeSecureItem(KEYS.PERSISTED_SESSION);
  },

  /**
   * Obtém ou inicializa o salt criptográfico aleatório único do dispositivo (C-2).
   * Garante 256 bits de alta entropia para proteção da sessão persistida contra ataques de contexto.
   */
  async getDeviceProtectorSalt(): Promise<string> {
    let salt = await getSecureItem(KEYS.DEVICE_PROTECTOR_SALT);
    if (!salt) {
      const bytes = new Uint8Array(32);
      window.crypto.getRandomValues(bytes);
      salt = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
      await setSecureItem(KEYS.DEVICE_PROTECTOR_SALT, salt);
    }
    return salt;
  }
};

