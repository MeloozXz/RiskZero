import { StorageService } from './storage';
import { SessionService } from './session';

let privacyScreenPlugin: any = null;
const PRIVACY_STORAGE_KEY = 'rz_privacy_screen_enabled';

let webListenersActive = false;
let blackoutTimeout: ReturnType<typeof setTimeout> | null = null;

async function loadPrivacyPlugin() {
  if (privacyScreenPlugin) return privacyScreenPlugin;
  try {
    const mod = await import('@capacitor-community/privacy-screen');
    privacyScreenPlugin = mod.PrivacyScreen;
  } catch {
    privacyScreenPlugin = null;
  }
  return privacyScreenPlugin;
}

function ensureCurtainElement(): HTMLElement {
  let curtain = document.getElementById('rz-privacy-curtain');
  if (!curtain) {
    curtain = document.createElement('div');
    curtain.id = 'rz-privacy-curtain';
    curtain.setAttribute('role', 'status');
    curtain.setAttribute('aria-live', 'assertive');
    curtain.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: #09090b;
      color: #fafafa;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
      font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
      user-select: none;
    `;
    curtain.innerHTML = `
      <div style="width: 56px; height: 56px; border-radius: 14px; background: rgba(239, 68, 68, 0.14); border: 1px solid rgba(239, 68, 68, 0.35); color: #ef4444; display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      </div>
      <h2 style="margin: 0 0 8px 0; font-size: 1.25rem; font-weight: 700; color: #fafafa;">
        Cortina de Privacidade Ativa
      </h2>
      <p style="margin: 0 0 20px 0; font-size: 0.875rem; color: #a1a1aa; max-width: 420px; line-height: 1.5;">
        O conteúdo do cofre foi ocultado preventivamente porque a janela perdeu o foco ou uma tentativa de captura de tela (PrintScreen / Win+Shift+S) foi detectada.
      </p>
      <button id="rz-privacy-curtain-resume" type="button" style="padding: 10px 20px; border-radius: 8px; background: #2563eb; border: 1px solid #3b82f6; color: #fff; font-size: 0.85rem; font-weight: 600; cursor: pointer;">
        Clique para retornar à sessão
      </button>
    `;
    curtain.addEventListener('click', () => {
      if (document.hasFocus()) {
        hideCurtain();
      }
    });
    document.body.appendChild(curtain);
  }
  return curtain;
}

function showCurtain(reason?: string) {
  if (!HardeningService.isPrivacyScreenEnabled()) return;
  const curtain = ensureCurtainElement();
  curtain.style.display = 'flex';

  if (reason) {
    const email = SessionService.getActiveUserEmail();
    if (email) {
      StorageService.addAuditLog(email, 'SCREENSHOT_BLOCKED' as any, reason).catch(() => { });
    }
  }
}

function hideCurtain() {
  const curtain = document.getElementById('rz-privacy-curtain');
  if (curtain) {
    curtain.style.display = 'none';
  }
}

async function scrubClipboardOnScreenshot() {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText('[Captura de Tela Bloqueada pelo RiskZero]');
    }
  } catch {
    // Ignora caso o navegador restrinja escrita sem foco
  }
}

function handleWindowBlur() {
  if (!HardeningService.isPrivacyScreenEnabled()) return;
  // Acionado imediatamente quando Win+Shift+S (Ferramenta de Captura do Windows) ou Alt+Tab é aberto
  showCurtain();
}

function handleWindowFocus() {
  if (!HardeningService.isPrivacyScreenEnabled()) return;
  if (blackoutTimeout) clearTimeout(blackoutTimeout);
  blackoutTimeout = setTimeout(() => {
    if (document.hasFocus()) {
      hideCurtain();
    }
  }, 250);
}

function handleVisibilityChange() {
  if (!HardeningService.isPrivacyScreenEnabled()) return;
  if (document.hidden) {
    showCurtain();
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (!HardeningService.isPrivacyScreenEnabled()) return;

  const isPrintScreen = e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44;
  const isSnippingShortcut = (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key.toLowerCase() === 's' || e.key === '3' || e.key === '4');
  const isPrintShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p';

  if (isPrintScreen || isSnippingShortcut || isPrintShortcut) {
    e.preventDefault();
    e.stopPropagation();
    showCurtain('Tentativa de captura de tela ou impressão bloqueada.');
    scrubClipboardOnScreenshot();
  }
}

function handleKeyUp(e: KeyboardEvent) {
  if (!HardeningService.isPrivacyScreenEnabled()) return;

  const isPrintScreen = e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44;
  if (isPrintScreen) {
    e.preventDefault();
    showCurtain('Tecla PrintScreen interceptada. Área de transferência limpa.');
    scrubClipboardOnScreenshot();
  }
}

export const HardeningService = {
  isPrivacyScreenEnabled(): boolean {
    try {
      return localStorage.getItem(PRIVACY_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  },

  async enablePrivacyScreen(): Promise<void> {
    try {
      localStorage.setItem(PRIVACY_STORAGE_KEY, 'true');
    } catch {
      // Ignora erro de storage
    }

    if (this.isNative()) {
      const plugin = await loadPrivacyPlugin();
      if (plugin) {
        try {
          await plugin.enable();
        } catch (e) {
          console.warn('[Hardening] Falha ao ativar FLAG_SECURE:', e);
        }
      }
    }

    // Sempre ativa também os guardiões de DOM/Eventos no navegador/Windows
    this._applyWebFallback();
  },

  async disablePrivacyScreen(): Promise<void> {
    try {
      localStorage.setItem(PRIVACY_STORAGE_KEY, 'false');
    } catch {
      // Ignora erro de storage
    }

    if (this.isNative()) {
      const plugin = await loadPrivacyPlugin();
      if (plugin) {
        try {
          await plugin.disable();
        } catch {
          // Silencioso
        }
      }
    }

    this._removeWebFallback();
  },

  _applyWebFallback(): void {
    document.body.style.setProperty('--screenshot-protection', 'active');
    ensureCurtainElement();

    if (!document.getElementById('privacy-screen-style')) {
      const style = document.createElement('style');
      style.id = 'privacy-screen-style';
      style.textContent = `
        @media print {
          body * { display: none !important; }
          body::after {
            content: "Conteúdo protegido contra impressão e captura pelo RiskZero";
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            color: #fafafa;
            background: #09090b;
            height: 100vh;
          }
        }
      `;
      document.head.appendChild(style);
    }

    if (!webListenersActive) {
      window.addEventListener('blur', handleWindowBlur, true);
      window.addEventListener('focus', handleWindowFocus, true);
      document.addEventListener('visibilitychange', handleVisibilityChange, true);
      window.addEventListener('keydown', handleKeyDown, true);
      window.addEventListener('keyup', handleKeyUp, true);
      webListenersActive = true;
    }
  },

  _removeWebFallback(): void {
    const style = document.getElementById('privacy-screen-style');
    if (style) style.remove();
    document.body.style.removeProperty('--screenshot-protection');
    hideCurtain();

    if (webListenersActive) {
      window.removeEventListener('blur', handleWindowBlur, true);
      window.removeEventListener('focus', handleWindowFocus, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      webListenersActive = false;
    }
  },

  isNative(): boolean {
    return (window as any).Capacitor?.isNativePlatform?.() === true;
  },

  async detectRootOrJailbreak(): Promise<{
    isCompromised: boolean;
    riskLevel: 'SEGURO' | 'ALERTA' | 'CRÍTICO';
    details: string[];
  }> {
    const details: string[] = [];

    if ((navigator as any).webdriver) {
      details.push('Ambiente de automação/bot detectado (navigator.webdriver).');
    }

    if (!window.crypto || !window.crypto.subtle) {
      details.push('WebCrypto API ausente ou substituída.');
    } else {
      const isNativeDigest = window.crypto.subtle.digest.toString().includes('[native code]');
      if (!isNativeDigest) {
        details.push('Possível interceptação de chamadas criptográficas (Hook detectado em crypto.subtle).');
      }
    }

    if (this.isNative()) {
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.includes('test-keys') || userAgent.includes('generic')) {
        details.push('Imagem de sistema não-oficial ou emulador detectado (test-keys).');
      }
    }

    const isCompromised = details.length > 0;
    const riskLevel = details.length >= 2 ? 'CRÍTICO' : details.length === 1 ? 'ALERTA' : 'SEGURO';

    return {
      isCompromised,
      riskLevel,
      details,
    };
  },
};

// Restaura automaticamente a proteção caso estivesse ativada na sessão
if (typeof window !== 'undefined' && HardeningService.isPrivacyScreenEnabled()) {
  setTimeout(() => {
    HardeningService._applyWebFallback();
  }, 0);
}
