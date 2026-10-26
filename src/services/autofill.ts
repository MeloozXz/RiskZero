import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

/**
 * Evento emitido pelo AutofillService nativo do Android quando o usuário
 * foca em um campo de entrada que suporta preenchimento automático.
 */
export interface AutofillRequestedEvent {
  appPackage?: string;
  webDomain?: string;
  focusedId?: string;
  requestId?: string;
  timestamp?: string;
}

/**
 * Estrutura de credenciais voláteis fornecidas pela camada React
 */
export interface AutofillCredentials {
  username?: string;
  password?: string;
}

/**
 * Resposta padrão das operações do plugin Autofill
 */
export interface AutofillPluginResult {
  success: boolean;
  requestId?: string;
}

/**
 * Interface do Plugin Capacitor nativo 'Autofill'
 */
export interface AutofillPluginInterface {
  notifyAutofillRequest(options?: { requestId?: string }): Promise<AutofillPluginResult>;
  provideCredentials(options: AutofillCredentials): Promise<AutofillPluginResult>;
  addListener(
    eventName: 'onAutofillRequested',
    listenerFunc: (data: AutofillRequestedEvent) => void
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

/**
 * Instância do plugin nativo registrada via Capacitor
 */
export const AutofillNative = registerPlugin<AutofillPluginInterface>('Autofill');

/**
 * Serviço TypeScript de Autofill do SeguranApp.
 * Age como intermediário seguro entre a memória do cofre (React) e o serviço nativo do Android.
 */
export const AutofillService = {
  /**
   * Envia as credenciais descriptografadas para a memória temporária volátil do Android.
   * Em conformidade com a arquitetura Zero-Knowledge: as credenciais não são gravadas em disco.
   */
  async provideCredentialsToNative(username?: string, password?: string): Promise<AutofillPluginResult> {
    try {
      return await AutofillNative.provideCredentials({ username, password });
    } catch (error) {
      console.warn('[AutofillService] provideCredentials não suportado na plataforma atual:', error);
      return { success: false };
    }
  },

  /**
   * Dispara uma notificação ou simulação de autofill
   */
  async notifyAutofillRequest(requestId?: string): Promise<AutofillPluginResult> {
    try {
      return await AutofillNative.notifyAutofillRequest({ requestId });
    } catch (error) {
      console.warn('[AutofillService] notifyAutofillRequest não suportado na plataforma atual:', error);
      return { success: false };
    }
  },

  /**
   * Registra um callback para responder a eventos nativos de solicitação de preenchimento
   */
  async addListener(
    eventName: 'onAutofillRequested',
    callback: (data: AutofillRequestedEvent) => void
  ): Promise<PluginListenerHandle | null> {
    try {
      return await AutofillNative.addListener(eventName, callback);
    } catch (error) {
      console.warn('[AutofillService] addListener não suportado na plataforma atual:', error);
      return null;
    }
  },

  /**
   * Remove todos os listeners registrados
   */
  async removeAllListeners(): Promise<void> {
    try {
      await AutofillNative.removeAllListeners();
    } catch (error) {
      console.warn('[AutofillService] removeAllListeners não suportado na plataforma atual:', error);
    }
  }
};
