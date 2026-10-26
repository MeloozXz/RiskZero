import { StorageService } from './storage';
import { SessionService } from './session';
import {
  encryptData,
  decryptData,
  deriveKey,
  generateDEK,
  wrapDEK,
  unwrapDEK,
} from '../crypto/webcrypto';
import { generateTOTP, parseOtpAuthUrl } from '../crypto/totp';
import { VaultItem, PasswordHistoryItem, EncryptedData, VaultCategory } from '../types';
import { getErrorMessage } from '../lib/utils';

// ==========================================
// Helpers de conversão
// ==========================================
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// ==========================================
// Estrutura persistida (apenas ciphertext)
// ==========================================
interface StoredVault {
  version?: number;
  encryptedDek?: EncryptedData; // Chave de Criptografia do Cofre cifrada pela Master Key
  items: StoredVaultItem[];
}

interface StoredVaultItem {
  id: string;
  title?: string;
  encryptedTitle?: EncryptedData;
  encryptedUsername: EncryptedData;
  encryptedPassword: EncryptedData;
  url?: string;
  encryptedUrl?: EncryptedData;
  category?: VaultCategory;
  encryptedNotes?: EncryptedData;
  encryptedTotpSecret?: EncryptedData;
  updatedAt: string;
  history: StoredHistoryItem[];
}

interface StoredHistoryItem {
  id: string;
  encryptedUsername: EncryptedData;
  encryptedPassword: EncryptedData;
  updatedAt: string;
}

// Chave DEK ativa em memória volátil (RAM)
let activeDEK: CryptoKey | null = null;
let activeDEKEmail: string | null = null;

// ==========================================
// Carrega e salva vault criptografado
// ==========================================
async function loadStoredVault(): Promise<StoredVault> {
  const email = SessionService.getActiveUserEmail();
  if (!email) return { items: [] };
  const raw = await StorageService.getEncryptedVault(email);
  if (!raw) return { items: [] };
  try {
    return JSON.parse(raw) as StoredVault;
  } catch {
    return { items: [] };
  }
}

async function saveStoredVault(vault: StoredVault): Promise<void> {
  const email = SessionService.getActiveUserEmail();
  if (!email) return;
  await StorageService.saveEncryptedVault(email, JSON.stringify(vault));
}

/**
 * Obtém ou inicializa a Data Encryption Key (DEK) usando a Master Key (KEK).
 * Se o cofre for legado, migra automaticamente para Envelope Encryption.
 */
async function getOrInitDEK(): Promise<CryptoKey> {
  const email = SessionService.getActiveUserEmail();
  if (activeDEK && activeDEKEmail === email) {
    return activeDEK;
  }

  const masterKey = SessionService.getMasterKey();
  const vault = await loadStoredVault();

  if (vault.encryptedDek) {
    // Decifra a DEK a partir do envelope
    try {
      activeDEK = await unwrapDEK(vault.encryptedDek, masterKey);
      activeDEKEmail = email;
      return activeDEK;
    } catch (err) {
      console.warn('[VaultService] Falha ao decifrar DEK do envelope. Tentando fallback direto:', err);
    }
  }

  // Se não possui DEK no cofre (novo usuário ou migração de cofre legado):
  const newDek = await generateDEK();
  const wrappedDek = await wrapDEK(newDek, masterKey);

  // Se já havia itens criptografados com a masterKey antiga, re-encripta-os com a nova DEK
  if (vault.items.length > 0) {
    const migratedItems: StoredVaultItem[] = [];
    for (const item of vault.items) {
      try {
        const title = item.encryptedTitle ? await decryptData(item.encryptedTitle, masterKey) : (item.title || '');
        const username = await decryptData(item.encryptedUsername, masterKey);
        const password = await decryptData(item.encryptedPassword, masterKey);
        const url = item.encryptedUrl ? await decryptData(item.encryptedUrl, masterKey) : (item.url || '');
        const notes = item.encryptedNotes ? await decryptData(item.encryptedNotes, masterKey) : undefined;
        const totp = item.encryptedTotpSecret ? await decryptData(item.encryptedTotpSecret, masterKey) : undefined;

        migratedItems.push({
          id: item.id,
          encryptedTitle: await encryptData(title, newDek),
          encryptedUsername: await encryptData(username, newDek),
          encryptedPassword: await encryptData(password, newDek),
          encryptedUrl: await encryptData(url, newDek),
          category: item.category || 'LOGIN',
          encryptedNotes: notes ? await encryptData(notes, newDek) : undefined,
          encryptedTotpSecret: totp ? await encryptData(totp, newDek) : undefined,
          updatedAt: item.updatedAt,
          history: item.history,
        });
      } catch {
        migratedItems.push(item);
      }
    }
    vault.items = migratedItems;
  }

  vault.version = 2;
  vault.encryptedDek = wrappedDek;
  await saveStoredVault(vault);

  activeDEK = newDek;
  activeDEKEmail = email;
  return activeDEK;
}

