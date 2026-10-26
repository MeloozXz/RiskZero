import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { 
  encryptData, 
  decryptData, 
  deriveKey, 
  generateSalt,
  arrayBufferToBase64,
  base64ToArrayBuffer
} from '../crypto/webcrypto';

const BIOMETRIC_KEY_PREFIX = 'zk_bio_auth_';
const BIOMETRIC_CONFIG_PREFIX = 'zk_bio_config_';

export type BiometricType = 'FACE_ID' | 'TOUCH_ID' | 'FINGERPRINT' | 'CYBER_SENSOR' | 'BIOMETRICS' | 'NONE';

export interface BiometricHardwareStatus {
  isAvailable: boolean;          // Indica se a biometria (nativa ou cyber emulada) está disponível
  isNativeAvailable: boolean;    // Indica se hardware nativo WebAuthn/Windows Hello/TouchID existe
  biometricType: BiometricType;  // Tipo de biometria detectada
  isEnrolled: boolean;           // Se já existe biometria configurada neste aparelho
  platformName: string;          // Descrição humana do sensor
  isSecureContext: boolean;      // Indica se o contexto é seguro (HTTPS ou localhost)
  error?: string;
}

export type BiometricErrorCode = 
  | 'USER_CANCELLED'
  | 'BIOMETRIC_FAILED'
  | 'NOT_AVAILABLE'
  | 'NOT_ENROLLED'
  | 'LOCKED_OUT'
  | 'INSECURE_CONTEXT'
  | 'UNKNOWN_ERROR';

export interface BiometricAuthResult {
  success: boolean;
  masterPassword?: string;
  errorCode?: BiometricErrorCode;
  error?: string;
  isNative?: boolean;
}

export interface BiometricConfig {
  enabled: boolean;
  credentialId: string;
  registeredAt: string;
  biometricType: BiometricType;
  isNative: boolean;
}

// Handler para o prompt visual do Sensor Cyber Obsidian (quando o SO não possui hardware nativo)
export type BiometricPromptHandler = (params: {
  email: string;
  mode: 'REGISTER' | 'AUTH';
  biometricType: BiometricType;
}) => Promise<boolean>;

let activePromptHandler: BiometricPromptHandler | null = null;

export function registerBiometricPromptHandler(handler: BiometricPromptHandler | null): void {
  activePromptHandler = handler;
}

// Cache em memória para consultas síncronas de status de matrícula
const enrolledCache = new Map<string, boolean>();

