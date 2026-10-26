import { StorageService } from './storage';
import { hashSHA256, deriveKey, generateSalt, encryptData, decryptData, exportRawKey, importRawKey } from '../crypto/webcrypto';
import { KdfAlgorithm } from '../types';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { VaultService } from './vault';
import { getErrorMessage } from '../lib/utils';

// Variáveis voláteis na memória RAM (nunca persistidas em disco)
let activeMasterKey: CryptoKey | null = null;
let activeUserEmail: string | null = null; // E-mail da conta ativa na sessão
let activeSessionFingerprint: string | null = null; // Fingerprint de integridade de hardware/ambiente

export const SessionService = {
  /**
   * Gera fingerprint de integridade do ambiente baseado em características do dispositivo.
   */
  async generateSessionFingerprint(): Promise<string> {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.colorDepth || '24',
      new Date().getTimezoneOffset().toString()
    ].join('|');
    return hashSHA256(components);
  },

  /**
   * Valida se a sessão atual ainda corresponde ao ambiente de inicialização.
   */
  async validateSessionIntegrity(): Promise<boolean> {
    if (!activeSessionFingerprint) return true;
    const currentFingerprint = await this.generateSessionFingerprint();
    const isValid = currentFingerprint === activeSessionFingerprint;
    if (!isValid) {
      const email = this.getActiveUserEmail() || '';
      await StorageService.addAuditLog(
        email,
        'SESSION_INVALIDATED',
        'Sessão invalidada: anomalia no fingerprint de ambiente detectada (possível roubo/migração de sessão).'
      );
      this.clearSession();
    }
    return isValid;
  },

  /**
   * Registra o fingerprint da sessão ativa.
   */
  async recordSessionFingerprint(): Promise<void> {
    activeSessionFingerprint = await this.generateSessionFingerprint();
  },

  /**
   * Verifica se o usuário possui chave mestra ativa carregada na memória RAM.
   */
  isKeyLoaded(): boolean {
    return activeMasterKey !== null;
  },

  /**
   * Obtém a chave mestra ativa na memória RAM.
   * Dispara um erro caso a sessão esteja totalmente expirada, forçando login.
   */
  getMasterKey(): CryptoKey {
    if (!activeMasterKey) {
      throw new Error('Sessão expirada ou chave criptográfica não carregada na RAM.');
    }
    return activeMasterKey;
  },

  /**
   * Obtém o e-mail da conta ativa na RAM.
   */
  getActiveUserEmail(): string | null {
    return activeUserEmail;
  },

  /**
   * Define manualmente a chave mestra ativa na memória.
   */
  setMasterKey(key: CryptoKey, email?: string): void {
    activeMasterKey = key;
    if (email) activeUserEmail = email;
    this.persistCurrentSession().catch(() => {});
  },

  /**
   * Limpa a chave mestra e a DEK da RAM (Logoff total / Wipe de segurança).
   */
  clearSession(): void {
    activeMasterKey = null;
    activeUserEmail = null;
    activeSessionFingerprint = null;
    VaultService.clearSessionDEK();
    StorageService.clearPersistedSession().catch(() => {});
  },

  /**
   * Obtém a chave criptográfica de proteção local vinculada a este dispositivo e navegador.
   * Utiliza Web Crypto nativo com SHA-256 e AES-GCM (256 bits), sem overhead ou problemas de encoding.
   */
  async getDeviceProtectorKey(): Promise<CryptoKey> {
    const salt = await StorageService.getDeviceProtectorSalt();
    const encoder = new TextEncoder();
    const rawData = encoder.encode(`seguranapp_device_session_salt_${salt}`);
    const hash = await window.crypto.subtle.digest('SHA-256', rawData);
    return await window.crypto.subtle.importKey(
      'raw',
      hash,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  /**
   * Persiste a chave ativa no storage criptografada com chave derivada do dispositivo,
   * permitindo manter a sessão aberta ao atualizar a página (F5) caso a opção esteja ativa.
   */
  async persistCurrentSession(): Promise<void> {
    try {
      if (!activeMasterKey || !activeUserEmail) {
        return;
      }
      const isEnabled = await StorageService.isRememberSessionEnabled();
      if (!isEnabled) {
        await StorageService.clearPersistedSession();
        return;
      }

      // Exporta a chave mestra em Base64
      const rawKeyB64 = await exportRawKey(activeMasterKey);

      // Obtém chave de proteção local do dispositivo
      const deviceProtectorKey = await this.getDeviceProtectorKey();

      const payloadObj = {
        email: activeUserEmail,
        key: rawKeyB64,
        timestamp: Date.now()
      };

      const encrypted = await encryptData(JSON.stringify(payloadObj), deviceProtectorKey);
      await StorageService.savePersistedSession(JSON.stringify(encrypted));
      console.log('[SeguranApp] Sessão persistida com sucesso para:', activeUserEmail);
    } catch (err) {
      console.warn('[SeguranApp] Não foi possível persistir a sessão local:', err);
    }
  },

  /**
   * Tenta restaurar a sessão após recarregar a página (F5) caso a opção esteja ativada.
   */
  async tryRestorePersistedSession(): Promise<boolean> {
    try {
      const isEnabled = await StorageService.isRememberSessionEnabled();
      if (!isEnabled) {
        return false;
      }

      const storedStr = await StorageService.getPersistedSession();
      if (!storedStr) {
        return false;
      }

      const encrypted = JSON.parse(storedStr);
      const deviceProtectorKey = await this.getDeviceProtectorKey();

      const decryptedStr = await decryptData(encrypted, deviceProtectorKey);
      const sessionData = JSON.parse(decryptedStr);

      if (!sessionData.key || !sessionData.email) {
        return false;
      }

      // Validação de expiração / TTL da sessão persistida (máximo 30 dias) - A-4
      const MAX_SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000;
      if (!sessionData.timestamp || (Date.now() - sessionData.timestamp) > MAX_SESSION_AGE_MS) {
        console.warn('[SeguranApp] Sessão persistida expirada (> 30 dias).');
        await StorageService.clearPersistedSession();
        return false;
      }

      const restoredKey = await importRawKey(sessionData.key);
      activeMasterKey = restoredKey;
      activeUserEmail = sessionData.email;
      await this.recordSessionFingerprint();
      console.log('[SeguranApp] Sessão restaurada com sucesso para:', activeUserEmail);

      return true;
    } catch (err) {
      console.warn('[SeguranApp] Falha ao restaurar sessão persistida:', err);
      await StorageService.clearPersistedSession();
      return false;
    }
  },

  /**
   * Atualiza a senha no Firebase Auth e o salt no Firestore com Argon2id.
   */
  async updateMasterPassword(newPassword: string, newSalt: string): Promise<{ success: boolean; error?: string }> {
    if (!auth.currentUser) {
      return { success: false, error: 'Usuário não autenticado no servidor.' };
    }
    try {
      await updatePassword(auth.currentUser, newPassword);
      await StorageService.updateUserKdf(newSalt, 'argon2id');
      return { success: true };
    } catch (err: unknown) {
      console.error('Erro ao atualizar senha no Firebase Auth:', err);
      return { success: false, error: getErrorMessage(err) || 'Falha ao sincronizar nova senha com o servidor.' };
    }
  },

  /**
   * Executa a tentativa de autenticação com o e-mail e senha mestra.
   * Valida políticas de força bruta local e executa migração transparente de PBKDF2 para Argon2id.
   */
  async authenticateMaster(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const emailKey = email.toLowerCase().trim();
    
    // 1. Verifica estado de bloqueio de força bruta
    const lockout = await this.checkLockout();
    if (lockout.isLocked) {
      return { success: false, error: lockout.message };
    }

    try {
      // 2. Autentica no Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, emailKey, password);
      const user = userCredential.user;

      // 3. Busca o perfil do usuário no Firestore usando o uid
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        return { success: false, error: 'Dados do perfil não encontrados no servidor.' };
      }
      
      const profileData = docSnap.data();

      // Validação de lockout server-side (A-1)
      if (profileData.lockoutState?.lockoutUntil) {
        const serverLockTime = new Date(profileData.lockoutState.lockoutUntil).getTime();
        if (Date.now() < serverLockTime) {
          await auth.signOut();
          const remainingSecs = Math.ceil((serverLockTime - Date.now()) / 1000);
          return {
            success: false,
            error: `Conta temporariamente bloqueada no servidor. Tente novamente em ${remainingSecs}s.`
          };
        }
      }

      // Reseta erros locais e no servidor
      await this.resetFailedAttempts();
      activeUserEmail = emailKey;
      
      // 4. Identifica se o usuário já usa Argon2id ou necessita de migração de PBKDF2
      const kdfAlgo: KdfAlgorithm = profileData.kdfAlgorithm || 'pbkdf2';

      if (kdfAlgo === 'argon2id') {
        // Derivação direta em Argon2id
        activeMasterKey = await deriveKey(password, profileData.salt, 'argon2id');
      } else {
        // --- ROTINA DE MIGRAÇÃO TRANSPARENTE PBKDF2 -> ARGON2ID ---
        // 1. Deriva chave legada temporária
        const legacyKey = await deriveKey(password, profileData.salt, 'pbkdf2');

        // 2. Gera novo salt criptográfico e deriva nova chave com Argon2id
        const newSalt = generateSalt(16);
        const newKey = await deriveKey(password, newSalt, 'argon2id');

        // 3. Re-criptografa atomicamente todo o cofre de credenciais
        await VaultService.reencryptVault(legacyKey, newKey);

        // 4. Se houver segredo TOTP cifrado na conta, re-criptografa com a nova chave
        if (profileData.encryptedTotpSecret) {
          try {
            const plainSecret = await decryptData(profileData.encryptedTotpSecret, legacyKey);
            const newEncryptedTotp = await encryptData(plainSecret, newKey);
            await setDoc(docRef, { encryptedTotpSecret: newEncryptedTotp }, { merge: true });
          } catch (totpMigrateErr) {
            console.warn('Falha ao migrar segredo TOTP durante atualização para Argon2id:', totpMigrateErr);
          }
        }

        // 5. Atualiza o perfil no Firestore com o novo salt e kdfAlgorithm: 'argon2id'
        await StorageService.updateUserKdf(newSalt, 'argon2id');

        // 6. Define a nova chave mestra na RAM
        activeMasterKey = newKey;

        // 7. Registra evento de auditoria da migração
        await StorageService.addAuditLog(
          emailKey,
          'CREDENTIAL_UPDATED',
          'Migração de segurança executada: Derivação de chave atualizada transparentemente de PBKDF2 para Argon2id (RFC 9106).'
        );
      }
      
      // Adiciona o log de sucesso
      await StorageService.addAuditLog(emailKey, 'LOGIN_SUCCESS', 'Autenticação bem-sucedida via Senha Mestra (Argon2id).');

      // Persiste a sessão para restaurar ao atualizar a página (se opção estiver ativa)
      await this.persistCurrentSession();

      return { success: true };
    } catch (err: unknown) {
      const attempts = await this.incrementFailedAttempts();
      const remaining = 3 - attempts;
      
      let errorMsg = 'E-mail ou Senha Mestra incorretos.';
      const errCode = (err && typeof err === 'object' && 'code' in err) ? String((err as { code: unknown }).code) : '';
      if (errCode === 'auth/user-not-found') {
        errorMsg = 'Usuário não cadastrado.';
      } else if (errCode === 'auth/invalid-credential' || errCode === 'auth/wrong-password') {
        errorMsg = remaining > 0
          ? `Senha mestra incorreta. Você tem mais ${remaining} tentativa(s) antes do bloqueio.`
          : 'Senha mestra incorreta.';
      }
      
      if (attempts >= 3) {
        const lockout = await this.checkLockout();
        return { 
          success: false, 
          error: lockout.message || 'Número de tentativas excedido. Aplicativo bloqueado temporariamente.' 
        };
      } else {
        return { 
          success: false, 
          error: errorMsg 
        };
      }
    }
  },

  /**
   * Valida se a senha mestra segue a política rigorosa de segurança do TCC.
   */
  validatePasswordStrength(password: string): { isValid: boolean; feedback: string[] } {
    const feedback: string[] = [];
    if (password.length < 12) {
      feedback.push('A senha deve conter no mínimo 12 caracteres.');
    }
    if (!/[A-Z]/.test(password)) {
      feedback.push('A senha deve conter pelo menos uma letra maiúscula.');
    }
    if (!/[a-z]/.test(password)) {
      feedback.push('A senha deve conter pelo menos uma letra minúscula.');
    }
    if (!/[0-9]/.test(password)) {
      feedback.push('A senha deve conter pelo menos um número.');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      feedback.push('A senha deve conter pelo menos um caractere especial (!@#$...).');
    }

    return {
      isValid: feedback.length === 0,
      feedback
    };
  },

  /**
   * Registra um novo usuário com e-mail e senha no Firebase Auth e Firestore usando Argon2id.
   */
  async registerUser(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const emailKey = email.toLowerCase().trim();

    const val = this.validatePasswordStrength(password);
    if (!val.isValid) {
      return { success: false, error: `Senha fraca: ${val.feedback.join(' ')}` };
    }

    try {
      // 1. Cria o usuário no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, emailKey, password);
      const user = userCredential.user;

      // 2. Gera salt seguro e único para o usuário
      const saltBase64 = generateSalt(16);

      // 3. Salva o perfil inicial do usuário no Firestore com kdfAlgorithm: 'argon2id'
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, {
        email: emailKey,
        salt: saltBase64,
        kdfAlgorithm: 'argon2id',
        totpEnabled: false,
        encryptedVault: '',
        auditLogs: [],
        createdAt: new Date().toISOString()
      });

      // 4. Deriva a chave com Argon2id e carrega na RAM
      activeMasterKey = await deriveKey(password, saltBase64, 'argon2id');
      activeUserEmail = emailKey;

      await StorageService.addAuditLog(emailKey, 'LOGIN_SUCCESS', 'Perfil registrado com sucesso no Firebase com Argon2id.');
      await this.persistCurrentSession();

      return { success: true };
    } catch (err: unknown) {
      let errorMsg = 'Erro ao registrar no servidor.';
      const errCode = (err && typeof err === 'object' && 'code' in err) ? String((err as { code: unknown }).code) : '';
      if (errCode === 'auth/email-already-in-use') {
        errorMsg = 'Este e-mail já está cadastrado.';
      } else if (errCode === 'auth/invalid-email') {
        errorMsg = 'E-mail inválido.';
      } else if (errCode === 'auth/weak-password') {
        errorMsg = 'A senha fornecida é muito fraca para o Firebase.';
      }
      return { success: false, error: errorMsg };
    }
  },

  /**
   * Tabela de lockout exponencial progressivo (em segundos).
   * A duração cresce conforme as falhas acumuladas para resistir a ataques de força bruta físicos.
   * Jitter de ±10% é aplicado para resistir a timing-attacks.
   */
  _getLockoutDurationSeconds(attempts: number): number | null {
    const table: Record<number, number> = {
      3: 60,     // 1ª falha de lockout: 1 minuto
      4: 300,    // 2ª falha: 5 minutos
      5: 900,    // 3ª falha: 15 minutos
    };
    if (attempts < 3) return null;
    const base = table[attempts] ?? 3600; // >= 6 falhas: 1 hora
    // Jitter de ±10% para resistir a timing-attacks
    const jitter = base * 0.1 * (Math.random() * 2 - 1);
    return Math.round(base + jitter);
  },

  /**
   * Verifica se o dispositivo está atualmente bloqueado por força bruta.
   */
  async checkLockout(): Promise<{ isLocked: boolean; remainingSeconds: number; message?: string }> {
    const { attempts, lockoutUntil } = await StorageService.getLockoutState();
    
    if (lockoutUntil) {
      const now = Date.now();
      const lockTime = new Date(lockoutUntil).getTime();
      
      if (now < lockTime) {
        const remaining = Math.ceil((lockTime - now) / 1000);
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        return {
          isLocked: true,
          remainingSeconds: remaining,
          message: `Defesa de Força Bruta Ativa: Tente novamente em ${timeStr}. (Tentativa ${attempts})`
        };
      } else {
        // O tempo de bloqueio expirou: remove o bloqueio ativo, mas NÃO zera o contador de tentativas acumuladas (A-2)
        await StorageService.saveLockoutState(attempts, null);
      }
    }
    
    return { isLocked: false, remainingSeconds: 0 };
  },

  /**
   * Incrementa as tentativas incorretas e aplica lockout exponencial progressivo
   * a partir da 3ª falha consecutiva.
   */
  async incrementFailedAttempts(): Promise<number> {
    let { attempts } = await StorageService.getLockoutState();
    attempts += 1;

    const lockoutSecs = this._getLockoutDurationSeconds(attempts);
    let lockoutTime: string | null = null;

    if (lockoutSecs !== null) {
      const date = new Date(Date.now() + lockoutSecs * 1000);
      lockoutTime = date.toISOString();
      const email = this.getActiveUserEmail() || '';
      const mins = Math.floor(lockoutSecs / 60);
      const secsRem = lockoutSecs % 60;
      const label = mins > 0 ? `${mins}m ${secsRem}s` : `${secsRem}s`;
      await StorageService.addAuditLog(
        email,
        'PIN_LOCKED',
        `Bloqueio por força bruta (tentativa ${attempts}): dispositivo bloqueado por ${label}.`
      );
    }

    await StorageService.saveLockoutState(attempts, lockoutTime);
    return attempts;
  },

  /**
   * Reseta o contador de erros locais.
   */
  async resetFailedAttempts(): Promise<void> {
    await StorageService.saveLockoutState(0, null);
  }
};