// ==========================================
// Decriptografa um item armazenado
// ==========================================
async function decryptItem(stored: StoredVaultItem, key: CryptoKey): Promise<VaultItem & { _plaintextPassword: string; _plaintextNotes?: string; _plaintextTotpSecret?: string }> {
  const title = stored.encryptedTitle
    ? await decryptData(stored.encryptedTitle, key)
    : (stored.title || '');
  const username = await decryptData(stored.encryptedUsername, key);
  const password = await decryptData(stored.encryptedPassword, key);
  const url = stored.encryptedUrl
    ? await decryptData(stored.encryptedUrl, key)
    : (stored.url || '');

  const notes = stored.encryptedNotes
    ? await decryptData(stored.encryptedNotes, key)
    : undefined;

  const totp = stored.encryptedTotpSecret
    ? await decryptData(stored.encryptedTotpSecret, key)
    : undefined;

  const history: PasswordHistoryItem[] = await Promise.all(
    stored.history.map(async (h) => ({
      id: h.id,
      username: await decryptData(h.encryptedUsername, key),
      encryptedPassword: h.encryptedPassword,
      updatedAt: h.updatedAt,
    }))
  );

  return {
    id: stored.id,
    title,
    username,
    encryptedPassword: stored.encryptedPassword,
    url,
    category: stored.category || 'LOGIN',
    updatedAt: stored.updatedAt,
    history,
    encryptedNotes: stored.encryptedNotes,
    encryptedTotpSecret: stored.encryptedTotpSecret,
    _plaintextPassword: password,
    _plaintextNotes: notes,
    _plaintextTotpSecret: totp,
  };
}