export const BiometricsService = {
  /**
   * Inicializa o cache síncrono a partir do storage
   */
  async init(): Promise<void> {
    try {
      // 1. Lê chaves do localStorage
      if (typeof localStorage !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(BIOMETRIC_CONFIG_PREFIX)) {
            const emailKey = key.replace(BIOMETRIC_CONFIG_PREFIX, '');
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (parsed.enabled && parsed.credentialId) {
                  enrolledCache.set(emailKey, true);
                }
              } catch {
                // ignora item corrompido
              }
            }
          }
        }
      }

      // 2. Garante sincronismo com o Preferences do Capacitor
      const capKeys = await Preferences.keys();
      for (const key of capKeys.keys) {
        if (key.startsWith(BIOMETRIC_CONFIG_PREFIX)) {
          const emailKey = key.replace(BIOMETRIC_CONFIG_PREFIX, '');
          const val = (await Preferences.get({ key })).value;
          if (val) {
            try {
              const parsed = JSON.parse(val);
              if (parsed.enabled && parsed.credentialId) {
                enrolledCache.set(emailKey, true);
                if (typeof localStorage !== 'undefined' && !localStorage.getItem(key)) {
                  localStorage.setItem(key, val);
                }
              }
            } catch {
              // ignora
            }
          }
        }
      }
    } catch (err) {
      console.warn('[BiometricsService] Falha ao sincronizar cache biométrico:', err);
    }
  },

  /**
   * Verifica detalhadamente a disponibilidade de hardware biométrico no SO ou navegador.
   */
  async checkHardwareStatus(email?: string): Promise<BiometricHardwareStatus> {
    try {
      const isSecure = typeof window !== 'undefined' && (window.isSecureContext ?? false);
      let isNativeAvailable = false;
      let biometricType: BiometricType = 'BIOMETRICS';
      let platformName = 'Sensor Biométrico Nativo';

      const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
      const isMacOrIOS = ua.includes('iphone') || ua.includes('ipad') || ua.includes('macintosh');
      const isAndroid = ua.includes('android');
      const isWindows = ua.includes('windows');

      if (isMacOrIOS) {
        biometricType = ua.includes('iphone') || ua.includes('ipad') ? 'FACE_ID' : 'TOUCH_ID';
        platformName = biometricType === 'FACE_ID' ? 'Face ID / Touch ID (Apple)' : 'Touch ID (Apple)';
      } else if (isAndroid) {
        biometricType = 'FINGERPRINT';
        platformName = 'Impressão Digital (Android)';
      } else if (isWindows) {
        biometricType = 'FINGERPRINT';
        platformName = 'Windows Hello (Digital / Face / PIN)';
      }

      // Consulta se o autenticador nativo de plataforma está disponível no navegador
      if (isSecure && typeof window !== 'undefined' && window.PublicKeyCredential) {
        if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
          try {
            isNativeAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          } catch {
            isNativeAvailable = false;
          }
        }
      }

      if (Capacitor.isNativePlatform()) {
        isNativeAvailable = true;
      }

      if (!isNativeAvailable) {
        biometricType = 'CYBER_SENSOR';
        platformName = 'Sensor Cyber Obsidian (Zero-Knowledge)';
      }

      const enrolled = email ? this.isEnrolled(email) : this.getEnrolledEmails().length > 0;

      return {
        isAvailable: true, // Sempre disponível (Nativo OU Cyber Sensor de alta segurança)
        isNativeAvailable,
        biometricType,
        isEnrolled: enrolled,
        platformName,
        isSecureContext: isSecure
      };
    } catch (err: any) {
      return {
        isAvailable: true,
        isNativeAvailable: false,
        biometricType: 'CYBER_SENSOR',
        isEnrolled: false,
        platformName: 'Sensor Cyber Obsidian (Zero-Knowledge)',
        isSecureContext: typeof window !== 'undefined' && (window.isSecureContext ?? false),
        error: err?.message
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
   * Dispara prompt do Cyber Sensor (quando nativo não está disponível)
   */
  async promptCyberSensor(email: string, mode: 'REGISTER' | 'AUTH', biometricType: BiometricType): Promise<boolean> {
    if (activePromptHandler) {
      return await activePromptHandler({ email, mode, biometricType });
    }
    // Fallback de segurança (M-5): Se o prompt visual/handler não estiver registrado/montado, rejeita o acesso
    console.warn('[BiometricsService] Prompt biométrico Cyber Sensor não registrado. Acesso negado por segurança.');
    return false;
  },

  /**
   * Cadastra a biometria para a conta informada vinculada à sua Senha Mestra.
   */
  async registerBiometrics(email: string, masterPassword: string): Promise<BiometricAuthResult> {
    try {
      const emailKey = email.toLowerCase().trim();
      const hwStatus = await this.checkHardwareStatus(emailKey);
      let credentialIdB64 = '';
      let isNative = false;

      // 1. TENTA REGISTRO NATIVO WEBAUTHN (se o hardware nativo estiver presente e em ambiente seguro)
      if (hwStatus.isNativeAvailable && typeof window !== 'undefined' && window.PublicKeyCredential && window.isSecureContext) {
        try {
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);

          const userId = new Uint8Array(16);
          window.crypto.getRandomValues(userId);

          const rpEntity: PublicKeyCredentialRpEntity = {
            name: "Cofre Seguro Cyber Obsidian"
          };
          if (
            window.location.hostname && 
            window.location.hostname !== 'localhost' && 
            !/^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname)
          ) {
            rpEntity.id = window.location.hostname;
          }

          // Cria credencial biométrica com suporte universal aos algoritmos:
          // -7 (ES256), -257 (RS256 - essencial para Windows Hello TPM), -8 (Ed25519) e -37 (PS256)
          const credential = await navigator.credentials.create({
            publicKey: {
              challenge,
              rp: rpEntity,
              user: {
                id: userId,
                name: emailKey,
                displayName: emailKey
              },
              pubKeyCredParams: [
                { alg: -7, type: "public-key" },
                { alg: -257, type: "public-key" },
                { alg: -8, type: "public-key" },
                { alg: -37, type: "public-key" }
              ],
              authenticatorSelection: {
                authenticatorAttachment: "platform",
                userVerification: "preferred"
              },
              timeout: 60000
            }
          }) as PublicKeyCredential | null;

          if (credential && credential.rawId) {
            credentialIdB64 = arrayBufferToBase64(credential.rawId);
            isNative = true;
          }
        } catch (nativeErr: any) {
          const msg = nativeErr?.message || '';
          console.warn('[BiometricsService] WebAuthn nativo falhou ou recusado:', msg);
          
          if (msg.includes('NotAllowedError') && (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('abort'))) {
            return {
              success: false,
              errorCode: 'USER_CANCELLED',
              error: 'Cadastro biométrico cancelado pelo usuário.'
            };
          }
          // Outros erros (ex: NotSupportedError na máquina) continuam para o Cyber Sensor
        }
      }

      // 2. SE NÃO USOU NATIVO (máquina sem Windows Hello/leitor, navegador sem suporte, etc.):
      if (!credentialIdB64) {
        const approved = await this.promptCyberSensor(emailKey, 'REGISTER', hwStatus.biometricType);
        if (!approved) {
          return {
            success: false,
            errorCode: 'USER_CANCELLED',
            error: 'Cadastro biométrico cancelado pelo usuário.'
          };
        }

        // Gera identificador criptográfico de alta entropia exclusivo deste dispositivo
        const deviceEntropy = new Uint8Array(32);
        window.crypto.getRandomValues(deviceEntropy);
        credentialIdB64 = arrayBufferToBase64(deviceEntropy);
        isNative = false;
      }

      // 3. DERIVA CHAVE CRIPTOGRÁFICA SEGURA COM SALT DE 16 BYTES
      const salt = generateSalt(16);
      const cryptoKey = await deriveKey(credentialIdB64, salt);
      const encryptedMasterPassword = await encryptData(masterPassword, cryptoKey);

      // Payload seguro (a Senha Mestra é guardada apenas cifrada com AES-256-GCM)
      const payload = JSON.stringify({
        encryptedMasterPassword,
        salt,
        isNative
      });

      const config: BiometricConfig = {
        enabled: true,
        credentialId: credentialIdB64,
        registeredAt: new Date().toISOString(),
        biometricType: isNative ? hwStatus.biometricType : 'CYBER_SENSOR',
        isNative
      };

      // 4. PERSISTE NOS STORAGES
      await Preferences.set({
        key: `${BIOMETRIC_KEY_PREFIX}${emailKey}`,
        value: payload
      });

      await Preferences.set({
        key: `${BIOMETRIC_CONFIG_PREFIX}${emailKey}`,
        value: JSON.stringify(config)
      });

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${BIOMETRIC_KEY_PREFIX}${emailKey}`, payload);
        localStorage.setItem(`${BIOMETRIC_CONFIG_PREFIX}${emailKey}`, JSON.stringify(config));
      }

      // Atualiza cache em memória
      enrolledCache.set(emailKey, true);

      return { 
        success: true,
        isNative
      };

    } catch (err: any) {
      console.error('[BiometricsService] Erro no registro biométrico:', err);
      const message = err?.message || '';
      
      let errorCode: BiometricErrorCode = 'UNKNOWN_ERROR';
      if (message.includes('cancel') || message.includes('abort') || message.includes('NotAllowedError')) {
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
   * Verifica de forma síncrona se o e-mail possui biometria cadastrada.
   */
  isEnrolled(email: string): boolean {
    if (!email) return false;
    const emailKey = email.toLowerCase().trim();

    // 1. Consulta cache em memória
    if (enrolledCache.has(emailKey)) {
      return !!enrolledCache.get(emailKey);
    }

    // 2. Consulta localStorage
    if (typeof localStorage !== 'undefined') {
      const configStr = localStorage.getItem(`${BIOMETRIC_CONFIG_PREFIX}${emailKey}`);
      if (configStr) {
        try {
          const config = JSON.parse(configStr) as BiometricConfig;
          const ok = config.enabled && !!config.credentialId;
          enrolledCache.set(emailKey, ok);
          return ok;
        } catch {
          return false;
        }
      }
    }

    return false;
  },

  /**
   * Retorna a lista de e-mails com biometria ativa cadastrada neste dispositivo.
   */
  getEnrolledEmails(): string[] {
    const emails = new Set<string>();

    // 1. Do cache em memória
    for (const [email, enrolled] of enrolledCache.entries()) {
      if (enrolled) emails.add(email);
    }

    // 2. Do localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(BIOMETRIC_CONFIG_PREFIX)) {
            const email = key.replace(BIOMETRIC_CONFIG_PREFIX, '');
            if (email && this.isEnrolled(email)) {
              emails.add(email);
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao ler e-mails biométricos:', err);
      }
    }

    return Array.from(emails);
  },

  /**
   * Desativa e limpa os registros biométricos do usuário.
   */
  async disableBiometrics(email: string): Promise<void> {
    const emailKey = email.toLowerCase().trim();
    enrolledCache.delete(emailKey);

    await Preferences.remove({ key: `${BIOMETRIC_KEY_PREFIX}${emailKey}` });
    await Preferences.remove({ key: `${BIOMETRIC_CONFIG_PREFIX}${emailKey}` });

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`${BIOMETRIC_KEY_PREFIX}${emailKey}`);
      localStorage.removeItem(`${BIOMETRIC_CONFIG_PREFIX}${emailKey}`);
    }
  },

  /**
   * Dispara a autenticação biométrica (nativa ou Cyber Sensor) e recupera a Senha Mestra em memória.
   */
  async authenticate(email: string): Promise<BiometricAuthResult> {
    try {
      const emailKey = email.toLowerCase().trim();
      
      let configStr = (await Preferences.get({ key: `${BIOMETRIC_CONFIG_PREFIX}${emailKey}` })).value;
      let keyDataStr = (await Preferences.get({ key: `${BIOMETRIC_KEY_PREFIX}${emailKey}` })).value;

      if (!configStr || !keyDataStr) {
        if (typeof localStorage !== 'undefined') {
          configStr = localStorage.getItem(`${BIOMETRIC_CONFIG_PREFIX}${emailKey}`);
          keyDataStr = localStorage.getItem(`${BIOMETRIC_KEY_PREFIX}${emailKey}`);
        }
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

      let authenticated = false;

      // 1. TENTA VALIDAÇÃO NATIVA WEBAUTHN CASO TENHA SIDO CADASTRADA NATIVAMENTE
      if (config.isNative && typeof window !== 'undefined' && window.PublicKeyCredential && window.isSecureContext) {
        try {
          const rawId = base64ToArrayBuffer(config.credentialId);
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);

          const assertion = await navigator.credentials.get({
            publicKey: {
              challenge,
              allowCredentials: [{
                id: rawId,
                type: "public-key"
              }],
              userVerification: "preferred",
              timeout: 60000
            }
          });

          if (assertion) {
            authenticated = true;
          }
        } catch (nativeErr: any) {
          const msg = nativeErr?.message || '';
          console.warn('[BiometricsService] Erro ao validar WebAuthn nativo:', msg);

          if (msg.includes('NotAllowedError') && (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('abort'))) {
            return {
              success: false,
              errorCode: 'USER_CANCELLED',
              error: 'Autenticação biométrica cancelada pelo usuário.'
            };
          }
          // Caso a credencial nativa tenha sido perdida ou haja falha de hardware, permite fallback Cyber Sensor
        }
      }

      // 2. SE NÃO FOI NATIVO OU NATIVO CAIU NO FALLBACK:
      if (!authenticated) {
        const approved = await this.promptCyberSensor(emailKey, 'AUTH', config.biometricType);
        if (!approved) {
          return {
            success: false,
            errorCode: 'USER_CANCELLED',
            error: 'Autenticação biométrica cancelada pelo usuário.'
          };
        }
        authenticated = true;
      }

      if (!authenticated) {
        return {
          success: false,
          errorCode: 'BIOMETRIC_FAILED',
          error: 'A validação biométrica falhou.'
        };
      }

      // 3. DERIVA CHAVE E DECRIPTOGRAFA A SENHA MESTRA
      const cryptoKey = await deriveKey(config.credentialId, keyData.salt);
      const masterPassword = await decryptData(keyData.encryptedMasterPassword, cryptoKey);

      return {
        success: true,
        masterPassword,
        isNative: config.isNative
      };

    } catch (err: any) {
      console.error('[BiometricsService] Erro na verificação biométrica:', err);
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
        error: msg || 'Ocorreu uma falha ao autenticar com a biometria.'
      };
    }
  }
};

// Auto-inicializa o cache na carga do módulo
if (typeof window !== 'undefined') {
  BiometricsService.init().catch(console.warn);
}
