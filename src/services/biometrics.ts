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
  isAvailable: boolean;          // Indica se biometria real de hardware está disponível
  isNativeAvailable: boolean;    // Indica se hardware nativo WebAuthn/Windows Hello/TouchID/Android existe
  biometricType: BiometricType;  // Tipo de biometria detectada
  isEnrolled: boolean;           // Se já existe biometria real configurada neste aparelho
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

// Handler exclusivo para suíte de testes automatizados (Vitest)
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
   * Inicializa o cache síncrono a partir do storage, descartando cadastros simulados legados
   */
  async init(): Promise<void> {
    try {
      enrolledCache.clear();

      if (typeof localStorage !== 'undefined') {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(BIOMETRIC_CONFIG_PREFIX)) {
            const emailKey = key.replace(BIOMETRIC_CONFIG_PREFIX, '');
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                const parsed = JSON.parse(raw) as BiometricConfig;
                // Em produção (sem handler de teste), aceita apenas biometria nativa real de hardware
                if (parsed.enabled && parsed.credentialId && (parsed.isNative || activePromptHandler !== null)) {
                  enrolledCache.set(emailKey, true);
                } else if (!parsed.isNative && activePromptHandler === null) {
                  keysToRemove.push(emailKey);
                }
              } catch {
                // ignora item corrompido
              }
            }
          }
        }
        for (const emailKey of keysToRemove) {
          localStorage.removeItem(`${BIOMETRIC_CONFIG_PREFIX}${emailKey}`);
          localStorage.removeItem(`${BIOMETRIC_KEY_PREFIX}${emailKey}`);
        }
      }

      const capKeys = await Preferences.keys();
      for (const key of capKeys.keys) {
        if (key.startsWith(BIOMETRIC_CONFIG_PREFIX)) {
          const emailKey = key.replace(BIOMETRIC_CONFIG_PREFIX, '');
          const val = (await Preferences.get({ key })).value;
          if (val) {
            try {
              const parsed = JSON.parse(val) as BiometricConfig;
              if (parsed.enabled && parsed.credentialId && (parsed.isNative || activePromptHandler !== null)) {
                enrolledCache.set(emailKey, true);
                if (typeof localStorage !== 'undefined' && !localStorage.getItem(key)) {
                  localStorage.setItem(key, val);
                }
              } else if (!parsed.isNative && activePromptHandler === null) {
                await Preferences.remove({ key: `${BIOMETRIC_CONFIG_PREFIX}${emailKey}` });
                await Preferences.remove({ key: `${BIOMETRIC_KEY_PREFIX}${emailKey}` });
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
   * Verifica detalhadamente a disponibilidade de hardware biométrico real no SO ou navegador.
   */
  async checkHardwareStatus(email?: string): Promise<BiometricHardwareStatus> {
    try {
      const isSecure = typeof window !== 'undefined' && (window.isSecureContext ?? false);
      let isNativeAvailable = false;
      let biometricType: BiometricType = 'NONE';
      let platformName = 'Nenhum sensor biométrico físico detectado';

      const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
      const isMacOrIOS = ua.includes('iphone') || ua.includes('ipad') || ua.includes('macintosh');
      const isAndroid = ua.includes('android');
      const isWindows = ua.includes('windows');

      // Consulta se o autenticador biométrico de hardware da plataforma está realmente disponível
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

      if (isNativeAvailable) {
        if (isMacOrIOS) {
          biometricType = ua.includes('iphone') || ua.includes('ipad') ? 'FACE_ID' : 'TOUCH_ID';
          platformName = biometricType === 'FACE_ID' ? 'Apple Face ID / Touch ID' : 'Apple Touch ID';
        } else if (isAndroid) {
          biometricType = 'FINGERPRINT';
          platformName = 'Leitor de Impressão Digital (Android Keystore)';
        } else if (isWindows) {
          biometricType = 'FINGERPRINT';
          platformName = 'Windows Hello (Leitor Biométrico / TPM)';
        } else {
          biometricType = 'BIOMETRICS';
          platformName = 'Autenticador Biométrico de Plataforma (WebAuthn)';
        }
      } else if (activePromptHandler !== null) {
        // Apenas quando um handler de teste (Vitest) está registrado
        biometricType = 'CYBER_SENSOR';
        platformName = 'Ambiente de Teste Biométrico';
      }

      const enrolled = email ? this.isEnrolled(email) : this.getEnrolledEmails().length > 0;

      return {
        isAvailable: isNativeAvailable || activePromptHandler !== null,
        isNativeAvailable,
        biometricType,
        isEnrolled: enrolled,
        platformName,
        isSecureContext: isSecure
      };
    } catch (err: unknown) {
      return {
        isAvailable: activePromptHandler !== null,
        isNativeAvailable: false,
        biometricType: 'NONE',
        isEnrolled: false,
        platformName: 'Sensor biométrico indisponível',
        isSecureContext: typeof window !== 'undefined' && (window.isSecureContext ?? false),
        error: (err as Error | undefined)?.message
      };
    }
  },

  /**
   * Verifica se há suporte a biometria real de hardware
   */
  async isAvailable(): Promise<boolean> {
    const status = await this.checkHardwareStatus();
    return status.isAvailable;
  },

  /**
   * Utilizado exclusivamente para testes automatizados quando um handler explícito é injetado
   */
  async promptCyberSensor(email: string, mode: 'REGISTER' | 'AUTH', biometricType: BiometricType): Promise<boolean> {
    if (activePromptHandler) {
      return await activePromptHandler({ email, mode, biometricType });
    }
    return false;
  },

  /**
   * Cadastra a biometria real de hardware vinculada à Senha Mestra.
   * Nunca aceita cliques de mouse simulados em produção.
   */
  async registerBiometrics(email: string, masterPassword: string): Promise<BiometricAuthResult> {
    try {
      const emailKey = email.toLowerCase().trim();
      const hwStatus = await this.checkHardwareStatus(emailKey);
      let credentialIdB64 = '';
      let isNative = false;

      // 1. EXIGE REGISTRO NATIVO WEBAUTHN COM VERIFICAÇÃO DE USUÁRIO OBRIGATÓRIA (userVerification: 'required')
      if (hwStatus.isNativeAvailable && typeof window !== 'undefined' && window.PublicKeyCredential && window.isSecureContext) {
        try {
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);

          const userId = new Uint8Array(16);
          window.crypto.getRandomValues(userId);

          const rpEntity: PublicKeyCredentialRpEntity = {
            name: "RiskZero Enterprise Vault"
          };
          if (
            window.location.hostname &&
            window.location.hostname !== 'localhost' &&
            !/^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname)
          ) {
            rpEntity.id = window.location.hostname;
          }

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
                { alg: -7, type: "public-key" },   // ES256
                { alg: -257, type: "public-key" }, // RS256 (Windows Hello TPM)
                { alg: -8, type: "public-key" },   // Ed25519
                { alg: -37, type: "public-key" }   // PS256
              ],
              authenticatorSelection: {
                authenticatorAttachment: "platform",
                userVerification: "required",
                residentKey: "preferred"
              },
              timeout: 60000
            }
          }) as PublicKeyCredential | null;

          if (credential && credential.rawId) {
            credentialIdB64 = arrayBufferToBase64(credential.rawId);
            isNative = true;
          }
        } catch (nativeErr: unknown) {
          const msg = (nativeErr as Error | undefined)?.message || '';
          const name = (nativeErr as Error | undefined)?.name || '';
          console.warn('[BiometricsService] WebAuthn nativo recusado ou sem leitor físico:', name, msg);

          if (name === 'NotAllowedError' || msg.includes('NotAllowedError') || msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('abort')) {
            return {
              success: false,
              errorCode: 'USER_CANCELLED',
              error: 'Leitura biométrica cancelada ou não reconhecida pelo sensor do dispositivo.'
            };
          }

          return {
            success: false,
            errorCode: 'NOT_AVAILABLE',
            error: 'Nenhum sensor biométrico físico configurado neste dispositivo (verifique o Windows Hello, Touch ID ou leitor digital).'
          };
        }
      }

      // 2. Suporte exclusivo para suíte de testes unitários quando activePromptHandler está injetado
      if (!credentialIdB64) {
        if (activePromptHandler !== null) {
          const approved = await this.promptCyberSensor(emailKey, 'REGISTER', hwStatus.biometricType);
          if (!approved) {
            return {
              success: false,
              errorCode: 'USER_CANCELLED',
              error: 'Cadastro biométrico cancelado pelo usuário.'
            };
          }
          const deviceEntropy = new Uint8Array(32);
          window.crypto.getRandomValues(deviceEntropy);
          credentialIdB64 = arrayBufferToBase64(deviceEntropy);
          isNative = false;
        } else {
          return {
            success: false,
            errorCode: 'NOT_AVAILABLE',
            error: 'Este dispositivo ou navegador não possui leitor de impressão digital / biometria de hardware habilitado.'
          };
        }
      }

      // 3. DERIVA CHAVE CRIPTOGRÁFICA SEGURA COM SALT DE 16 BYTES
      const salt = generateSalt(16);
      const cryptoKey = await deriveKey(credentialIdB64, salt);
      const encryptedMasterPassword = await encryptData(masterPassword, cryptoKey);

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

      enrolledCache.set(emailKey, true);

      return {
        success: true,
        isNative
      };

    } catch (err: unknown) {
      console.error('[BiometricsService] Erro no registro biométrico:', err);
      const message = (err as Error | undefined)?.message || '';

      let errorCode: BiometricErrorCode = 'UNKNOWN_ERROR';
      if (message.includes('cancel') || message.includes('abort') || message.includes('NotAllowedError')) {
        errorCode = 'USER_CANCELLED';
      }

      return {
        success: false,
        errorCode,
        error: message || 'Falha ao vincular biometria de hardware do dispositivo.'
      };
    }
  },

  /**
   * Verifica de forma síncrona se o e-mail possui biometria real cadastrada.
   */
  isEnrolled(email: string): boolean {
    if (!email) return false;
    const emailKey = email.toLowerCase().trim();

    if (enrolledCache.has(emailKey)) {
      return !!enrolledCache.get(emailKey);
    }

    if (typeof localStorage !== 'undefined') {
      const configStr = localStorage.getItem(`${BIOMETRIC_CONFIG_PREFIX}${emailKey}`);
      if (configStr) {
        try {
          const config = JSON.parse(configStr) as BiometricConfig;
          const ok = config.enabled && !!config.credentialId && (config.isNative || activePromptHandler !== null);
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

    for (const [email, enrolled] of enrolledCache.entries()) {
      if (enrolled) emails.add(email);
    }

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
   * Dispara a autenticação biométrica nativa de hardware e recupera a Senha Mestra em memória.
   * Jamais faz fallback para clique de mouse em produção.
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

      if (config.isNative) {
        if (typeof window === 'undefined' || !window.PublicKeyCredential || !window.isSecureContext) {
          return {
            success: false,
            errorCode: 'NOT_AVAILABLE',
            error: 'Autenticador biométrico de hardware indisponível neste contexto.'
          };
        }

        try {
          const rawId = base64ToArrayBuffer(config.credentialId);
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);

          const assertion = await navigator.credentials.get({
            publicKey: {
              challenge,
              allowCredentials: [{
                id: rawId,
                type: "public-key",
                transports: ["internal"]
              }],
              userVerification: "required",
              timeout: 60000
            }
          });

          if (assertion) {
            authenticated = true;
          }
        } catch (nativeErr: unknown) {
          const msg = (nativeErr as Error | undefined)?.message || '';
          const name = (nativeErr as Error | undefined)?.name || '';
          console.warn('[BiometricsService] Falha na verificação WebAuthn de hardware:', name, msg);

          if (name === 'NotAllowedError' || msg.includes('NotAllowedError') || msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('abort')) {
            return {
              success: false,
              errorCode: 'USER_CANCELLED',
              error: 'Verificação biométrica cancelada ou recusada pelo leitor do dispositivo.'
            };
          }

          return {
            success: false,
            errorCode: 'BIOMETRIC_FAILED',
            error: 'Falha ao validar o sensor biométrico de hardware.'
          };
        }
      } else if (activePromptHandler !== null) {
        const approved = await this.promptCyberSensor(emailKey, 'AUTH', config.biometricType);
        if (!approved) {
          return {
            success: false,
            errorCode: 'USER_CANCELLED',
            error: 'Autenticação biométrica cancelada pelo usuário.'
          };
        }
        authenticated = true;
      } else {
        // Cadastro legado simulado não é aceito em produção
        await this.disableBiometrics(emailKey);
        return {
          success: false,
          errorCode: 'NOT_ENROLLED',
          error: 'Cadastro biométrico antigo inválido. Reconfigure utilizando o leitor físico do dispositivo.'
        };
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

    } catch (err: unknown) {
      console.error('[BiometricsService] Erro na verificação biométrica:', err);
      const msg = (err as Error | undefined)?.message || '';

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
