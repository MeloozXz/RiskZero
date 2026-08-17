import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { encryptData, decryptData, deriveKey, generateSalt } from '../crypto/webcrypto';

const BIOMETRIC_KEY_PREFIX = 'zk_bio_auth_';
const BIOMETRIC_CONFIG_PREFIX = 'zk_bio_config_';

export type BiometricType = 'FACE_ID' | 'TOUCH_ID' | 'FINGERPRINT' | 'BIOMETRICS' | 'NONE';

export interface BiometricHardwareStatus {
  isAvailable: boolean;
  biometricType: BiometricType;
  isEnrolled: boolean;
  error?: string;
}

export type BiometricErrorCode = 
  | 'USER_CANCELLED'
  | 'BIOMETRIC_FAILED'
  | 'NOT_AVAILABLE'
  | 'NOT_ENROLLED'
  | 'LOCKED_OUT'
  | 'UNKNOWN_ERROR';

export interface BiometricAuthResult {
  success: boolean;
  masterPassword?: string;
  errorCode?: BiometricErrorCode;
  error?: string;
}

export interface BiometricConfig {
  enabled: boolean;
  credentialId: string;
  registeredAt: string;
  biometricType: BiometricType;
}

export const BiometricsService = {
  /**
   * Verifica detalhadamente a disponibilidade de hardware biométrico no dispositivo ou navegador.
   */
  async checkHardwareStatus(): Promise<BiometricHardwareStatus> {
    try {
      if (!window.PublicKeyCredential && !Capacitor.isNativePlatform()) {
        return {
          isAvailable: false,
          biometricType: 'NONE',
          isEnrolled: false,
          error: 'Hardware ou API biométrica não suportada neste ambiente.'
        };
      }

      let isAvailable = !!window.PublicKeyCredential || Capacitor.isNativePlatform();
      let biometricType: BiometricType = 'BIOMETRICS';

      if (window.PublicKeyCredential && window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
        try {
          const platformAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          if (platformAvailable) {
            isAvailable = true;
          }
        } catch {
          // Ignora erro e mantém a API WebAuthn habilitada
        }
      }

      // Detecção de tipo de biometria baseada em UserAgent / Plataforma
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('macintosh')) {
        biometricType = 'FACE_ID';
      } else if (ua.includes('android')) {
        biometricType = 'FINGERPRINT';
      } else {
        biometricType = 'BIOMETRICS';
      }

      return {
        isAvailable,
        biometricType,
        isEnrolled: isAvailable
      };
    } catch (err: any) {
      return {
        isAvailable: false,
        biometricType: 'NONE',
        isEnrolled: false,
        error: err?.message || 'Erro ao consultar sensores de biometria.'
      };
    }
  },

  /**
   * Alias de conveniência para verificar disponibilidade simples
   */
  async isAvailable(): Promise<boolean> {
    const status = await this.checkHardwareStatus();
    return status.isAvailable;
  },

  /**
   * Cadastra a biometria nativa para uma conta ativa.
   */
  async registerBiometrics(email: string, masterPassword: string): Promise<BiometricAuthResult> {
    try {
      const hwStatus = await this.checkHardwareStatus();
      if (!hwStatus.isAvailable) {
        return {
          success: false,
          errorCode: 'NOT_AVAILABLE',
          error: 'Hardware biométrico indisponível ou desativado no sistema.'
        };
      }

      const emailKey = email.toLowerCase().trim();
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      // Prompt nativo / WebAuthn de autenticação biométrica
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: { name: "Cofre Seguro Cyber Obsidian" },
          user: {
            id: userId,
            name: emailKey,
            displayName: emailKey
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required"
          },
          timeout: 60000
        }
      }) as PublicKeyCredential;

      if (!credential) {
        return {
          success: false,
          errorCode: 'USER_CANCELLED',
          error: 'Autenticação biométrica cancelada pelo usuário.'
        };
      }

      const rawId = new Uint8Array(credential.rawId);
      const credentialIdB64 = btoa(String.fromCharCode.apply(null, Array.from(rawId)));

      // Gera senha local forte para cifrar a master key
      const localBioPasswordArray = new Uint8Array(32);
      window.crypto.getRandomValues(localBioPasswordArray);
      const localBioPassword = btoa(String.fromCharCode.apply(null, Array.from(localBioPasswordArray)));
      const salt = generateSalt();

      const cryptoKey = await deriveKey(localBioPassword, salt);
      const encryptedMasterPassword = await encryptData(masterPassword, cryptoKey);

      const payload = JSON.stringify({
        encryptedMasterPassword,
        localBioPassword,
        salt
      });

      // Salva no storage local seguro do Capacitor
      await Preferences.set({
        key: `${BIOMETRIC_KEY_PREFIX}${emailKey}`,
        value: payload
      });

      const config: BiometricConfig = {
        enabled: true,
        credentialId: credentialIdB64,
        registeredAt: new Date().toISOString(),
        biometricType: hwStatus.biometricType
      };

      await Preferences.set({
        key: `${BIOMETRIC_CONFIG_PREFIX}${emailKey}`,
        value: JSON.stringify(config)
      });

      // Fallback para localStorage
      localStorage.setItem(`${BIOMETRIC_KEY_PREFIX}${emailKey}`, payload);
      localStorage.setItem(`${BIOMETRIC_CONFIG_PREFIX}${emailKey}`, JSON.stringify(config));

      return { success: true };
    } catch (err: any) {
      console.error('Erro no registro biométrico:', err);
      const message = err?.message || '';
      
      let errorCode: BiometricErrorCode = 'UNKNOWN_ERROR';
      if (message.includes('cancel') || message.includes('abort')) {
        errorCode = 'USER_CANCELLED';
      } else if (message.includes('not allowed') || message.includes('NotAllowedError')) {
        errorCode = 'USER_CANCELLED';
      }

      return {
        success: false,
        errorCode,
        error: message || 'Falha ao vincular biometria do dispositivo.'
      };
    }
  },

  /**
   * Verifica se o e-mail possui biometria cadastrada.
   */
  isEnrolled(email: string): boolean {
    const emailKey = email.toLowerCase().trim();
    const configStr = localStorage.getItem(`${BIOMETRIC_CONFIG_PREFIX}${emailKey}`);
    if (!configStr) return false;
    try {
      const config = JSON.parse(configStr) as BiometricConfig;
      return config.enabled && !!config.credentialId;
    } catch {
      return false;
    }
  },

  /**
   * Retorna a lista de e-mails com biometria ativa cadastrada neste dispositivo.
   */
  getEnrolledEmails(): string[] {
    const emails: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(BIOMETRIC_CONFIG_PREFIX)) {
          const email = key.replace(BIOMETRIC_CONFIG_PREFIX, '');
          if (email && this.isEnrolled(email)) {
            emails.push(email);
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao ler e-mails biométricos cadastrados:', err);
    }
    return emails;
  },

  /**
   * Desativa e limpa os registros biométricos do usuário.
   */
  async disableBiometrics(email: string): Promise<void> {
    const emailKey = email.toLowerCase().trim();
    await Preferences.remove({ key: `${BIOMETRIC_KEY_PREFIX}${emailKey}` });
    await Preferences.remove({ key: `${BIOMETRIC_CONFIG_PREFIX}${emailKey}` });
    localStorage.removeItem(`${BIOMETRIC_KEY_PREFIX}${emailKey}`);
    localStorage.removeItem(`${BIOMETRIC_CONFIG_PREFIX}${emailKey}`);
  },

  /**
   * Dispara o prompt biométrico nativo do SO para ler a chave mestra em memória.
   */
  async authenticate(email: string): Promise<BiometricAuthResult> {
    try {
      const emailKey = email.toLowerCase().trim();
      
      let configStr = (await Preferences.get({ key: `${BIOMETRIC_CONFIG_PREFIX}${emailKey}` })).value;
      let keyDataStr = (await Preferences.get({ key: `${BIOMETRIC_KEY_PREFIX}${emailKey}` })).value;

      if (!configStr || !keyDataStr) {
        configStr = localStorage.getItem(`${BIOMETRIC_CONFIG_PREFIX}${emailKey}`);
        keyDataStr = localStorage.getItem(`${BIOMETRIC_KEY_PREFIX}${emailKey}`);
      }

      if (!configStr || !keyDataStr) {
        return {
          success: false,
          errorCode: 'NOT_ENROLLED',
          error: 'Nenhuma chave biométrica registrada para esta conta.'
        };
      }

      const config = JSON.parse(configStr) as BiometricConfig;
      const keyData = JSON.parse(keyDataStr);

      const rawId = new Uint8Array(
        atob(config.credentialId)
          .split("")
          .map((c) => c.charCodeAt(0))
      );

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      // Desencadeia o prompt biométrico do hardware do dispositivo
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          allowCredentials: [{
            id: rawId,
            type: "public-key"
          }],
          userVerification: "required",
          timeout: 60000
        }
      });

      if (!assertion) {
        return {
          success: false,
          errorCode: 'BIOMETRIC_FAILED',
          error: 'A validação biométrica falhou.'
        };
      }

      // Deriva CryptoKey em memória
      const cryptoKey = await deriveKey(keyData.localBioPassword, keyData.salt);
      const masterPassword = await decryptData(keyData.encryptedMasterPassword, cryptoKey);

      return {
        success: true,
        masterPassword
      };
    } catch (err: any) {
      console.error('Erro na verificação biométrica:', err);
      const msg = err?.message || '';

      let errorCode: BiometricErrorCode = 'UNKNOWN_ERROR';
      if (msg.includes('NotAllowedError') || msg.includes('cancel')) {
        errorCode = 'USER_CANCELLED';
      } else if (msg.includes('lockout') || msg.includes('blocked')) {
        errorCode = 'LOCKED_OUT';
      } else {
        errorCode = 'BIOMETRIC_FAILED';
      }

      return {
        success: false,
        errorCode,
        error: msg || 'Ocorreu uma falha ao autenticar com a biometria nativa.'
      };
    }
  }
};
