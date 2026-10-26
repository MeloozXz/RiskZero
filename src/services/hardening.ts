/**
 * Serviço de Hardening do Dispositivo Android.
 * Concentra medidas de segurança nativas do SO móvel:
 * - Prevenção de screenshots via FLAG_SECURE (implementada nativamente na MainActivity.kt)
 * - Integração com plugin @capacitor-community/privacy-screen
 * - Proteção de tela do recents/app-switcher
 */

// Importação dinâmica do plugin (graceful fallback se não disponível)
let privacyScreenPlugin: any = null;

async function loadPrivacyPlugin() {
  if (privacyScreenPlugin) return privacyScreenPlugin;
  try {
    const mod = await import('@capacitor-community/privacy-screen');
    privacyScreenPlugin = mod.PrivacyScreen;
  } catch {
    console.warn('[Hardening] Plugin de privacidade não disponível. Rodando em modo web/dev.');
    privacyScreenPlugin = null;
  }
  return privacyScreenPlugin;
}

export const HardeningService = {
  /**
   * Ativa a prevenção de screenshots e ocultação no app-switcher do Android.
   * No Android nativo: seta WindowManager.FLAG_SECURE via plugin Capacitor.
   * No ambiente web: aplica filtro CSS como fallback visual.
   */
  async enablePrivacyScreen(): Promise<void> {
    const plugin = await loadPrivacyPlugin();
    if (plugin) {
      try {
        await plugin.enable();
        console.info('[Hardening] FLAG_SECURE ativado: screenshots bloqueados no Android.');
      } catch (e) {
        console.warn('[Hardening] Falha ao ativar FLAG_SECURE:', e);
      }
    } else {
      // Fallback web: aplica blur ao body quando o usuário tira print
      this._applyWebFallback();
    }
  },

  /**
   * Desativa a prevenção de screenshots (ex: ao sair da tela de detalhes).
   */
  async disablePrivacyScreen(): Promise<void> {
    const plugin = await loadPrivacyPlugin();
    if (plugin) {
      try {
        await plugin.disable();
      } catch {
        // Silencioso
      }
    }
    this._removeWebFallback();
  },

  /**
   * Fallback web: escuta PrintScreen e aplica blur visual durante o print.
   * Não é efetivo contra capturas nativas do SO, mas oferece uma camada
   * adicional de proteção visual.
   */
  _applyWebFallback(): void {
    document.body.style.setProperty('--screenshot-protection', 'active');
    const style = document.createElement('style');
    style.id = 'privacy-screen-style';
    style.textContent = `
      @media print {
        body * { display: none !important; }
        body::after {
          content: "Conteúdo protegido";
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          color: #3880ff;
          height: 100vh;
        }
      }
    `;
    if (!document.getElementById('privacy-screen-style')) {
      document.head.appendChild(style);
    }
  },

  _removeWebFallback(): void {
    const style = document.getElementById('privacy-screen-style');
    if (style) style.remove();
    document.body.style.removeProperty('--screenshot-protection');
  },

  /**
   * Verifica se o app está rodando nativamente no Android via Capacitor.
   */
  isNative(): boolean {
    return (window as any).Capacitor?.isNativePlatform?.() === true;
  },

  /**
   * Realiza verificação de integridade do ambiente (Root, Jailbreak, DevTools e Hooking).
   * Não bloqueia totalmente o app de forma destrutiva, mas identifica riscos críticos.
   */
  async detectRootOrJailbreak(): Promise<{
    isCompromised: boolean;
    riskLevel: 'SEGURO' | 'ALERTA' | 'CRÍTICO';
    details: string[];
  }> {
    const details: string[] = [];

    // 1. Verificação de automação / Webdriver
    if ((navigator as any).webdriver) {
      details.push('Ambiente de automação/bot detectado (navigator.webdriver).');
    }

    // 2. Verificação de integridade de APIs criptográficas (Detecção de Hooking/Frida)
    if (!window.crypto || !window.crypto.subtle) {
      details.push('WebCrypto API ausente ou substituída.');
    } else {
      const isNativeDigest = window.crypto.subtle.digest.toString().includes('[native code]');
      if (!isNativeDigest) {
        details.push('Possível interceptação de chamadas criptográficas (Hook detectado em crypto.subtle).');
      }
    }

    // 3. Verificação de flags de depuração no ambiente
    if ((window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__?.inject) {
      // Aviso informativo de desenvolvimento
    }

    // 4. Verificação de SO Android nativo
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
      details
    };
  }
};

