import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SubscriptionService } from '../services/subscription';
import { SessionService } from '../services/session';
import { PlanTier, BillingCycle, SubscriptionInfo } from '../types';

interface SubscriptionContextType {
  tier: PlanTier;
  subscription: SubscriptionInfo | null;
  loading: boolean;
  isPro: boolean;
  isUltra: boolean;
  isFree: boolean;
  canUseTOTP: boolean;
  canUseCamouflage: boolean;
  canAccessServer: (serverId: string) => boolean;
  maxDevices: number;
  maxStorageGB: number;
  refreshSubscription: () => Promise<void>;
  upgradePlan: (
    tier: PlanTier,
    cycle: BillingCycle,
    paymentMethod?: 'PIX' | 'CREDIT_CARD'
  ) => Promise<boolean>;
  cancelSubscription: () => Promise<void>;
  isUpgradeModalOpen: boolean;
  modalFeatureName: string;
  modalMinTier: PlanTier;
  openUpgradeModal: (featureName?: string, minTier?: PlanTier) => void;
  closeUpgradeModal: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Estados do Modal Global de Upgrade
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);
  const [modalFeatureName, setModalFeatureName] = useState<string>('este recurso premium');
  const [modalMinTier, setModalMinTier] = useState<PlanTier>('PRO');

  const refreshSubscription = useCallback(async () => {
    const email = SessionService.getActiveUserEmail();
    if (!email) {
      setSubscription({
        tier: 'FREE',
        status: 'ACTIVE',
        startedAt: new Date().toISOString(),
        expiresAt: null,
        autoRenew: false,
      });
      setLoading(false);
      return;
    }

    try {
      const sub = await SubscriptionService.getSubscription(email);
      setSubscription(sub);
    } catch (err) {
      console.error('Erro ao carregar assinatura:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSubscription();
  }, [refreshSubscription]);

  const tier: PlanTier = subscription?.tier || 'FREE';
  const isPro = tier === 'PRO' || tier === 'ULTRA';
  const isUltra = tier === 'ULTRA';
  const isFree = tier === 'FREE';

  const canUseTOTP = SubscriptionService.canUseTOTP(tier);
  const canUseCamouflage = SubscriptionService.canUseCamouflage(tier);
  const canAccessServer = useCallback((serverId: string) => {
    return SubscriptionService.canAccessServer(tier, serverId);
  }, [tier]);
  const maxDevices = SubscriptionService.getMaxDevices(tier);
  const maxStorageGB = SubscriptionService.getMaxStorageGB(tier);

  const upgradePlan = async (
    targetTier: PlanTier,
    cycle: BillingCycle,
    paymentMethod: 'PIX' | 'CREDIT_CARD' = 'PIX'
  ): Promise<boolean> => {
    const email = SessionService.getActiveUserEmail();
    if (!email) return false;

    try {
      const res = await SubscriptionService.upgrade(email, targetTier, cycle, paymentMethod);
      if (res.success) {
        setSubscription(res.subscription);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Erro ao efetuar upgrade:', err);
      return false;
    }
  };

  const cancelSubscription = async (): Promise<void> => {
    const email = SessionService.getActiveUserEmail();
    if (!email) return;

    await SubscriptionService.cancel(email);
    await refreshSubscription();
  };

  const openUpgradeModal = (featureName?: string, minTier: PlanTier = 'PRO') => {
    if (featureName) setModalFeatureName(featureName);
    setModalMinTier(minTier);
    setIsUpgradeModalOpen(true);
  };

  const closeUpgradeModal = () => {
    setIsUpgradeModalOpen(false);
  };

  return (
    <SubscriptionContext.Provider
      value={{
        tier,
        subscription,
        loading,
        isPro,
        isUltra,
        isFree,
        canUseTOTP,
        canUseCamouflage,
        canAccessServer,
        maxDevices,
        maxStorageGB,
        refreshSubscription,
        upgradePlan,
        cancelSubscription,
        isUpgradeModalOpen,
        modalFeatureName,
        modalMinTier,
        openUpgradeModal,
        closeUpgradeModal,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription deve ser usado dentro de SubscriptionProvider');
  }
  return ctx;
};

/**
 * Componente Gate declarativo para proteger recursos pagos na interface.
 */
export const PlanGate: React.FC<{
  minTier?: PlanTier;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}> = ({ minTier = 'PRO', fallback = null, children }) => {
  const { tier } = useSubscription();

  const isEligible =
    (minTier === 'PRO' && (tier === 'PRO' || tier === 'ULTRA')) ||
    (minTier === 'ULTRA' && tier === 'ULTRA') ||
    minTier === 'FREE';

  if (!isEligible) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
