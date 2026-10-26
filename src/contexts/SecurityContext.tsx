import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StorageService } from '../services/storage';
import { SessionService } from '../services/session';
import { hashSHA256, derivePinHash, encryptData, decryptData } from '../crypto/webcrypto';
import { verifyTOTP, generateBase32Secret } from '../crypto/totp';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { BiometricsService } from '../services/biometrics';
import { DataBreachService } from '../services/breach';
import { VaultService } from '../services/vault';

interface SecurityContextType {
  isLoggedIn: boolean;       // Indica se a chave mestra está carregada na RAM
  isLocked: boolean;         // Indica se a tela de PIN/Biometria está ativa (Auto-Lock)
  hasPIN: boolean;           // Indica se o usuário cadastrou um PIN local de 6 dígitos
  isBiometricEnabled: boolean; // Indica se a biometria está cadastrada para o usuário ativo
  totpEnabled: boolean;      // Indica se o 2FA está ativo
  totpSecret: string | null; // Segredo do 2FA atual em configuração
  activeEmail: string | null; // E-mail da conta ativa na sessão
  isInitializing: boolean;   // Indica se a sessão está sendo inicializada/restaurada
  rememberSession: boolean;   // Se deve manter conectado ao recarregar a página (F5)
  setRememberSession: (enabled: boolean) => Promise<void>;
  
