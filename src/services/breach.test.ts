import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DataBreachService } from './breach';
import { StorageService, setHibpApiKey, getHibpApiKey, clearHibpApiKey } from './storage';

let mockStore: Record<string, string> = {};

vi.mock('./firebase', () => ({
  auth: { currentUser: { uid: 'mock-uid' } },
  db: {},
}));

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: async () => ({ user: { uid: 'mock-uid' } }),
  createUserWithEmailAndPassword: async () => ({ user: { uid: 'mock-uid' } }),
  signOut: async () => {},
}));

vi.mock('firebase/firestore', () => ({
  doc: (_db: any, col: string, id: string) => `${col}/${id}`,
  getDoc: async () => ({ exists: () => false, data: () => null }),
  setDoc: async () => {},
  updateDoc: async () => {},
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: mockStore[key] || null }),
    set: async ({ key, value }: { key: string; value: string }) => {
      mockStore[key] = value;
    },
    remove: async ({ key }: { key: string }) => {
      delete mockStore[key];
    },
    clear: async () => {
      mockStore = {};
    },
  },
}));

describe('DataBreachService & Storage - Auditoria HIBP v3', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    mockStore = {};
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Armazenamento Local Zero-Knowledge da API Key HIBP', () => {
    it('deve retornar null se nenhuma chave foi cadastrada', async () => {
      const key = await getHibpApiKey();
      expect(key).toBeNull();
    });

    it('deve salvar e recuperar a API Key com trim via StorageService e standalone', async () => {
      await setHibpApiKey('  test-api-key-12345  ');
      
      const storedDirect = await getHibpApiKey();
      expect(storedDirect).toBe('test-api-key-12345');

      const storedViaService = await StorageService.getHibpApiKey();
      expect(storedViaService).toBe('test-api-key-12345');

      // Verifica que está no mockStore com a chave segura zk_hibp_api_key
      expect(mockStore['zk_hibp_api_key']).toBe('test-api-key-12345');
    });

    it('deve limpar a chave com clearHibpApiKey', async () => {
      await StorageService.setHibpApiKey('some-key');
      expect(await StorageService.getHibpApiKey()).toBe('some-key');

      await clearHibpApiKey();
      expect(await StorageService.getHibpApiKey()).toBeNull();
      expect(mockStore['zk_hibp_api_key']).toBeUndefined();
    });
  });

  describe('Auditoria de E-mail em Modo Simulação (Sem API Key)', () => {
    it('deve retornar isSimulated: true e vazamentos mock para e-mails de teste', async () => {
      const result = await DataBreachService.checkEmailBreach('teste@exemplo.com');

      expect(result.isSimulated).toBe(true);
      expect(result.isBreached).toBe(true);
      expect(result.totalBreaches).toBeGreaterThan(0);
      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.breaches.length).toBe(result.totalBreaches);
    });

    it('deve retornar 0 vazamentos para e-mails limpos no modo simulação', async () => {
      const result = await DataBreachService.checkEmailBreach('email.limpo.seguro@dominio.com');

      expect(result.isSimulated).toBe(true);
      expect(result.isBreached).toBe(false);
      expect(result.totalBreaches).toBe(0);
      expect(result.riskScore).toBe(0);
      expect(result.breaches).toEqual([]);
    });

    it('deve tratar e-mail vazio graciosamente', async () => {
      const result = await DataBreachService.checkEmailBreach('');
      expect(result.email).toBe('');
      expect(result.isBreached).toBe(false);
      expect(result.totalBreaches).toBe(0);
    });
  });

  describe('Auditoria de E-mail via API v3 Real do HIBP (Com API Key)', () => {
    const HIBP_MOCK_RESPONSE = [
      {
        Name: 'Adobe',
        Title: 'Adobe',
        Domain: 'adobe.com',
        BreachDate: '2013-10-04',
        PwnCount: 152445165,
        Description: 'In October 2013, Adobe was breached exposing <a href="http://adobe.com">passwords</a> and email addresses.',
        DataClasses: ['Email addresses', 'Password hints', 'Passwords'],
        IsVerified: true,
      },
      {
        Name: 'Canva',
        Title: 'Canva',
        Domain: 'canva.com',
        BreachDate: '2019-05-24',
        PwnCount: 137000000,
        Description: 'In May 2019, Canva suffered a data breach.',
        DataClasses: ['Email addresses', 'Names'],
        IsVerified: true,
      }
    ];

    it('deve consultar a URL oficial v3 com headers hibp-api-key e user-agent e retornar 200 OK', async () => {
      await StorageService.setHibpApiKey('hibp-secret-key-xyz');

      let capturedUrl = '';
      let capturedHeaders: Record<string, string> = {};

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedHeaders = (init?.headers as Record<string, string>) || {};
        return {
          status: 200,
          ok: true,
          json: async () => HIBP_MOCK_RESPONSE
        } as unknown as Response;
      });

      const result = await DataBreachService.checkEmailBreach('user@target.com');

      expect(capturedUrl).toContain('https://haveibeenpwned.com/api/v3/breachedaccount/user%40target.com?truncateResponse=false');
      expect(capturedHeaders['hibp-api-key']).toBe('hibp-secret-key-xyz');
      expect(capturedHeaders['user-agent']).toBe('RiskZero-Client');

      expect(result.isSimulated).toBe(false);
      expect(result.isBreached).toBe(true);
      expect(result.totalBreaches).toBe(2);
      expect(result.riskScore).toBeGreaterThan(0);

      // Validação de sanitização HTML na descrição
      expect(result.breaches[0].description).not.toContain('<a href');
      expect(result.breaches[0].description).toContain('passwords and email addresses.');

      // Validação de cálculo de severidade (Adobe tem Passwords -> CRÍTICA, Canva tem >10M -> ALTA)
      expect(result.breaches[0].severity).toBe('CRÍTICA');
      expect(result.breaches[1].severity).toBe('ALTA');
    });

    it('deve tratar status 404 (Not Found) como e-mail seguro sem vazamentos', async () => {
      await StorageService.setHibpApiKey('hibp-secret-key-xyz');

      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 404,
        ok: false,
      } as Response);

      const result = await DataBreachService.checkEmailBreach('innocent.clean@safe.com');

      expect(result.isSimulated).toBe(false);
      expect(result.isBreached).toBe(false);
      expect(result.totalBreaches).toBe(0);
      expect(result.riskScore).toBe(0);
      expect(result.breaches).toHaveLength(0);
    });

    it('deve lançar erro explicativo para status 401 (Chave inválida ou expirada)', async () => {
      await StorageService.setHibpApiKey('bad-key');

      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
      } as Response);

      await expect(DataBreachService.checkEmailBreach('user@test.com'))
        .rejects.toThrow(/Chave da API do HIBP inválida ou não autorizada/);
    });

    it('deve lançar erro amigável para status 429 (Rate Limit excedido)', async () => {
      await StorageService.setHibpApiKey('valid-key');

      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 429,
        ok: false,
      } as Response);

      await expect(DataBreachService.checkEmailBreach('user@test.com'))
        .rejects.toThrow(/Limite de requisições da API do HIBP excedido/);
    });

    it('deve lançar erro amigável para falha de rede/conexão', async () => {
      await StorageService.setHibpApiKey('valid-key');

      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(DataBreachService.checkEmailBreach('user@test.com'))
        .rejects.toThrow(/Não foi possível conectar ao serviço Have I Been Pwned/);
    });
  });

  describe('Auditoria de Senhas via k-Anonymity SHA-1', () => {
    it('deve retornar breached: false para senha em branco', async () => {
      const result = await DataBreachService.checkPasswordBreach('');
      expect(result.breached).toBe(false);
      expect(result.count).toBe(0);
    });

    it('deve identificar hash de senha vazada via range k-Anonymity', async () => {
      // Mock fetch de range SHA-1 do HIBP
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('api.pwnedpasswords.com/range/')) {
          // Retorna sufixos simulados
          return {
            ok: true,
            status: 200,
            text: async () => '0018A45C4D1787236E9DE184BA25DB65884:2\nE25E349E26321C3B1CEE804DD20F477EECD:452109\n'
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      // 'password' tem sha1 '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8'
      // prefixo '5BAA6', sufixo '1E4C9B93F3F0682250B6CF8331B7EE68FD8'
      const result = await DataBreachService.checkPasswordBreach('password');
      expect(result.sha1Prefix).toBeDefined();
    });
  });
});