// ==========================================
// VaultService — API pública
// ==========================================
export const VaultService = {
  /**
   * Limpa a chave DEK volátil da memória RAM ao bloquear ou deslogar.
   */
  clearSessionDEK(): void {
    activeDEK = null;
    activeDEKEmail = null;
  },

  /**
   * Retorna todos os itens decriptografados em memória RAM.
   * A chave mestra DEVE estar carregada via SessionService.
   */
  async getAll(): Promise<(VaultItem & { _plaintextPassword: string; _plaintextNotes?: string; _plaintextTotpSecret?: string })[]> {
    const key = await getOrInitDEK();
    const vault = await loadStoredVault();
    return await Promise.all(vault.items.map((item) => decryptItem(item, key)));
  },

  /**
   * Cria uma nova credencial e a persiste 100% criptografada (incluindo título, URL, notas e segredo TOTP).
   */
  async create(params: {
    title: string;
    username: string;
    password: string;
    url: string;
    notes?: string;
    category?: VaultCategory;
    totpSecret?: string;
  }): Promise<string> {
    const key = await getOrInitDEK();
    const vault = await loadStoredVault();
    const id = generateId();

    const encryptedTitle = await encryptData(params.title, key);
    const encryptedUsername = await encryptData(params.username, key);
    const encryptedPassword = await encryptData(params.password, key);
    const encryptedUrl = await encryptData(params.url || '', key);
    const encryptedNotes = params.notes
      ? await encryptData(params.notes, key)
      : undefined;
    
    // Processa e cifra o segredo TOTP se fornecido
    let encryptedTotpSecret: EncryptedData | undefined = undefined;
    if (params.totpSecret) {
      const cleanSecret = parseOtpAuthUrl(params.totpSecret);
      if (cleanSecret) {
        encryptedTotpSecret = await encryptData(cleanSecret, key);
      }
    }

    const newItem: StoredVaultItem = {
      id,
      encryptedTitle,
      encryptedUsername,
      encryptedPassword,
      encryptedUrl,
      category: params.category || 'LOGIN',
      encryptedNotes,
      encryptedTotpSecret,
      updatedAt: new Date().toISOString(),
      history: [],
    };

    vault.items.unshift(newItem);
    await saveStoredVault(vault);
    const email = SessionService.getActiveUserEmail() || '';
    await StorageService.addAuditLog(email, 'CREDENTIAL_CREATED', `Nova credencial protegida com Envelope Encryption.`);

    return id;
  },

  /**
   * Atualiza uma credencial existente, preservando o histórico das últimas 5 versões.
   */
  async update(
    id: string,
    params: {
      title?: string;
      username?: string;
      password?: string;
      url?: string;
      notes?: string;
      category?: VaultCategory;
      totpSecret?: string;
    }
  ): Promise<void> {
    const key = await getOrInitDEK();
    const vault = await loadStoredVault();
    const idx = vault.items.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error('Credencial não encontrada no cofre.');

    const current = vault.items[idx];

    // Salva versão anterior no histórico (máx. 5)
    const historyEntry: StoredHistoryItem = {
      id: generateId(),
      encryptedUsername: current.encryptedUsername,
      encryptedPassword: current.encryptedPassword,
      updatedAt: current.updatedAt,
    };
    const updatedHistory = [historyEntry, ...current.history].slice(0, 5);

    // Encripta campos novos (se fornecidos)
    const encryptedTitle = params.title !== undefined
      ? await encryptData(params.title, key)
      : (current.encryptedTitle ?? (current.title ? await encryptData(current.title, key) : await encryptData('', key)));
    const encryptedUsername = params.username !== undefined
      ? await encryptData(params.username, key)
      : current.encryptedUsername;
    const encryptedPassword = params.password !== undefined
      ? await encryptData(params.password, key)
      : current.encryptedPassword;
    const encryptedUrl = params.url !== undefined
      ? await encryptData(params.url, key)
      : (current.encryptedUrl ?? (current.url ? await encryptData(current.url, key) : await encryptData('', key)));
    const encryptedNotes = params.notes !== undefined
      ? await encryptData(params.notes, key)
      : current.encryptedNotes;

    let encryptedTotpSecret = current.encryptedTotpSecret;
    if (params.totpSecret !== undefined) {
      if (params.totpSecret.trim().length > 0) {
        const cleanSecret = parseOtpAuthUrl(params.totpSecret);
        encryptedTotpSecret = await encryptData(cleanSecret, key);
      } else {
        encryptedTotpSecret = undefined;
      }
    }

    vault.items[idx] = {
      ...current,
      encryptedTitle,
      encryptedUrl,
      encryptedUsername,
      encryptedPassword,
      category: params.category !== undefined ? params.category : (current.category || 'LOGIN'),
      encryptedNotes,
      encryptedTotpSecret,
      updatedAt: new Date().toISOString(),
      history: updatedHistory,
    };

    delete vault.items[idx].title;
    delete vault.items[idx].url;

    await saveStoredVault(vault);
    const email = SessionService.getActiveUserEmail() || '';
    await StorageService.addAuditLog(email, 'CREDENTIAL_UPDATED', `Credencial atualizada e re-criptografada.`);
  },

  /**
   * Remove uma credencial permanentemente do cofre.
   */
  async remove(id: string): Promise<void> {
    const vault = await loadStoredVault();
    vault.items = vault.items.filter((i) => i.id !== id);
    await saveStoredVault(vault);
    const email = SessionService.getActiveUserEmail() || '';
    await StorageService.addAuditLog(email, 'CREDENTIAL_DELETED', `Credencial removida do cofre.`);
  },

  /**
   * Retorna a senha em texto claro de um item específico.
   */
  async revealPassword(id: string): Promise<string> {
    const key = await getOrInitDEK();
    const vault = await loadStoredVault();
    const item = vault.items.find((i) => i.id === id);
    if (!item) throw new Error('Credencial não encontrada.');
    const email = SessionService.getActiveUserEmail() || '';
    await StorageService.addAuditLog(email, 'PASSWORD_COPIED', `Senha revelada/copiada.`);
    return decryptData(item.encryptedPassword, key);
  },

  /**
   * Retorna o segredo TOTP decifrado de um item específico.
   */
  async revealTotpSecret(id: string): Promise<string | null> {
    const key = await getOrInitDEK();
    const vault = await loadStoredVault();
    const item = vault.items.find((i) => i.id === id);
    if (!item || !item.encryptedTotpSecret) return null;
    return decryptData(item.encryptedTotpSecret, key);
  },

  /**
   * Gera o código TOTP ao vivo de 6 dígitos para o item e o tempo restante do período (30s).
   */
  async getTotpCode(id: string): Promise<{ code: string; remainingSeconds: number; period: number } | null> {
    const secret = await this.revealTotpSecret(id);
    if (!secret) return null;

    const now = Date.now();
    const code = await generateTOTP(secret, now);
    const period = 30;
    const epochSec = Math.floor(now / 1000);
    const remainingSeconds = period - (epochSec % period);

    return { code, remainingSeconds, period };
  },

  /**
   * Decriptografa a senha de uma entrada do histórico.
   */
  async revealHistoryPassword(itemId: string, historyId: string): Promise<string> {
    const key = await getOrInitDEK();
    const vault = await loadStoredVault();
    const item = vault.items.find((i) => i.id === itemId);
    if (!item) throw new Error('Credencial não encontrada.');
    const hist = item.history.find((h) => h.id === historyId);
    if (!hist) throw new Error('Entrada de histórico não encontrada.');
    return decryptData(hist.encryptedPassword, key);
  },

  /**
   * Re-encripta o cofre instantaneamente via Envelope Encryption:
   * Re-cifra apenas a DEK de 256 bits com a nova Master Key (KEK), sem risco de corromper itens.
   */
  async reencryptVault(oldKey: CryptoKey, newKey: CryptoKey): Promise<void> {
    const vault = await loadStoredVault();
    
    let currentDEK: CryptoKey;
    if (vault.encryptedDek) {
      currentDEK = await unwrapDEK(vault.encryptedDek, oldKey);
    } else {
      // Se legado, inicializa DEK
      currentDEK = await getOrInitDEK();
    }

    // Cifra a mesma DEK com a nova KEK (Instantâneo e Seguro)
    const newWrappedDek = await wrapDEK(currentDEK, newKey);
    vault.encryptedDek = newWrappedDek;
    vault.version = 2;

    await saveStoredVault(vault);

    activeDEK = currentDEK;
    const email = SessionService.getActiveUserEmail() || '';
    await StorageService.addAuditLog(email, 'DEK_ROTATED', 'Chave Mestra rotacionada com sucesso via Envelope Encryption.');
  },

  /**
   * Exporta o vault como JSON criptografado (apenas ciphertext) para backup.
   */
  async exportEncryptedBlob(): Promise<string> {
    const email = SessionService.getActiveUserEmail() || '';
    const raw = await StorageService.getEncryptedVault(email);
    const profile = await StorageService.getUserProfile(email);
    const exportData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      salt: profile?.salt,
      kdfAlgorithm: profile?.kdfAlgorithm || 'argon2id',
      algorithm: 'AES-256-GCM / Envelope Encryption / Argon2id (RFC 9106)',
      vault: raw ? JSON.parse(raw) : { items: [] },
    };
    await StorageService.addAuditLog(email, 'BACKUP_EXPORTED', 'Backup criptografado exportado com sucesso.');
    return JSON.stringify(exportData, null, 2);
  },

  /**
   * Importa um backup criptografado em formato JSON.
   */
  async importEncryptedBlob(
    backupJson: string,
    passwordUsed: string,
    merge: boolean = true
  ): Promise<{ success: boolean; importedCount: number }> {
    try {
      const parsed = JSON.parse(backupJson);
      if (!parsed.salt || !parsed.vault) {
        throw new Error('Formato de backup inválido.');
      }

      // 1. Identifica algoritmo do backup e deriva chave temporária (KEK do backup)
      const backupKdf = parsed.kdfAlgorithm || (parsed.algorithm?.includes('PBKDF2') ? 'pbkdf2' : 'argon2id');
      const tempKek = await deriveKey(passwordUsed, parsed.salt, backupKdf);

      // 2. Obtém a chave do backup (se Envelope Encryption ou legado direto)
      let backupDek = tempKek;
      if (parsed.vault.encryptedDek) {
        backupDek = await unwrapDEK(parsed.vault.encryptedDek, tempKek);
      }

      // 3. Decriptografa todos os itens do backup
      const backupItems: StoredVaultItem[] = parsed.vault.items || [];
      const decryptedItems = [];

      for (const item of backupItems) {
        const title = item.encryptedTitle
          ? await decryptData(item.encryptedTitle, backupDek)
          : (item.title || '');
        const username = await decryptData(item.encryptedUsername, backupDek);
        const password = await decryptData(item.encryptedPassword, backupDek);
        const url = item.encryptedUrl
          ? await decryptData(item.encryptedUrl, backupDek)
          : (item.url || '');
        const notes = item.encryptedNotes
          ? await decryptData(item.encryptedNotes, backupDek)
          : undefined;
        const totp = item.encryptedTotpSecret
          ? await decryptData(item.encryptedTotpSecret, backupDek)
          : undefined;

        const decryptedHistory = [];
        if (item.history) {
          for (const h of item.history) {
            const hUsername = await decryptData(h.encryptedUsername, backupDek);
            const hPassword = await decryptData(h.encryptedPassword, backupDek);
            decryptedHistory.push({
              username: hUsername,
              password: hPassword,
              updatedAt: h.updatedAt,
            });
          }
        }

        decryptedItems.push({
          id: item.id,
          title,
          url,
          username,
          password,
          category: item.category || 'LOGIN',
          notes,
          totpSecret: totp,
          updatedAt: item.updatedAt,
          history: decryptedHistory,
        });
      }

      // 4. Re-encripta tudo com a DEK ativa do usuário
      const activeDek = await getOrInitDEK();
      const newlyEncryptedItems: StoredVaultItem[] = [];

      for (const item of decryptedItems) {
        const encryptedTitle = await encryptData(item.title, activeDek);
        const encryptedUsername = await encryptData(item.username, activeDek);
        const encryptedPassword = await encryptData(item.password, activeDek);
        const encryptedUrl = await encryptData(item.url || '', activeDek);
        const encryptedNotes = item.notes
          ? await encryptData(item.notes, activeDek)
          : undefined;
        const encryptedTotpSecret = item.totpSecret
          ? await encryptData(item.totpSecret, activeDek)
          : undefined;

        const newlyEncryptedHistory: StoredHistoryItem[] = [];
        for (const h of item.history) {
          const hEncUsername = await encryptData(h.username, activeDek);
          const hEncPassword = await encryptData(h.password, activeDek);
          newlyEncryptedHistory.push({
            id: generateId(),
            encryptedUsername: hEncUsername,
            encryptedPassword: hEncPassword,
            updatedAt: h.updatedAt,
          });
        }

        newlyEncryptedItems.push({
          id: item.id,
          encryptedTitle,
          encryptedUrl,
          encryptedUsername,
          encryptedPassword,
          category: item.category,
          encryptedNotes,
          encryptedTotpSecret,
          updatedAt: item.updatedAt,
          history: newlyEncryptedHistory,
        });
      }

      // 5. Salva no Storage
      const currentStoredVault = await loadStoredVault();
      let finalItems: StoredVaultItem[] = [];

      if (merge) {
        const currentMap = new Map<string, StoredVaultItem>();
        currentStoredVault.items.forEach((item) => currentMap.set(item.id, item));
        newlyEncryptedItems.forEach((item) => currentMap.set(item.id, item));
        finalItems = Array.from(currentMap.values());
      } else {
        finalItems = newlyEncryptedItems;
      }

      currentStoredVault.items = finalItems;
      await saveStoredVault(currentStoredVault);
      const email = SessionService.getActiveUserEmail() || '';
      await StorageService.addAuditLog(email, 'VAULT_IMPORTED', `Backup importado com sucesso (${newlyEncryptedItems.length} credenciais).`);

      return { success: true, importedCount: newlyEncryptedItems.length };
    } catch (e: unknown) {
      console.error('[VaultService] Erro ao importar backup:', e);
      throw new Error(getErrorMessage(e) || 'Falha ao descriptografar ou processar o backup. Verifique a senha mestra digitada.');
    }
  },

  /**
   * Análise de saúde das senhas (Módulo 4).
   * Roda localmente em RAM sem persistir dados decriptografados.
   */
  async analyzePasswordHealth(): Promise<{
    total: number;
    weak: number;
    reused: number;
    strongCount: number;
  }> {
    const items = await this.getAll();
    const passwords = items.map((i) => i._plaintextPassword);
    const seen = new Map<string, number>();

    passwords.forEach((p) => seen.set(p, (seen.get(p) ?? 0) + 1));

    const weak = passwords.filter((p) => p.length < 12 || !/[A-Z]/.test(p) || !/[0-9]/.test(p) || !/[!@#$%^&*]/.test(p)).length;
    const reused = [...seen.values()].filter((count) => count > 1).reduce((acc, count) => acc + count, 0);

    return {
      total: passwords.length,
      weak,
      reused,
      strongCount: passwords.length - weak,
    };
  },
};