  // Ações de Autenticação e Sessão
  register: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  login2FA: (token: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  
  // Ações do PIN e Desbloqueio
  registerPIN: (pin: string) => Promise<void>;
  unlockWithPIN: (pin: string) => Promise<{ success: boolean; error?: string }>;
  unlockWithBiometrics: () => Promise<boolean>;
  lockApp: () => void;
  
  // Ações de 2FA
  setupNew2FA: () => string; // Gera segredo local e retorna
  enable2FA: (token: string) => Promise<{ success: boolean; error?: string }>;
  disable2FA: () => Promise<void>;

  // Ações de Biometria
  isBiometricsSupported: boolean;
  isBiometricsEnrolled: (email: string) => boolean;
  registerBiometrics: (password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithBiometrics: (email: string) => Promise<{ success: boolean; requires2FA?: boolean; error?: string }>;
  disableBiometrics: () => void;

  // Saúde do Cofre
  vaultHealth: { score: number; breached: number; weak: number; reused: number } | null;
  runVaultHealthCheck: () => Promise<void>;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [hasPIN, setHasPIN] = useState<boolean>(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState<boolean>(false);
  const [totpEnabled, setTotpEnabled] = useState<boolean>(false);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [activeEmail, setActiveEmail] = useState<string | null>(null);
  const [isBiometricsSupported, setIsBiometricsSupported] = useState<boolean>(false);
  const [vaultHealth, setVaultHealth] = useState<{ score: number; breached: number; weak: number; reused: number } | null>(null);
  const [rememberSession, setRememberSessionState] = useState<boolean>(true);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Inicializa o estado de segurança carregando configurações do Storage local
  useEffect(() => {
    async function initSecurity() {
      try {
        if (auth.authStateReady) {
          try {
            await auth.authStateReady();
          } catch {
            // Continua caso o backend do Firebase esteja offline
          }
        }

        // 1. Inicializa e verifica o suporte biométrico
        await BiometricsService.init();
        const bioAvailable = await BiometricsService.isAvailable();
        setIsBiometricsSupported(bioAvailable);

        // 2. Carrega a preferência de persistência de sessão (Manter conectado ao atualizar)
        const isRemember = await StorageService.isRememberSessionEnabled();
        setRememberSessionState(isRemember);

        // 3. Se a chave não está na RAM, tenta restaurar a sessão persistida caso a opção esteja ativa
        if (!SessionService.isKeyLoaded() && isRemember) {
          await SessionService.tryRestorePersistedSession();
        }

        // 4. Se mesmo após tentar restaurar a chave não está carregada, encerra a sessão
        if (!SessionService.isKeyLoaded()) {
          setIsLoggedIn(false);
          setIsLocked(false);
          setActiveEmail(null);
          return;
        }

        // 5. Sessão ativa e chave carregada na RAM com sucesso
        const email = SessionService.getActiveUserEmail();
        if (email) {
          setIsLoggedIn(true);
          setIsLocked(false);
          setActiveEmail(email);
          const profile = await StorageService.getUserProfile(email);
          if (profile) {
            setTotpEnabled(profile.totpEnabled);
          }
          
          const pinHash = await StorageService.getPINHash(email);
          setHasPIN(!!pinHash);
          setIsBiometricEnabled(BiometricsService.isEnrolled(email));
        }
      } catch (err) {
        console.error('[SeguranApp] Erro em initSecurity:', err);
      } finally {
        setIsInitializing(false);
      }
    }
    initSecurity();
  }, []);

  const setRememberSession = async (enabled: boolean) => {
    setRememberSessionState(enabled);
    await StorageService.setRememberSessionEnabled(enabled);
    if (enabled && SessionService.isKeyLoaded()) {
      await SessionService.persistCurrentSession();
    } else if (!enabled) {
      await StorageService.clearPersistedSession();
    }
  };

  // ==========================================
  // SEGURANÇA DE CICLO DE VIDA (AUTO-LOCK E VISIBILIDADE)
  // ==========================================
  useEffect(() => {
    let appStateListener: any = null;
    let visibilityTimeout: any = null;

    // Escuta evento de ciclo de vida nativo (Android) via Capacitor App Plugin
    if (Capacitor.isNativePlatform()) {
      try {
        appStateListener = App.addListener('appStateChange', ({ isActive }) => {
          if (!isActive && SessionService.isKeyLoaded()) {
            // Minimizado ou background -> Bloqueia o aplicativo instantaneamente
            setIsLocked(true);
            const email = SessionService.getActiveUserEmail() || '';
            StorageService.addAuditLog(email, 'AUTO_LOCK', 'App minimizado. Auto-Lock de segurança acionado.');
          }
        });
      } catch (err) {
        console.warn('Erro ao configurar listener do Capacitor App:', err);
      }
    }

    // Fallback para Web: escuta mudança de visibilidade da aba do navegador (Visibility API)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (SessionService.isKeyLoaded()) {
          // Pequena tolerância para evitar falsos positivos em transições de DOM internas do Ionic
          visibilityTimeout = setTimeout(() => {
            if (document.visibilityState === 'hidden') {
              setIsLocked(true);
              const email = SessionService.getActiveUserEmail() || '';
              StorageService.addAuditLog(email, 'AUTO_LOCK', 'Aba do navegador desfocada. Auto-Lock acionado.');
            }
          }, 1500);
        }
      } else {
        if (visibilityTimeout) {
          clearTimeout(visibilityTimeout);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (appStateListener) {
        appStateListener.then((h: any) => h.remove());
      }
      if (visibilityTimeout) {
        clearTimeout(visibilityTimeout);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoggedIn]);

  // ==========================================
  // TIMER DE INATIVIDADE (5 MINUTOS)
  // ==========================================
  useEffect(() => {
    if (!isLoggedIn || isLocked) return;

    let timeoutId: any;

    const resetInactivityTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsLocked(true);
        const email = SessionService.getActiveUserEmail() || '';
        StorageService.addAuditLog(email, 'AUTO_LOCK', 'Inatividade de 5 minutos detectada. Auto-Lock acionado.');
      }, 5 * 60 * 1000); // 5 minutos em milissegundos
    };

    // Escuta eventos comuns de interação do usuário
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach(evt => document.addEventListener(evt, resetInactivityTimer));

    resetInactivityTimer(); // Inicializa o timer

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(evt => document.removeEventListener(evt, resetInactivityTimer));
    };
  }, [isLoggedIn, isLocked]);

  // ==========================================
  // CADASTRO, LOGIN E LOGOUT
  // ==========================================
  const register = async (email: string, password: string) => {
    const emailKey = email.toLowerCase().trim();
    const res = await SessionService.registerUser(emailKey, password);
    if (res.success) {
      setIsLoggedIn(true);
      setIsLocked(false);
      setActiveEmail(emailKey);
      setHasPIN(false);
      setTotpEnabled(false);
    }
    return res;
  };

