import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockPlugin } = vi.hoisted(() => {
  return {
    mockPlugin: {
      provideCredentials: vi.fn(),
      notifyAutofillRequest: vi.fn(),
      addListener: vi.fn(),
      removeAllListeners: vi.fn(),
    }
  };
});

vi.mock('@capacitor/core', async () => {
  const actual = await vi.importActual<typeof import('@capacitor/core')>('@capacitor/core');
  return {
    ...actual,
    registerPlugin: (name: string) => {
      if (name === 'Autofill') {
        return mockPlugin;
      }
      return actual.registerPlugin(name);
    }
  };
});

import { AutofillService, AutofillRequestedEvent } from './autofill';

describe('AutofillService - Bridge Capacitor Android Autofill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('provideCredentialsToNative', () => {
    it('deve repassar usuário e senha para o plugin nativo e retornar sucesso', async () => {
      mockPlugin.provideCredentials.mockResolvedValue({ success: true });

      const result = await AutofillService.provideCredentialsToNative('admin@seguranapp.com', 'Master@Pass#123');

      expect(mockPlugin.provideCredentials).toHaveBeenCalledWith({
        username: 'admin@seguranapp.com',
        password: 'Master@Pass#123'
      });
      expect(result).toEqual({ success: true });
    });

    it('deve capturar erros nativos graciosamente e retornar success: false', async () => {
      mockPlugin.provideCredentials.mockRejectedValue(new Error('Plugin not implemented on web'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await AutofillService.provideCredentialsToNative('user', 'pass');

      expect(result).toEqual({ success: false });
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('notifyAutofillRequest', () => {
    it('deve chamar o método nativo com requestId e retornar resposta', async () => {
      mockPlugin.notifyAutofillRequest.mockResolvedValue({
        success: true,
        requestId: 'req_123'
      });

      const result = await AutofillService.notifyAutofillRequest('req_123');

      expect(mockPlugin.notifyAutofillRequest).toHaveBeenCalledWith({ requestId: 'req_123' });
      expect(result).toEqual({ success: true, requestId: 'req_123' });
    });

    it('deve retornar success: false se o plugin nativo falhar', async () => {
      mockPlugin.notifyAutofillRequest.mockRejectedValue(new Error('Failed'));
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await AutofillService.notifyAutofillRequest('req_fail');
      expect(result).toEqual({ success: false });
    });
  });

  describe('addListener e removeAllListeners', () => {
    it('deve registrar ouvinte para onAutofillRequested', async () => {
      const mockHandle = { remove: vi.fn().mockResolvedValue(undefined) };
      mockPlugin.addListener.mockResolvedValue(mockHandle);

      const callback = (data: AutofillRequestedEvent) => {
        expect(data.appPackage).toBe('com.example.app');
      };

      const handle = await AutofillService.addListener('onAutofillRequested', callback);

      expect(mockPlugin.addListener).toHaveBeenCalledWith('onAutofillRequested', callback);
      expect(handle).toBe(mockHandle);
    });

    it('deve retornar null se falhar ao adicionar listener', async () => {
      mockPlugin.addListener.mockRejectedValue(new Error('Not implemented'));
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const handle = await AutofillService.addListener('onAutofillRequested', () => {});
      expect(handle).toBeNull();
    });

    it('deve invocar removeAllListeners com sucesso', async () => {
      mockPlugin.removeAllListeners.mockResolvedValue(undefined);

      await AutofillService.removeAllListeners();

      expect(mockPlugin.removeAllListeners).toHaveBeenCalled();
    });
  });
});
