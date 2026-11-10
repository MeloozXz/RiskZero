import React, { useState, useMemo } from 'react';
import {
  IonModal,
  IonSpinner,
} from '@ionic/react';
import {
  X,
  Search,
  Zap,
  Globe,
  Smartphone,
  ShieldCheck,
  UserRound,
  Lock,
  Sparkles,
} from 'lucide-react';
import { App } from '@capacitor/app';
import { useVault } from '../../contexts/VaultContext';
import { AutofillService, AutofillRequestedEvent } from '../../services/autofill';
import { VaultItem } from '../../types';

export interface AutofillSelectorModalProps {
  isOpen: boolean;
  requestData: AutofillRequestedEvent | null;
  onClose: () => void;
}

function cleanUrlOrDomain(raw?: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split(':')[0]
    .trim();
}

function getPackageKeywords(pkg?: string): string[] {
  if (!pkg) return [];
  const parts = pkg.toLowerCase().split('.');
  return parts.filter(
    (p) => !['com', 'org', 'net', 'io', 'app', 'android', 'mobile', 'apps', 'google', 'br'].includes(p) && p.length >= 3
  );
}

function matchesRequest(item: VaultItem, requestData: AutofillRequestedEvent | null): boolean {
  if (!requestData) return false;
  const itemUrl = cleanUrlOrDomain(item.url);
  const itemTitle = (item.title || '').toLowerCase().trim();

  // 1. Correspondência com Web Domain
  if (requestData.webDomain) {
    const targetDomain = cleanUrlOrDomain(requestData.webDomain);
    if (targetDomain) {
      if (itemUrl.includes(targetDomain) || targetDomain.includes(itemUrl)) return true;
      const domainName = targetDomain.split('.')[0];
      if (domainName.length >= 3 && itemTitle.includes(domainName)) return true;
    }
  }

  // 2. Correspondência com App Package
  if (requestData.appPackage) {
    const pkg = requestData.appPackage.toLowerCase();
    if (itemUrl.includes(pkg) || itemTitle.includes(pkg)) return true;

    const keywords = getPackageKeywords(pkg);
    for (const kw of keywords) {
      if (itemTitle.includes(kw) || itemUrl.includes(kw)) {
        return true;
      }
    }
  }

  return false;
}

