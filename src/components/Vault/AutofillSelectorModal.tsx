import React, { useState, useMemo } from 'react';
import {
  IonModal,
  IonIcon,
  IonSpinner
} from '@ionic/react';
import {
  closeOutline,
  searchOutline,
  flashOutline,
  globeOutline,
  phonePortraitOutline,
  shieldCheckmarkOutline,
  personOutline,
  lockClosedOutline,
  sparklesOutline
} from 'ionicons/icons';
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
  onClose
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
      style={{
        '--background': 'rgba(7, 10, 19, 0.95)',
        '--border-radius': '24px',
        '--width': '94%',
        '--max-width': '500px',
        '--height': 'fit-content',
        '--max-height': '90vh'
      }}
    >
      <div
        style={{
          padding: '24px',
          background: 'linear-gradient(180deg, rgba(13, 19, 34, 0.98) 0%, rgba(7, 10, 19, 0.99) 100%)',
          border: '1px solid rgba(96, 165, 250, 0.3)',
          borderRadius: '24px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 35px rgba(96, 165, 250, 0.15)',
          color: '#f8fafc',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          boxSizing: 'border-box'
        }}
      >
        {/* Botão Fechar / Cancelar Superior */}
        <button
          onClick={handleModalClose}
          aria-label="Fechar preenchimento automático"
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            zIndex: 10
          }}
        >
          <IonIcon icon={closeOutline} style={{ fontSize: '20px' }} />
        </button>

        {/* Cabeçalho */}
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '12px',
              borderRadius: '18px',
              background: 'rgba(96, 165, 250, 0.12)',
              border: '1px solid rgba(96, 165, 250, 0.3)',
              marginBottom: '10px',
              boxShadow: '0 0 20px rgba(96, 165, 250, 0.2)'
            }}
          >
            <IonIcon
              icon={isWebTarget ? globeOutline : phonePortraitOutline}
              style={{
                color: '#60a5fa',
                fontSize: '28px'
              }}
            />
          </div>

          <h2
            style={{
              margin: '0 0 6px 0',
              fontSize: '1.25rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#ffffff'
            }}
          >
            Preenchimento Automático
          </h2>

          {targetIdentifier ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '12px',
                background: 'rgba(96, 165, 250, 0.08)',
                border: '1px solid rgba(96, 165, 250, 0.2)',
                color: '#60a5fa',
                fontSize: '0.78rem',
                fontWeight: 600,
                maxWidth: '90%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              <IonIcon icon={sparklesOutline} style={{ fontSize: '14px', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {targetIdentifier}
              </span>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
              Selecione uma conta do cofre para preencher
            </p>
          )}
        </div>

        {/* Barra de Pesquisa Rápida */}
        <div
          style={{
            position: 'relative',
            marginBottom: '16px'
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none'
            }}
          >
            <IonIcon icon={searchOutline} style={{ fontSize: '18px' }} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar conta, usuário ou URL..."
            aria-label="Pesquisar credencial para preenchimento"
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              fontSize: '0.85rem',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s ease'
            }}
          />
        </div>

        {/* Lista de Contas com Rolagem */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            paddingRight: '2px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '16px'
          }}
        >
          {/* Seção 1: Itens Sugeridos para o App/Site */}
          {suggestedItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#60a5fa'
                }}
              >
                <IonIcon icon={sparklesOutline} />
                <span>Sugeridos para este aplicativo / site</span>
              </div>

              {suggestedItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '14px',
                    background: 'rgba(96, 165, 250, 0.05)',
                    border: '1px solid rgba(96, 165, 250, 0.25)',
                    boxShadow: '0 4px 14px rgba(96, 165, 250, 0.08)',
                    gap: '12px'
                  }}
                >
                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '0.92rem',
                        color: '#ffffff',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {item.title}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.78rem',
                        color: '#94a3b8',
                        marginTop: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      <IonIcon icon={personOutline} style={{ fontSize: '13px' }} />
                      <span>{item.username || 'Sem usuário'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleFill(item)}
                    disabled={!!fillingItemId}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
                      border: 'none',
                      color: '#070a13',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: fillingItemId ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 10px rgba(96, 165, 250, 0.3)',
                      transition: 'transform 0.15s ease, opacity 0.15s ease',
                      flexShrink: 0
                    }}
                  >
                    {fillingItemId === item.id ? (
                      <IonSpinner name="crescent" style={{ width: '16px', height: '16px', color: '#070a13' }} />
                    ) : (
                      <>
                        <IonIcon icon={flashOutline} style={{ fontSize: '14px' }} />
                        <span>Preencher</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Seção 2: Outras Contas / Todas as Contas */}
          {otherItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {suggestedItems.length > 0 && (
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#64748b',
                    marginTop: '6px'
                  }}
                >
                  Outras Contas do Cofre
                </div>
              )}

              {otherItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '14px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    gap: '12px',
                    transition: 'background 0.2s ease'
                  }}
                >
                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        color: '#f1f5f9',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {item.title}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.76rem',
                        color: '#94a3b8',
                        marginTop: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      <IonIcon icon={personOutline} style={{ fontSize: '13px' }} />
                      <span>{item.username || 'Sem usuário'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleFill(item)}
                    disabled={!!fillingItemId}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#e2e8f0',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: fillingItemId ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                      flexShrink: 0
                    }}
                  >
                    {fillingItemId === item.id ? (
                      <IonSpinner name="crescent" style={{ width: '16px', height: '16px', color: '#e2e8f0' }} />
                    ) : (
                      <>
                        <IonIcon icon={flashOutline} style={{ fontSize: '14px', color: '#60a5fa' }} />
                        <span>Preencher</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Estado Vazio */}
          {filteredItems.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '30px 16px',
                color: '#64748b'
              }}
            >
              <IonIcon icon={lockClosedOutline} style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.6 }} />
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
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
            gap: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: '14px'
          }}
        >
          <button
            onClick={handleModalClose}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'background 0.2s ease'
            }}
          >
            Cancelar
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              color: '#60a5fa',
              fontSize: '0.7rem',
              fontWeight: 500,
              opacity: 0.85
            }}
          >
            <IonIcon icon={shieldCheckmarkOutline} style={{ fontSize: '13px' }} />
            <span>Zero-Knowledge • Credenciais descriptografadas sob demanda na RAM</span>
          </div>
        </div>
      </div>
    </IonModal>
  );
};

export default AutofillSelectorModal;
