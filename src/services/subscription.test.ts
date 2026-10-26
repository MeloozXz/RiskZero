import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubscriptionService } from './subscription';
import { StorageService } from './storage';
import { SessionService } from './session';

let mockStore: Record<string, any> = {};

vi.mock('./firebase', () => ({
  auth: { currentUser: { uid: 'mock-uid-sub' } },
  db: {},
}));

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: async () => ({ user: { uid: 'mock-uid-sub' } }),
  createUserWithEmailAndPassword: async () => ({ user: { uid: 'mock-uid-sub' } }),
  signOut: async () => {},
}));

vi.mock('firebase/firestore', () => ({
  doc: (_db: any, col: string, id: string) => `${col}/${id}`,
  getDoc: async (docRef: string) => ({
    exists: () => !!mockStore[docRef],
    data: () => mockStore[docRef],
  }),
  setDoc: async (docRef: string, data: any) => {
    mockStore[docRef] = data;
  },
  updateDoc: async (docRef: string, data: any) => {
    mockStore[docRef] = { ...mockStore[docRef], ...data };
  },
}));

vi.mock('@capacitor/preferences', () => {
  let store: Record<string, string> = {};
  return {
    Preferences: {
      get: async ({ key }: { key: string }) => ({ value: store[key] || null }),
      set: async ({ key, value }: { key: string; value: string }) => {
        store[key] = value;
      },
      remove: async ({ key }: { key: string }) => {
        delete store[key];
      },
      clear: async () => {
        store = {};
      },
    },
  };
});

describe('SubscriptionService - Gestão de Planos & Assinaturas', () => {
  const testEmail = 'subscriber@seguranapp.com';

  beforeEach(async () => {
    mockStore = {};
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.clear();
    SessionService.clearSession();

    await SessionService.registerUser(testEmail, 'MasterPass@12345678');
  });

  it('deve retornar plano FREE por padrão para novo usuário', async () => {
    const sub = await SubscriptionService.getSubscription(testEmail);
    expect(sub).toBeDefined();
    expect(sub.tier).toBe('FREE');
    expect(sub.status).toBe('ACTIVE');
    expect(sub.expiresAt).toBeNull();
    expect(sub.autoRenew).toBe(false);
  });

  it('deve realizar upgrade para plano PRO mensal com sucesso e registrar auditoria', async () => {
    const res = await SubscriptionService.upgrade(testEmail, 'PRO', 'MONTHLY', 'PIX');
    expect(res.success).toBe(true);
    expect(res.subscription.tier).toBe('PRO');
    expect(res.subscription.billingCycle).toBe('MONTHLY');
    expect(res.subscription.expiresAt).toBeDefined();
    expect(res.subscription.autoRenew).toBe(true);

    // Verifica se persistiu no perfil
    const currentSub = await SubscriptionService.getSubscription(testEmail);
    expect(currentSub.tier).toBe('PRO');

    // Verifica logs de auditoria
    const logs = await StorageService.getAuditLogs(testEmail);
    expect(logs.some((l) => l.action === 'SUBSCRIPTION_UPGRADED')).toBe(true);
  });

  it('deve realizar upgrade para plano ULTRA anual com sucesso', async () => {
    const res = await SubscriptionService.upgrade(testEmail, 'ULTRA', 'ANNUAL', 'CREDIT_CARD');
    expect(res.success).toBe(true);
    expect(res.subscription.tier).toBe('ULTRA');
    expect(res.subscription.billingCycle).toBe('ANNUAL');
    expect(res.subscription.paymentMethod).toBe('CREDIT_CARD');

    const currentSub = await SubscriptionService.getSubscription(testEmail);
    expect(currentSub.tier).toBe('ULTRA');
  });

  it('deve validar permissões de funcionalidades por tier', () => {
    expect(SubscriptionService.canUseTOTP('FREE')).toBe(false);
    expect(SubscriptionService.canUseTOTP('PRO')).toBe(true);
    expect(SubscriptionService.canUseTOTP('ULTRA')).toBe(true);

    expect(SubscriptionService.canUseCamouflage('FREE')).toBe(false);
    expect(SubscriptionService.canUseCamouflage('PRO')).toBe(false);
    expect(SubscriptionService.canUseCamouflage('ULTRA')).toBe(true);

    expect(SubscriptionService.getMaxDevices('FREE')).toBe(1);
    expect(SubscriptionService.getMaxDevices('PRO')).toBe(5);
    expect(SubscriptionService.getMaxDevices('ULTRA')).toBe(999);
  });

  it('deve cancelar a renovação automática mantendo o tier ativo até a expiração', async () => {
    await SubscriptionService.upgrade(testEmail, 'PRO', 'MONTHLY');
    await SubscriptionService.cancel(testEmail);

    const sub = await SubscriptionService.getSubscription(testEmail);
    expect(sub.tier).toBe('PRO');
    expect(sub.autoRenew).toBe(false);

    const logs = await StorageService.getAuditLogs(testEmail);
    expect(logs.some((l) => l.action === 'SUBSCRIPTION_CANCELLED')).toBe(true);
  });

  it('deve fazer downgrade para FREE caso a data de expiração tenha passado', async () => {
    // Simula uma assinatura expirada no passado
    const profile = await StorageService.getUserProfile(testEmail);
    const expiredSub = {
      tier: 'PRO' as const,
      status: 'ACTIVE' as const,
      startedAt: '2025-01-01T00:00:00.000Z',
      expiresAt: '2025-02-01T00:00:00.000Z', // Data passada
      autoRenew: false,
    };
    await StorageService.saveUserProfile(testEmail, {
      ...profile!,
      subscription: expiredSub,
    });

    const sub = await SubscriptionService.getSubscription(testEmail);
    expect(sub.tier).toBe('FREE');
    expect(sub.status).toBe('EXPIRED');
  });
});
