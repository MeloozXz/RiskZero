import { StorageService } from './storage';
import { PlanTier, BillingCycle, SubscriptionInfo } from '../types';

export const SubscriptionService = {
  /**
   * Retorna os detalhes da assinatura do usuário ativo.
   * Se não houver plano contratado ou tiver expirado, retorna o plano FREE.
   */
  async getSubscription(email: string): Promise<SubscriptionInfo> {
    const profile = await StorageService.getUserProfile(email);
    const sub = profile?.subscription;

    if (!sub) {
      return {
        tier: 'FREE',
        status: 'ACTIVE',
        startedAt: profile?.createdAt || new Date().toISOString(),
        expiresAt: null,
        autoRenew: false,
      };
    }

    // Verifica se a assinatura expirou
    if (sub.expiresAt && new Date(sub.expiresAt).getTime() < Date.now()) {
      return {
        ...sub,
        status: 'EXPIRED',
        tier: 'FREE', // Downgrade automático se expirou
      };
    }

    return sub;
  },

  /**
   * Realiza o upgrade para um plano pago (Pro ou Ultra) com ciclo Mensal ou Anual.
   */
  async upgrade(
    email: string,
    tier: PlanTier,
    cycle: BillingCycle,
    paymentMethod: 'PIX' | 'CREDIT_CARD' = 'PIX'
  ): Promise<{ success: boolean; subscription: SubscriptionInfo }> {
    const profile = await StorageService.getUserProfile(email);
    if (!profile) {
      throw new Error('Perfil de usuário não encontrado.');
    }

    const now = new Date();
    const expires = new Date(now);

    if (cycle === 'MONTHLY') {
      expires.setMonth(expires.getMonth() + 1);
    } else {
      expires.setFullYear(expires.getFullYear() + 1);
    }

    const newSub: SubscriptionInfo = {
      tier,
      billingCycle: cycle,
      status: 'ACTIVE',
      startedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      autoRenew: true,
      paymentMethod,
    };

    const updatedProfile = {
      ...profile,
      subscription: newSub,
    };

    await StorageService.saveUserProfile(email, updatedProfile);
    await StorageService.addAuditLog(
      email,
      'SUBSCRIPTION_UPGRADED',
      `Upgrade efetuado com sucesso para o plano ${tier} (${cycle === 'MONTHLY' ? 'Mensal' : 'Anual'}) via ${paymentMethod}.`
    );

    return { success: true, subscription: newSub };
  },

  /**
   * Cancela a renovação automática da assinatura.
   */
  async cancel(email: string): Promise<void> {
    const profile = await StorageService.getUserProfile(email);
    if (!profile || !profile.subscription) return;

    const updatedSub: SubscriptionInfo = {
      ...profile.subscription,
      autoRenew: false,
    };

    await StorageService.saveUserProfile(email, {
      ...profile,
      subscription: updatedSub,
    });

    await StorageService.addAuditLog(
      email,
      'SUBSCRIPTION_CANCELLED',
      'Renovação automática da assinatura cancelada.'
    );
  },

  /**
   * Retorna se o plano do usuário permite utilizar o Gerador de TOTP / 2FA integrado.
   */
  canUseTOTP(tier: PlanTier): boolean {
    return tier === 'PRO' || tier === 'ULTRA';
  },

  /**
   * Retorna se o plano do usuário permite utilizar o PIN de Pânico e Modo Camuflagem.
   */
  canUseCamouflage(tier: PlanTier): boolean {
    return tier === 'ULTRA';
  },

  /**
   * Retorna o limite de aparelhos ativos por plano.
   */
  getMaxDevices(tier: PlanTier): number {
    switch (tier) {
      case 'ULTRA':
        return 999; // Ilimitado
      case 'PRO':
        return 5;
      case 'FREE':
      default:
        return 1;
    }
  },

  /**
   * Retorna o limite de armazenamento em nuvem para arquivos/anexos protegidos.
   */
  getMaxStorageGB(tier: PlanTier): number {
    switch (tier) {
      case 'ULTRA':
        return 10;
      case 'PRO':
        return 1;
      case 'FREE':
      default:
        return 0;
    }
  },

  /**
   * Valida se o plano do usuário permite conectar ao servidor VPN selecionado.
   * Planos PRO e ULTRA têm acesso a todos os nós mundiais.
   * Plano FREE tem acesso ao nó base (Brasil) para verificação.
   */
  canAccessServer(tier: PlanTier, serverId: string): boolean {
    if (tier === 'PRO' || tier === 'ULTRA') {
      return true;
    }
    // Plano FREE tem acesso ao nó oficial Cloudflare WARP e ao nó base Brasil
    return serverId === 'br-sp' || serverId === 'cf-warp';
  },
};

