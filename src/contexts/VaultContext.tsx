import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { VaultService } from '../services/vault';
import { StorageService } from '../services/storage';
import { SessionService } from '../services/session';
import { useSecurity } from './SecurityContext';
import { VaultItem, VaultCategory } from '../types';

type VaultItemWithPlain = VaultItem & {
  _plaintextPassword: string;
  _plaintextNotes?: string;
  _plaintextTotpSecret?: string;
};

export function generateRealisticDecoyItems(userEmail?: string | null): VaultItemWithPlain[] {
  const email = (userEmail && userEmail.includes('@')) ? userEmail.trim().toLowerCase() : 'usuario.pessoal@gmail.com';
  const prefix = email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '') || 'usuario';

  return [
    {
      id: 'decoy-item-netflix',
      title: 'Netflix',
      username: email,
      url: 'https://www.netflix.com',
      category: 'LOGIN',
      encryptedPassword: { ciphertext: 'decoy_net', iv: 'decoy_iv' },
      _plaintextPassword: 'Netflix#Familia2026',
      _plaintextNotes: 'Plano Padrão com Anúncios (conta compartilhada da família)',
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'decoy-item-meli',
      title: 'Mercado Livre',
      username: email,
      url: 'https://www.mercadolivre.com.br',
      category: 'LOGIN',
      encryptedPassword: { ciphertext: 'decoy_meli', iv: 'decoy_iv' },
      _plaintextPassword: 'Meli$Compras2026!',
      _plaintextNotes: 'Endereço residencial cadastrado no app',
      updatedAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    },
    {
      id: 'decoy-item-instagram',
      title: 'Instagram',
      username: `@${prefix}`,
      url: 'https://www.instagram.com',
      category: 'LOGIN',
      encryptedPassword: { ciphertext: 'decoy_insta', iv: 'decoy_iv' },
      _plaintextPassword: 'Insta!Foto2026#Sp',
      _plaintextNotes: 'Perfil pessoal (fotos e mensagens privadas)',
      updatedAt: new Date(Date.now() - 86400000 * 12).toISOString(),
    },
    {
      id: 'decoy-item-ifood',
      title: 'iFood',
      username: email,
      url: 'https://www.ifood.com.br',
      category: 'LOGIN',
      encryptedPassword: { ciphertext: 'decoy_ifood', iv: 'decoy_iv' },
      _plaintextPassword: 'Ifood@Delivery99',
      _plaintextNotes: 'Cartão de crédito/débito salvo para pedidos de refeição',
      updatedAt: new Date(Date.now() - 86400000 * 18).toISOString(),
    },
    {
      id: 'decoy-item-uber',
      title: 'Uber',
      username: email,
      url: 'https://www.uber.com',
      category: 'LOGIN',
      encryptedPassword: { ciphertext: 'decoy_uber', iv: 'decoy_iv' },
      _plaintextPassword: 'Uber#Viagens2026*Br',
      _plaintextNotes: 'Conta vinculada ao cartão para viagens urbanas',
      updatedAt: new Date(Date.now() - 86400000 * 25).toISOString(),
    },
    {
      id: 'decoy-item-spotify',
      title: 'Spotify',
      username: email,
      url: 'https://www.spotify.com',
      category: 'LOGIN',
      encryptedPassword: { ciphertext: 'decoy_spot', iv: 'decoy_iv' },
      _plaintextPassword: 'Musica#Spotify2026',
      _plaintextNotes: 'Plano Individual Mensal / Playlists salvas',
      updatedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    },
  ];
}

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
  const { isCamouflageMode, activeEmail } = useSecurity();
  const [realItems, setRealItems] = useState<VaultItemWithPlain[]>([]);
  const [decoyItems, setDecoyItems] = useState<VaultItemWithPlain[]>(() => generateRealisticDecoyItems(activeEmail));
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<VaultCategory | 'ALL'>('ALL');
  const [healthStats, setHealthStats] = useState<VaultContextType['healthStats']>(null);

  const loadDecoyItems = useCallback(async () => {
    const email = activeEmail || SessionService.getActiveUserEmail() || 'usuario.pessoal@gmail.com';
    try {
      const saved = await StorageService.getDecoyVault<VaultItemWithPlain>(email);
      if (saved && saved.length > 0) {
        setDecoyItems(saved);
      } else {
        const generated = generateRealisticDecoyItems(email);
        setDecoyItems(generated);
        await StorageService.saveDecoyVault(email, generated);
      }
    } catch {
      setDecoyItems(generateRealisticDecoyItems(email));
    }
  }, [activeEmail]);

  useEffect(() => {
    loadDecoyItems();
  }, [loadDecoyItems, isCamouflageMode]);

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
      const newItem: VaultItemWithPlain = {
        id: newId,
        title: params.title,
        username: params.username,
        url: params.url || '',
        category: params.category || 'LOGIN',
        encryptedPassword: { ciphertext: 'decoy', iv: 'decoy' },
        _plaintextPassword: params.password,
        _plaintextNotes: params.notes,
        updatedAt: new Date().toISOString(),
      };
      const updated = [newItem, ...decoyItems];
      setDecoyItems(updated);
      const email = activeEmail || SessionService.getActiveUserEmail() || 'usuario.pessoal@gmail.com';
      await StorageService.saveDecoyVault(email, updated);
      return newId;
    }
    const id = await VaultService.create(params);
    await refreshVault();
    return id;
  };

  const updateItem = async (id: string, params: Parameters<typeof VaultService.update>[1]) => {
    if (isCamouflageMode) {
      const updated = decoyItems.map((item) =>
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
      );
      setDecoyItems(updated);
      const email = activeEmail || SessionService.getActiveUserEmail() || 'usuario.pessoal@gmail.com';
      await StorageService.saveDecoyVault(email, updated);
      return;
    }
    await VaultService.update(id, params);
    await refreshVault();
  };

  const removeItem = async (id: string) => {
    if (isCamouflageMode) {
      const updated = decoyItems.filter((i) => i.id !== id);
      setDecoyItems(updated);
      const email = activeEmail || SessionService.getActiveUserEmail() || 'usuario.pessoal@gmail.com';
      await StorageService.saveDecoyVault(email, updated);
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