export const AutofillSelectorModal: React.FC<AutofillSelectorModalProps> = ({
  isOpen,
  requestData,
  onClose,
}) => {
  const { items, revealPassword } = useVault();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fillingItemId, setFillingItemId] = useState<string | null>(null);

  // Filtra itens pelo texto digitado pelo usuário
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.username.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  // Separa itens sugeridos e demais contas com base no domínio/pacote da solicitação
  const { suggestedItems, otherItems } = useMemo(() => {
    if (!requestData || (!requestData.webDomain && !requestData.appPackage)) {
      return { suggestedItems: [], otherItems: filteredItems };
    }

    const suggested: VaultItem[] = [];
    const others: VaultItem[] = [];

    for (const item of filteredItems) {
      if (matchesRequest(item, requestData)) {
        suggested.push(item);
      } else {
        others.push(item);
      }
    }

    return { suggestedItems: suggested, otherItems: others };
  }, [filteredItems, requestData]);

  // Ação de Preenchimento: Descriptografia sob demanda e envio seguro ao Android
  const handleFill = async (item: VaultItem) => {
    if (fillingItemId) return;
    setFillingItemId(item.id);

    try {
      // Leitura da senha decifrada da RAM (ou decifração sob demanda)
      const plaintextPassword = item._plaintextPassword || (await revealPassword(item.id));
      const username = item.username || '';

      // Envio à memória temporária volátil nativa
      await AutofillService.provideCredentialsToNative(username, plaintextPassword);

      // Fecha o modal e descarta a requisição
      onClose();

      // Restaura o foco para o aplicativo solicitante
      try {
        await App.minimizeApp();
      } catch (err) {
        // Fallback gracioso na web ou em ambientes sem suporte
        console.warn('[AutofillSelectorModal] minimizeApp não suportado no ambiente:', err);
      }
    } catch (error) {
      console.error('[AutofillSelectorModal] Erro ao fornecer credenciais para o Autofill:', error);
    } finally {
      setFillingItemId(null);
    }
  };

  const handleModalClose = () => {
    setSearchQuery('');
    onClose();
  };

  const targetIdentifier = requestData?.webDomain || requestData?.appPackage;
  const isWebTarget = !!requestData?.webDomain;

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={handleModalClose}
      className="rz-dialog"
      style={{
        '--max-width': '500px',
      }}
    >
      <div
        className="rz-dialog-body"
        style={{
          background: 'var(--rz-bg-elevated)',
          color: 'var(--rz-text-primary)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          maxHeight: '88vh',
        }}
      >
        {/* Cabeçalho Orbital */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span className="rz-icon-tile lg">
              {isWebTarget ? <Globe /> : <Smartphone />}
            </span>
            <div style={{ minWidth: 0 }}>
              <p className="rz-eyebrow" style={{ marginBottom: 2 }}>
                Autofill Nativo
              </p>
              <h2 className="rz-dialog-title" style={{ marginBottom: 4 }}>
                Preenchimento Automático
              </h2>
              {targetIdentifier ? (
                <span className="rz-badge rz-badge-blue" style={{ maxWidth: '100%' }}>
                  <Sparkles size={12} />
                  <span className="rz-truncate rz-font-mono">{targetIdentifier}</span>
                </span>
              ) : (
                <p className="rz-dialog-text">
                  Selecione uma conta do cofre para preencher
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleModalClose}
            aria-label="Fechar preenchimento automático"
            className="rz-icon-btn is-bordered"
          >
            <X />
          </button>
        </div>

        {/* Barra de Pesquisa Rápida */}
        <div className="rz-input-group">
          <Search />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar conta, usuário ou URL..."
            aria-label="Pesquisar credencial para preenchimento"
            className="rz-input"
          />
        </div>

        {/* Lista de Contas com Rolagem */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            minHeight: 160,
            maxHeight: 340,
          }}
        >
          {/* Seção 1: Itens Sugeridos para o App/Site */}
          {suggestedItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="rz-section-title" style={{ color: 'var(--rz-ice)', fontSize: '0.78rem' }}>
                <Sparkles size={14} />
                <span>Sugeridos para este aplicativo / site</span>
              </div>

              <div className="rz-list" style={{ borderColor: 'var(--rz-accent-line)' }}>
                {suggestedItems.map((item) => (
                  <div
                    key={item.id}
                    className="rz-row"
                    style={{
                      background: 'var(--rz-accent-soft)',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div className="rz-row-main">
                      <div className="rz-row-title">{item.title}</div>
                      <div className="rz-row-meta" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <UserRound size={12} />
                        <span className="rz-truncate">{item.username || 'Sem usuário'}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleFill(item)}
                      disabled={!!fillingItemId}
                      className="rz-btn rz-btn-primary rz-btn-sm"
                    >
                      {fillingItemId === item.id ? (
                        <IonSpinner name="crescent" style={{ width: 15, height: 15, color: '#fff' }} />
                      ) : (
                        <>
                          <Zap size={13} />
                          <span>Preencher</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Seção 2: Outras Contas / Todas as Contas */}
          {otherItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {suggestedItems.length > 0 && (
                <div className="rz-section-title" style={{ fontSize: '0.78rem' }}>
                  <span>Outras Contas do Cofre</span>
                </div>
              )}

              <div className="rz-list" style={{ background: 'var(--rz-bg-deep)' }}>
                {otherItems.map((item) => (
                  <div
                    key={item.id}
                    className="rz-row"
                    style={{ justifyContent: 'space-between' }}
                  >
                    <div className="rz-row-main">
                      <div className="rz-row-title">{item.title}</div>
                      <div className="rz-row-meta" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <UserRound size={12} />
                        <span className="rz-truncate">{item.username || 'Sem usuário'}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleFill(item)}
                      disabled={!!fillingItemId}
                      className="rz-btn rz-btn-secondary rz-btn-sm"
                    >
                      {fillingItemId === item.id ? (
                        <IonSpinner name="crescent" style={{ width: 15, height: 15 }} />
                      ) : (
                        <>
                          <Zap size={13} style={{ color: 'var(--rz-ice)' }} />
                          <span>Preencher</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Estado Vazio */}
          {filteredItems.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '28px 16px',
                background: 'var(--rz-bg-deep)',
                border: '1px solid var(--rz-border)',
                borderRadius: 'var(--rz-radius-sm)',
                color: 'var(--rz-text-muted)',
              }}
            >
              <Lock size={26} style={{ margin: '0 auto 8px', opacity: 0.7 }} />
              <p style={{ margin: 0, fontSize: 'var(--rz-text-sm)' }}>
                {searchQuery ? 'Nenhuma credencial compatível com a pesquisa.' : 'Nenhuma credencial disponível no cofre.'}
              </p>
            </div>
          )}
        </div>

        {/* Rodapé: Botão Cancelar e Badge Zero-Knowledge */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            borderTop: '1px solid var(--rz-border)',
            paddingTop: 14,
          }}
        >
          <button
            type="button"
            onClick={handleModalClose}
            className="rz-btn rz-btn-secondary rz-btn-block"
          >
            Cancelar
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              color: 'var(--rz-ice)',
              fontSize: '0.72rem',
              fontWeight: 600,
              opacity: 0.9,
            }}
          >
            <ShieldCheck size={13} />
            <span>Zero-Knowledge • Credenciais descriptografadas sob demanda na RAM</span>
          </div>
        </div>
      </div>
    </IonModal>
  );
};

export default AutofillSelectorModal;
