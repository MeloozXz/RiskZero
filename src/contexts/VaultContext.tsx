import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { VaultService } from '../services/vault';
import { SessionService } from '../services/session';
import { useSecurity } from './SecurityContext';
import { VaultItem, VaultCategory } from '../types';

type VaultItemWithPlain = VaultItem & {
  _plaintextPassword: string;
  _plaintextNotes?: string;
  _plaintextTotpSecret?: string;
};

const DECOY_VAULT_ITEMS: VaultItemWithPlain[] = [
  {
    id: 'decoy-item-1',
    title: 'Portal de Notícias Diárias',
    username: 'leitor.assinante@email.com',
    url: 'https://noticias.exemplo.com.br',
    category: 'LOGIN',
    encryptedPassword: { ciphertext: 'decoy_ciphertext_1', iv: 'decoy_iv_1' },
    _plaintextPassword: ' Noticia@2026#Leitura!',
    _plaintextNotes: 'Assinatura gratuita de newsletter.',
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'decoy-item-2',
    title: 'Clube de Cupons & Descontos',
    username: 'cliente.desconto@email.com',
    url: 'https://cupons.exemplo.com.br',
    category: 'LOGIN',
    encryptedPassword: { ciphertext: 'decoy_ciphertext_2', iv: 'decoy_iv_2' },
    _plaintextPassword: 'Cupom#Promo2026$Vip',
    _plaintextNotes: 'Conta de pontos de fidelidade.',
    updatedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: 'decoy-item-3',
    title: 'Fórum de Estudos Aberto',
    username: 'estudante_geral',
    url: 'https://forum.exemplo.org',
    category: 'NOTE',
    encryptedPassword: { ciphertext: 'decoy_ciphertext_3', iv: 'decoy_iv_3' },
    _plaintextPassword: 'Estudo@Forum2026!Ok',
    _plaintextNotes: 'Anotações públicas de horários de aula.',
    updatedAt: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
];

interface VaultContextType {
  items: VaultItemWithPlain[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: VaultCategory | 'ALL';
  setSelectedCategory: (cat: VaultCategory | 'ALL') => void;
  filteredItems: VaultItemWithPlain[];
  refreshVault: () => Promise<void>;
  createItem: (params: Parameters<typeof VaultService.create>[0]) => Promise<string>;
  updateItem: (id: string, params: Parameters<typeof VaultService.update>[1]) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  revealPassword: (id: string) => Promise<string>;
  revealTotpSecret: (id: string) => Promise<string | null>;
  getTotpCode: (id: string) => Promise<{ code: string; remainingSeconds: number; period: number } | null>;
  revealHistoryPassword: (itemId: string, historyId: string) => Promise<string>;
  healthStats: {
    total: number;
    weak: number;
    reused: number;
    strongCount: number;
  } | null;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isCamouflageMode } = useSecurity();
  const [realItems, setRealItems] = useState<VaultItemWithPlain[]>([]);
  const [decoyItems, setDecoyItems] = useState<VaultItemWithPlain[]>(DECOY_VAULT_ITEMS);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<VaultCategory | 'ALL'>('ALL');
  const [healthStats, setHealthStats] = useState<VaultContextType['healthStats']>(null);

  const refreshVault = useCallback(async () => {
    if (!SessionService.isKeyLoaded()) return;
    setLoading(true);
    try {
      const all = await VaultService.getAll();
      setRealItems(all);
      const health = await VaultService.analyzePasswordHealth();
      setHealthStats(health);
    } catch (e) {
      console.error('Erro ao carregar o cofre:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshVault();
  }, [refreshVault]);

  const activeItems = isCamouflageMode ? decoyItems : realItems;

  const activeHealthStats = isCamouflageMode
    ? { total: decoyItems.length, weak: 0, reused: 0, strongCount: decoyItems.length }
    : healthStats;

  const filteredItems = activeItems.filter((item) => {
    if (selectedCategory !== 'ALL') {
      const itemCat = item.category || 'LOGIN';
      if (itemCat !== selectedCategory) return false;
    }

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.username.toLowerCase().includes(q) ||
      item.url.toLowerCase().includes(q)
    );
  });

  const createItem = async (params: Parameters<typeof VaultService.create>[0]) => {
    if (isCamouflageMode) {
      const newId = `decoy-${Date.now()}`;
      setDecoyItems((prev) => [
        {
          id: newId,
          title: params.title,
          username: params.username,
          url: params.url || '',
          category: params.category || 'LOGIN',
          encryptedPassword: { ciphertext: 'decoy', iv: 'decoy' },
          _plaintextPassword: params.password,
          _plaintextNotes: params.notes,
          updatedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      return newId;
    }
    const id = await VaultService.create(params);
    await refreshVault();
    return id;
  };

  const updateItem = async (id: string, params: Parameters<typeof VaultService.update>[1]) => {
    if (isCamouflageMode) {
      setDecoyItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                title: params.title ?? item.title,
                username: params.username ?? item.username,
                url: params.url ?? item.url,
                category: params.category ?? item.category,
                _plaintextPassword: params.password ?? item._plaintextPassword,
                _plaintextNotes: params.notes ?? item._plaintextNotes,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );
      return;
    }
    await VaultService.update(id, params);
    await refreshVault();
  };

  const removeItem = async (id: string) => {
    if (isCamouflageMode) {
      setDecoyItems((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    await VaultService.remove(id);
    await refreshVault();
  };

  const revealPassword = async (id: string) => {
    if (isCamouflageMode) {
      return decoyItems.find((i) => i.id === id)?._plaintextPassword || '';
    }
    return VaultService.revealPassword(id);
  };

  const revealTotpSecret = async (id: string) => {
    if (isCamouflageMode) return null;
    return VaultService.revealTotpSecret(id);
  };

  const getTotpCode = async (id: string) => {
    if (isCamouflageMode) return null;
    return VaultService.getTotpCode(id);
  };

  const revealHistoryPassword = async (itemId: string, historyId: string) => {
    if (isCamouflageMode) return '';
    return VaultService.revealHistoryPassword(itemId, historyId);
  };

  return (
    <VaultContext.Provider
      value={{
        items: activeItems,
        loading,
        searchQuery,
        setSearchQuery,
        selectedCategory,
        setSelectedCategory,
        filteredItems,
        refreshVault,
        createItem,
        updateItem,
        removeItem,
        revealPassword,
        revealTotpSecret,
        getTotpCode,
        revealHistoryPassword,
        healthStats: activeHealthStats,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = () => {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault deve ser usado dentro de VaultProvider');
  return ctx;
};