  const login = async (email: string, password: string) => {
    const emailKey = email.toLowerCase().trim();
    const res = await SessionService.authenticateMaster(emailKey, password);
    if (res.success) {
      const profile = await StorageService.getUserProfile(emailKey);
      
      // Se tiver 2FA ativado, não loga de imediato na UI (será necessário validar TOTP)
      if (profile && profile.totpEnabled) {
        // Mantemos isLoggedIn como falso até o TOTP ser validado!
        return { success: true, requires2FA: true };
      }
      
      setIsLoggedIn(true);
      setIsLocked(false);
      setActiveEmail(emailKey);
      
      const pinHash = await StorageService.getPINHash(emailKey);
      setHasPIN(!!pinHash);
      if (profile) {
        setTotpEnabled(profile.totpEnabled);
      }
    }
    return res;
  };

  const logout = async () => {
    const email = SessionService.getActiveUserEmail();
    if (email) {
      await StorageService.addAuditLog(email, 'LOGOUT', 'Usuário deslogou do Cofre de forma voluntária.');
    }
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('Erro ao deslogar do Firebase:', err);
    }
    SessionService.clearSession();
    await StorageService.clearPersistedSession();
    setIsLoggedIn(false);
    setIsLocked(false);
    setActiveEmail(null);
    setHasPIN(false);
    setTotpEnabled(false);
  };

  // ==========================================
  // PIN E DESBLOQUEIO BIOMÉTRICO
  // ==========================================
  const registerPIN = async (pin: string) => {
    const email = SessionService.getActiveUserEmail();
    if (!email) {
      throw new Error('Sessão ativa não encontrada.');
    }
    if (pin.length !== 6 || isNaN(Number(pin))) {
      throw new Error('O PIN deve conter exatamente 6 dígitos numéricos.');
    }
    const profile = await StorageService.getUserProfile(email);
    const salt = profile?.salt || 'zk_pin_salt_default';
    const pinHash = await derivePinHash(pin, salt);
    await StorageService.savePINHash(email, pinHash);
    setHasPIN(true);
    await StorageService.addAuditLog(email, 'CREDENTIAL_UPDATED', 'PIN local com derivação Argon2id configurado com sucesso.');
  };

  const unlockWithPIN = async (pin: string) => {
    const lockout = await SessionService.checkLockout();
    if (lockout.isLocked) {
      return { success: false, error: lockout.message };
    }

    const email = SessionService.getActiveUserEmail();
    if (!email) {
      return { success: false, error: 'Sessão inválida ou expirada.' };
    }

    const savedPINHash = await StorageService.getPINHash(email);
    if (!savedPINHash) {
      return { success: false, error: 'Nenhum PIN cadastrado para esta conta neste celular.' };
    }

    const profile = await StorageService.getUserProfile(email);
    const salt = profile?.salt || 'zk_pin_salt_default';
    const inputPINHash = await derivePinHash(pin, salt);
    const legacyHash = await hashSHA256(pin);

    if (inputPINHash === savedPINHash || legacyHash === savedPINHash) {
      if (legacyHash === savedPINHash) {
        // Migração transparente para o novo padrão seguro com salt PBKDF2
        await StorageService.savePINHash(email, inputPINHash);
      }
      await SessionService.resetFailedAttempts();
      setIsLocked(false);
      await StorageService.addAuditLog(email, '2FA_VERIFIED', 'Desbloqueio efetuado com sucesso via PIN.');
      return { success: true };
    } else {
      const attempts = await SessionService.incrementFailedAttempts();
      const remaining = 3 - attempts;
      if (remaining <= 0) {
        return { 
          success: false, 
          error: 'Número de tentativas de PIN excedido. Aplicativo bloqueado por 5 minutos.' 
        };
      } else {
        return { 
          success: false, 
          error: `PIN inválido. Resta(m) ${remaining} tentativa(s) antes do bloqueio.` 
        };
      }
    }
  };


  const unlockWithBiometrics = async (): Promise<boolean> => {
    const email = SessionService.getActiveUserEmail() || activeEmail;
    if (!email) return false;

    const enrolled = BiometricsService.isEnrolled(email);
    if (!enrolled) {
      return false;
    }

    const res = await BiometricsService.authenticate(email);
    if (res.success) {
      if (res.masterPassword && !SessionService.isKeyLoaded()) {
        await SessionService.authenticateMaster(email, res.masterPassword);
      }
      setIsLocked(false);
      await StorageService.addAuditLog(email, '2FA_VERIFIED', 'Desbloqueio efetuado via Biometria.');
      return true;
    } else {
      return false;
    }
  };

  const isBiometricsEnrolled = (email: string): boolean => {
    return BiometricsService.isEnrolled(email);
  };

  const registerBiometrics = async (password: string): Promise<{ success: boolean; error?: string }> => {
    const email = SessionService.getActiveUserEmail() || activeEmail;
    if (!email) {
      return { success: false, error: 'Nenhuma sessão ativa.' };
    }

    const authRes = await SessionService.authenticateMaster(email, password);
    if (!authRes.success) {
      return { success: false, error: 'Senha Mestra incorreta.' };
    }

    const res = await BiometricsService.registerBiometrics(email, password);
    if (res.success) {
      setIsBiometricEnabled(true);
      await StorageService.addAuditLog(email, 'CREDENTIAL_UPDATED', 'Biometria cadastrada neste aparelho.');
    }
    return res;
  };

  const loginWithBiometrics = async (email: string): Promise<{ success: boolean; requires2FA?: boolean; error?: string }> => {
    const emailKey = email.toLowerCase().trim();
    if (!BiometricsService.isEnrolled(emailKey)) {
      return { success: false, error: 'Biometria não cadastrada para este usuário.' };
    }

    const res = await BiometricsService.authenticate(emailKey);
    if (!res.success || !res.masterPassword) {
      return { success: false, error: res.error || 'A validação biométrica falhou.' };
    }

    return await login(emailKey, res.masterPassword);
  };

  const disableBiometrics = () => {
    const email = SessionService.getActiveUserEmail() || activeEmail;
    if (email) {
      BiometricsService.disableBiometrics(email);
      setIsBiometricEnabled(false);
      StorageService.addAuditLog(email, 'CREDENTIAL_DELETED', 'Biometria desativada com sucesso.');
    }
  };

  const lockApp = () => {
    if (isLoggedIn) {
      setIsLocked(true);
    }
  };

  // ==========================================
  // CONFIGURAÇÃO DO 2FA (TOTP)
  // ==========================================
  const setupNew2FA = () => {
    const secretGenerated = generateBase32Secret(20);
    setTotpSecret(secretGenerated);
    return secretGenerated;
  };

  const enable2FA = async (token: string) => {
    if (!totpSecret) {
      return { success: false, error: 'Chave secreta 2FA não gerada.' };
    }

    const verified = await verifyTOTP(token, totpSecret);
    if (!verified) {
      return { success: false, error: 'Código 2FA incorreto ou expirado. Tente novamente.' };
    }

    const email = SessionService.getActiveUserEmail();
    if (!email) {
      return { success: false, error: 'Sessão inválida.' };
    }

    const profile = await StorageService.getUserProfile(email);
    if (!profile) {
      return { success: false, error: 'Perfil do usuário não encontrado.' };
    }

    // Criptografa o segredo TOTP na persistência local
    const masterKey = SessionService.getMasterKey();
    const encryptedSecret = await encryptData(totpSecret, masterKey);

    profile.encryptedTotpSecret = encryptedSecret;
    profile.totpEnabled = true;
    delete profile.totpSecret; // Remove o segredo em texto claro legado

    await StorageService.saveUserProfile(email, profile);
    
    setTotpEnabled(true);
    setTotpSecret(null);
    
    await StorageService.addAuditLog(email, 'CREDENTIAL_UPDATED', 'Autenticação em dois fatores (2FA) ativada.');

    return { success: true };
  };

  const disable2FA = async () => {
    const email = SessionService.getActiveUserEmail();
    if (!email) return;

    const profile = await StorageService.getUserProfile(email);
    if (!profile) return;

    profile.totpEnabled = false;
    delete profile.encryptedTotpSecret;
    delete profile.totpSecret; // Remove legado se houver
    await StorageService.saveUserProfile(email, profile);

    setTotpEnabled(false);
    await StorageService.addAuditLog(email, 'CREDENTIAL_DELETED', 'Autenticação de Dois Fatores desativada.');
  };

  const login2FA = async (token: string): Promise<{ success: boolean; error?: string }> => {
    const email = SessionService.getActiveUserEmail();
    if (!email) {
      return { success: false, error: 'Sessão de login inválida.' };
    }

    const profile = await StorageService.getUserProfile(email);
    if (!profile || !profile.totpEnabled) {
      return { success: false, error: 'Configuração de 2FA não encontrada.' };
    }

    let secret = '';
    if (profile.encryptedTotpSecret) {
      try {
        const masterKey = SessionService.getMasterKey();
        secret = await decryptData(profile.encryptedTotpSecret, masterKey);
      } catch (err) {
        return { success: false, error: 'Falha ao descriptografar segredo 2FA.' };
      }
    } else if (profile.totpSecret) {
      secret = profile.totpSecret; // Suporte legado temporário
    } else {
      return { success: false, error: 'Segredo 2FA ausente.' };
    }

    const verified = await verifyTOTP(token, secret);
    if (!verified) {
      return { success: false, error: 'Código 2FA incorreto ou expirado.' };
    }

    // Login efetuado com sucesso
    setIsLoggedIn(true);
    setIsLocked(false);
    setActiveEmail(email);

    const pinHash = await StorageService.getPINHash(email);
    setHasPIN(!!pinHash);
    setTotpEnabled(true);

    await StorageService.addAuditLog(email, '2FA_VERIFIED', 'Autenticação de dois fatores concluída durante o login.');
    await SessionService.persistCurrentSession();

    return { success: true };
  };

  /**
   * Executa varredura proativa em memória RAM (k-Anonymity) para detectar senhas fracas,
   * vazadas e reutilizadas, sem persistir nem enviar texto claro.
   */
  const runVaultHealthCheck = useCallback(async () => {
    try {
      if (!isLoggedIn || isLocked) return;
      const items = await VaultService.getAll();
      const rawList = items.map((item) => ({
        id: item.id,
        title: item.title,
        plaintextPassword: item._plaintextPassword || ''
      }));
      const result = await DataBreachService.scanAllVaultPasswords(rawList);
      setVaultHealth({
        score: result.score,
        breached: result.breached.length,
        weak: result.weak.length,
        reused: result.reused.length
      });
      const email = SessionService.getActiveUserEmail() || '';
      if (result.breached.length > 0) {
        await StorageService.addAuditLog(
          email,
          'BREACH_DETECTED',
          `Auditoria proativa detectou ${result.breached.length} credencial(is) em listas de vazamentos públicos.`
        );
      }
    } catch (err) {
      console.warn('Erro na verificação proativa de saúde do cofre:', err);
    }
  }, [isLoggedIn, isLocked]);

  useEffect(() => {
    if (isLoggedIn && !isLocked) {
      runVaultHealthCheck();
    }
  }, [isLoggedIn, isLocked, runVaultHealthCheck]);

  return (
    <SecurityContext.Provider
      value={{
        isLoggedIn,
        isLocked,
        hasPIN,
        isBiometricEnabled,
        totpEnabled,
        totpSecret,
        activeEmail,
        isInitializing,
        rememberSession,
        setRememberSession,
        register,
        login,
        login2FA,
        logout,
        registerPIN,
        unlockWithPIN,
        unlockWithBiometrics,
        lockApp,
        setupNew2FA,
        enable2FA,
        disable2FA,
        isBiometricsSupported,
        isBiometricsEnrolled,
        registerBiometrics,
        loginWithBiometrics,
        disableBiometrics,
        vaultHealth,
        runVaultHealthCheck
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity deve ser utilizado dentro de um SecurityProvider');
  }
  return context;
};
export default SecurityContext;
