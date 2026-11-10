import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonContent,
  IonModal,
  IonToast,
} from '@ionic/react';
import {
  Plus,
  KeyRound,
  Search,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  Edit3,
  ExternalLink,
  Lock,
  ShieldCheck,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { useHistory } from 'react-router-dom';
import { useVault } from '../../contexts/VaultContext';
import { useSecurity } from '../../contexts/SecurityContext';
import { PasswordGenerator } from '../../components/Vault/PasswordGenerator';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { ClipboardService } from '../../services/clipboard';
import { StorageService } from '../../services/storage';
import { SessionService } from '../../services/session';
import './VaultListPage.css';

export const VaultListPage: React.FC = () => {
  const history = useHistory();
  const {
    filteredItems,
    loading,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    healthStats,
    removeItem,
    revealPassword,
    revealHistoryPassword,
    getTotpCode,
  } = useVault();
  const { unlockWithPIN } = useSecurity();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [plaintextPassword, setPlaintextPassword] = useState('');
  const [totpData, setTotpData] = useState<{ code: string; remainingSeconds: number; period: number } | null>(null);

  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinActionType, setPinActionType] = useState<'REVEAL' | 'REVEAL_HISTORY'>('REVEAL');
  const [selectedHistoryId, setSelectedHistoryId] = useState<string>('');

  const [showGenModal, setShowGenModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Seleciona automaticamente o primeiro item no desktop ou mantém o selecionado
  useEffect(() => {
    if (filteredItems.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredItems.some((i) => i.id === selectedId)) {
      setSelectedId(filteredItems[0].id);
    }
  }, [filteredItems, selectedId]);

  const activeItem = filteredItems.find((i) => i.id === selectedId) || null;

  // Reseta estado de senha revelada ao trocar de item
  useEffect(() => {
    setIsRevealed(false);
    setPlaintextPassword('');
  }, [selectedId]);

  // Atualiza código TOTP ao vivo para o item selecionado
  useEffect(() => {
    if (!activeItem?.encryptedTotpSecret) {
      setTotpData(null);
      return;
    }

    let isMounted = true;
    const fetchTotp = async () => {
      try {
        const res = await getTotpCode(activeItem.id);
        if (isMounted && res) {
          setTotpData(res);
        }
      } catch {
        // Ignora erro silenciosamente
      }
    };

    fetchTotp();
    const interval = setInterval(fetchTotp, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeItem?.id, activeItem?.encryptedTotpSecret, getTotpCode]);

  const copySecure = async (text: string, label: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await ClipboardService.copySecure(text, label, (msg) => {
        setToastMsg(msg);
        setShowToast(true);
      });
    } catch {
      setToastMsg('Erro ao copiar para a área de transferência.');
      setShowToast(true);
    }
  };

  const handleRevealClick = async () => {
    if (!activeItem) return;
    if (isRevealed) {
      setIsRevealed(false);
      setPlaintextPassword('');
      return;
    }

    const email = SessionService.getActiveUserEmail();
    if (email) {
      const savedPINHash = await StorageService.getPINHash(email);
      if (savedPINHash) {
        setPinActionType('REVEAL');
        setShowPinModal(true);
        return;
      }
    }

    const decrypted = await revealPassword(activeItem.id);
    setPlaintextPassword(decrypted);
    setIsRevealed(true);
  };

  const handleRevealHistoryClick = async (historyId: string) => {
    if (!activeItem) return;
    setSelectedHistoryId(historyId);
    const email = SessionService.getActiveUserEmail();
    if (email) {
      const savedPINHash = await StorageService.getPINHash(email);
      if (savedPINHash) {
        setPinActionType('REVEAL_HISTORY');
        setShowPinModal(true);
        return;
      }
    }

    try {
      const decrypted = await revealHistoryPassword(activeItem.id, historyId);
      setPlaintextPassword(decrypted);
      setIsRevealed(true);
      setToastMsg('Senha histórica exibida no campo de senha.');
      setShowToast(true);
    } catch {
      setToastMsg('Não foi possível decifrar a versão anterior.');
      setShowToast(true);
    }
  };

  const verifyPinAndProceed = async () => {
    if (!enteredPin || !activeItem) return;
    const res = await unlockWithPIN(enteredPin);
    if (res.success) {
      setShowPinModal(false);
      setEnteredPin('');
      if (pinActionType === 'REVEAL') {
        const decrypted = await revealPassword(activeItem.id);
        setPlaintextPassword(decrypted);
        setIsRevealed(true);
      } else if (pinActionType === 'REVEAL_HISTORY' && selectedHistoryId) {
        const decrypted = await revealHistoryPassword(activeItem.id, selectedHistoryId);
        setPlaintextPassword(decrypted);
        setIsRevealed(true);
      }
    } else {
      setToastMsg(res.error || 'PIN incorreto.');
      setShowToast(true);
      setEnteredPin('');
    }
  };

  const handleDeleteItem = (id: string) => {
    setDeleteTargetId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    const targetId = deleteTargetId;
    setDeleteTargetId(null);
    await removeItem(targetId);
    if (selectedId === targetId) {
      setSelectedId(null);
    }
    setToastMsg('Credencial removida com sucesso.');
    setShowToast(true);
  };

  const getDomainFavicon = (url: string) => {
    try {
      if (!url) return null;
      const normalized = url.startsWith('http') ? url : `https://${url}`;
      const domain = new URL(normalized).hostname;
      return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
    } catch {
      return null;
    }
  };

  const isPasswordWeak = (pwd: string) => {
    return (
      pwd.length < 12 ||
      !/[A-Z]/.test(pwd) ||
      !/[0-9]/.test(pwd) ||
      !/[!@#$%^&*(),.?":{}|<>]/.test(pwd)
    );
  };

  const CATEGORIES = [
    { id: 'ALL', label: 'Todos' },
    { id: 'LOGIN', label: 'Logins' },
    { id: 'CARD', label: 'Cartões' },
    { id: 'NOTE', label: 'Notas' },
    { id: 'IDENTITY', label: 'Identidades' },
  ] as const;

  const CATEGORY_LABELS: Record<string, string> = {
    LOGIN: 'Login',
    CARD: 'Cartão',
    NOTE: 'Nota Segura',
    IDENTITY: 'Identidade',
    OTHER: 'Outro',
  };

  return (
    <IonPage className="vault-page">
      <IonContent fullscreen className="vault-content">
        <div className="vault-workspace">
          {/* Header Corporativo */}
          <header className="vault-topbar">
            <div>
              <h1 className="vault-main-heading">Cofre de Credenciais</h1>
              <p className="vault-main-sub">
                Criptografia autenticada AES-256-GCM em repouso e área de transferência com autodestruição (30s).
              </p>
            </div>

            <div className="vault-topbar-actions">
              {healthStats && (
                <div className="vault-kpi-strip">
                  <span className="vault-kpi-pill">
                    Total: <strong>{healthStats.total}</strong>
                  </span>
                  {healthStats.weak > 0 && (
                    <span className="vault-kpi-pill warning">
                      Fracas: <strong>{healthStats.weak}</strong>
                    </span>
                  )}
                  {healthStats.reused > 0 && (
                    <span className="vault-kpi-pill danger">
                      Repetidas: <strong>{healthStats.reused}</strong>
                    </span>
                  )}
                </div>
              )}

              <button
                type="button"
                className="rz-btn rz-btn-secondary"
                onClick={() => setShowGenModal(true)}
              >
                <KeyRound size={15} />
                <span>Gerador</span>
              </button>

              <button
                type="button"
                className="rz-btn rz-btn-primary"
                onClick={() => history.push('/vault/add')}
              >
                <Plus size={16} />
                <span>Nova Credencial</span>
              </button>
            </div>
          </header>

          {/* Barra de Filtros e Busca */}
          <div className="vault-filter-bar">
            <div className="vault-search-box">
              <Search size={16} className="vault-search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por serviço, usuário ou domínio..."
                className="vault-search-input"
              />
            </div>

            <div className="vault-category-tabs">
              {CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id as any)}
                    className={`vault-cat-tab ${active ? 'active' : ''}`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Layout Master-Detail Split View */}
          {loading ? (
            <div className="vault-empty-box">
              <span>Descriptografando registros em memória...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="vault-empty-box">
              <Lock size={28} className="text-zinc-500" />
              <h3>Nenhuma credencial encontrada</h3>
              <p>Adicione sua primeira credencial protegida por AES-256-GCM ou ajuste o filtro de busca.</p>
              <button
                type="button"
                className="rz-btn rz-btn-primary"
                style={{ marginTop: 8 }}
                onClick={() => history.push('/vault/add')}
              >
                <Plus size={15} />
                <span>Adicionar Credencial</span>
              </button>
            </div>
          ) : (
            <div className="vault-split-grid">
              {/* Coluna Esquerda: Lista de Itens */}
              <div className="vault-master-list" role="listbox" aria-label="Lista de credenciais">
                {filteredItems.map((item) => {
                  const favicon = getDomainFavicon(item.url);
                  const weak = isPasswordWeak(item._plaintextPassword);
                  const isSelected = item.id === activeItem?.id;

                  return (
                    <div
                      key={item.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => setSelectedId(item.id)}
                      className={`vault-list-row ${isSelected ? 'selected' : ''}`}
                    >
                      <div className="vault-row-avatar">
                        {favicon ? (
                          <img
                            src={favicon}
                            alt=""
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span>{(item.title || '?').charAt(0).toUpperCase()}</span>
                        )}
                      </div>

                      <div className="vault-row-main">
                        <div className="vault-row-title-line">
                          <span className="vault-row-title">{item.title}</span>
                          {item.encryptedTotpSecret && (
                            <span className="rz-badge rz-badge-blue">2FA</span>
                          )}
                          {weak && (
                            <span className="rz-badge rz-badge-warning">Fraca</span>
                          )}
                        </div>
                        <span className="vault-row-sub">
                          {item.username || 'Sem identificador'}
                        </span>
                      </div>

                      <div className="vault-row-actions">
                        {item.username && (
                          <button
                            type="button"
                            className="vault-icon-action"
                            title="Copiar usuário"
                            onClick={(e) => copySecure(item.username, 'Usuário', e)}
                          >
                            <Copy size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Coluna Direita: Painel de Detalhes (Inspector) */}
              {activeItem && (
                <aside className="vault-detail-pane" aria-label="Detalhes da credencial selecionada">
                  <div className="vault-detail-header">
                    <div className="vault-detail-title-group">
                      <div className="vault-detail-avatar">
                        <span>{(activeItem.title || '?').charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <h2>{activeItem.title}</h2>
                          <span className="rz-badge rz-badge-neutral">
                            {CATEGORY_LABELS[activeItem.category || 'LOGIN']}
                          </span>
                        </div>
                        <span className="vault-detail-meta">
                          <ShieldCheck size={13} /> Cifrado com AES-256-GCM
                        </span>
                      </div>
                    </div>

                    <div className="vault-detail-header-btns">
                      <button
                        type="button"
                        className="rz-btn rz-btn-secondary"
                        onClick={() => history.push(`/vault/edit/${activeItem.id}`)}
                      >
                        <Edit3 size={14} />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        className="rz-btn rz-btn-danger"
                        onClick={() => handleDeleteItem(activeItem.id)}
                        title="Excluir credencial"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {isPasswordWeak(activeItem._plaintextPassword) && (
                    <div className="vault-weak-banner">
                      <AlertTriangle size={15} className="shrink-0" />
                      <span>
                        Esta senha possui baixa entropia ou menos de 12 caracteres. Recomendamos atualizá-la usando o Gerador CSPRNG.
                      </span>
                    </div>
                  )}

                  <div className="vault-fields-card">
                    {/* Usuário */}
                    <div className="vault-field-row">
                      <div className="vault-field-info">
                        <span className="vault-field-label">USUÁRIO / E-MAIL</span>
                        <span className="vault-field-val">{activeItem.username || '—'}</span>
                      </div>
                      {activeItem.username && (
                        <button
                          type="button"
                          className="rz-btn rz-btn-secondary"
                          onClick={() => copySecure(activeItem.username, 'Usuário')}
                        >
                          <Copy size={14} />
                          <span>Copiar</span>
                        </button>
                      )}
                    </div>

                    {/* Senha */}
                    <div className="vault-field-row">
                      <div className="vault-field-info">
                        <span className="vault-field-label">SENHA DE ACESSO</span>
                        <span className={`vault-field-val mono ${isRevealed ? 'revealed' : 'masked'}`}>
                          {isRevealed ? plaintextPassword : '••••••••••••••••'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="rz-btn rz-btn-secondary"
                          onClick={handleRevealClick}
                          title={isRevealed ? 'Ocultar senha' : 'Revelar senha'}
                        >
                          {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          type="button"
                          className="rz-btn rz-btn-secondary"
                          onClick={async () => {
                            const pwd = isRevealed ? plaintextPassword : await revealPassword(activeItem.id);
                            copySecure(pwd, 'Senha');
                          }}
                        >
                          <Copy size={14} />
                          <span>Copiar</span>
                        </button>
                      </div>
                    </div>

                    {/* 2FA / TOTP */}
                    {totpData && (
                      <div className="vault-field-row totp-row">
                        <div className="vault-field-info">
                          <span className="vault-field-label">CÓDIGO 2FA (TOTP AO VIVO)</span>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                            <span className="vault-totp-digits">{totpData.code}</span>
                            <span className="vault-totp-timer">{totpData.remainingSeconds}s</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="rz-btn rz-btn-primary"
                          onClick={() => copySecure(totpData.code, 'Código 2FA')}
                        >
                          <Copy size={14} />
                          <span>Copiar 2FA</span>
                        </button>
                      </div>
                    )}

                    {/* URL */}
                    {activeItem.url && (
                      <div className="vault-field-row">
                        <div className="vault-field-info">
                          <span className="vault-field-label">ENDEREÇO WEB (URL)</span>
                          <span className="vault-field-val url-text">{activeItem.url}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <a
                            href={activeItem.url.startsWith('http') ? activeItem.url : `https://${activeItem.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rz-btn rz-btn-secondary"
                            style={{ textDecoration: 'none' }}
                          >
                            <ExternalLink size={14} />
                          </a>
                          <button
                            type="button"
                            className="rz-btn rz-btn-secondary"
                            onClick={() => copySecure(activeItem.url, 'URL')}
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Notas */}
                    {activeItem._plaintextNotes && (
                      <div className="vault-field-row notes-row">
                        <div className="vault-field-info" style={{ width: '100%' }}>
                          <span className="vault-field-label">NOTAS PROTEGIDAS</span>
                          <p className="vault-notes-content">{activeItem._plaintextNotes}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Histórico de Senhas */}
                  {activeItem.history && activeItem.history.length > 0 && (
                    <div className="vault-history-section">
                      <div className="vault-history-header">
                        <Clock size={14} />
                        <span>Histórico de Rotações ({activeItem.history.length})</span>
                      </div>
                      <div className="vault-history-list">
                        {activeItem.history.map((hist, idx) => (
                          <div key={hist.id} className="vault-history-item">
                            <div>
                              <strong>Versão #{activeItem.history!.length - idx}</strong>
                              <span>{new Date(hist.updatedAt).toLocaleString('pt-BR')}</span>
                            </div>
                            <button
                              type="button"
                              className="rz-btn rz-btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              onClick={() => handleRevealHistoryClick(hist.id)}
                            >
                              <Eye size={13} />
                              <span>Ver</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </aside>
              )}
            </div>
          )}
        </div>

        {/* Modal Gerador de Senhas */}
        <IonModal
          isOpen={showGenModal}
          onDidDismiss={() => setShowGenModal(false)}
          style={{
            '--background': '#121215',
            '--border-radius': '12px',
            '--width': '92%',
            '--max-width': '480px',
            '--height': 'fit-content',
          }}
        >
          <div style={{ padding: '20px', background: '#121215', border: '1px solid #27272a', borderRadius: '12px' }}>
            <PasswordGenerator />
            <button
              type="button"
              className="rz-btn rz-btn-secondary"
              style={{ width: '100%', marginTop: '12px' }}
              onClick={() => setShowGenModal(false)}
            >
              Fechar Gerador
            </button>
          </div>
        </IonModal>

        {/* Modal Confirmação de PIN */}
        <IonModal
          isOpen={showPinModal}
          onDidDismiss={() => {
            setShowPinModal(false);
            setEnteredPin('');
          }}
          style={{
            '--background': '#121215',
            '--border-radius': '12px',
            '--width': '90%',
            '--max-width': '360px',
            '--height': 'fit-content',
          }}
        >
          <div style={{ padding: '24px', background: '#121215', border: '1px solid #27272a', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 6px 0', color: '#fafafa', fontSize: '1rem', fontWeight: 700 }}>
              Confirmação de PIN
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.8rem', color: '#a1a1aa' }}>
              Digite seu PIN de 6 dígitos para descriptografar e exibir a senha.
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="rz-input"
              style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.1rem', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="rz-btn rz-btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setShowPinModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rz-btn rz-btn-primary"
                style={{ flex: 1 }}
                onClick={verifyPinAndProceed}
              >
                Confirmar
              </button>
            </div>
          </div>
        </IonModal>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          duration={2000}
          color="dark"
          position="bottom"
        />

        {/* Modal de Confirmação de Exclusão */}
        <ConfirmModal
          isOpen={deleteTargetId !== null}
          title="Excluir Credencial"
          message={`Tem certeza que deseja remover ${
            filteredItems.find((i) => i.id === deleteTargetId)?.title
              ? `"${filteredItems.find((i) => i.id === deleteTargetId)?.title}"`
              : 'esta credencial'
          } permanentemente do seu cofre? Esta ação não pode ser desfeita.`}
          confirmText="Excluir Credencial"
          cancelText="Cancelar"
          variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTargetId(null)}
        />
      </IonContent>
    </IonPage>
  );
};
