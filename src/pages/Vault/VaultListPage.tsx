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
  AlertTriangle,
  X,
} from 'lucide-react';
import { useHistory } from 'react-router-dom';
import { useVault } from '../../contexts/VaultContext';
import { useSecurity } from '../../contexts/SecurityContext';
import { PasswordGenerator } from '../../components/Vault/PasswordGenerator';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { OrbitLoader, OrbitRing } from '../../components/brand';
import { ClipboardService } from '../../services/clipboard';
import { StorageService } from '../../services/storage';
import { SessionService } from '../../services/session';
import { VaultCategory } from '../../types';
import './VaultListPage.css';

export const VaultListPage: React.FC = () => {
  const history = useHistory();
  const {
    items,
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

  const handleDeleteItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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

  const CATEGORIES: { id: VaultCategory | 'ALL'; label: string }[] = [
    { id: 'ALL', label: 'Todos' },
    { id: 'LOGIN', label: 'Logins' },
    { id: 'CARD', label: 'Cartões' },
    { id: 'NOTE', label: 'Notas' },
    { id: 'IDENTITY', label: 'Identidades' },
  ];

  const CATEGORY_LABELS: Record<string, string> = {
    LOGIN: 'Login',
    CARD: 'Cartão',
    NOTE: 'Nota Segura',
    IDENTITY: 'Identidade',
    OTHER: 'Outro',
  };

  const totpPercent = totpData
    ? Math.round((totpData.remainingSeconds / (totpData.period || 30)) * 100)
    : 0;

  return (
    <IonPage className="vault-page">
      <IonContent fullscreen className="vault-content">
        <div className="rz-page-container">
          <PageHeader
            eyebrow="Cofre Zero-Knowledge"
            title="Credenciais"
            subtitle={
              <>
                Criptografia autenticada AES-256-GCM em repouso e área de transferência com autodestruição (30s).
                {healthStats && (
                  <span className="vault-kpi-strip" style={{ marginTop: 8 }}>
                    <span className="rz-badge rz-badge-blue">
                      Total: <strong className="rz-num">{healthStats.total}</strong>
                    </span>
                    {healthStats.weak > 0 && (
                      <span className="rz-badge rz-badge-warning">
                        Fracas: <strong className="rz-num">{healthStats.weak}</strong>
                      </span>
                    )}
                    {healthStats.reused > 0 && (
                      <span className="rz-badge rz-badge-danger">
                        Repetidas: <strong className="rz-num">{healthStats.reused}</strong>
                      </span>
                    )}
                  </span>
                )}
              </>
            }
            actions={
              <>
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
              </>
            }
          />

          {/* Barra Fixa de Busca + Chips Horizontais */}
          <div className="vault-sticky-controls">
            <div className="rz-input-group vault-search-group">
              <Search />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por serviço, usuário ou domínio..."
                className="rz-input"
                aria-label="Filtrar credenciais"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="rz-icon-btn"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpar busca"
                  style={{ width: 28, height: 28 }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="rz-scroll-x" role="tablist" aria-label="Categorias do cofre">
              {CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`rz-chip ${active ? 'is-active' : ''}`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conteúdo Principal: Carregando / Estado Vazio / Master-Detail */}
          {loading ? (
            <div className="rz-panel">
              <OrbitLoader label="Descriptografando registros em memória..." />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rz-panel">
              <EmptyState
                mascot={true}
                mascotVariant="question"
                mascotHeight={170}
                icon={<Lock />}
                title={items.length === 0 ? 'Seu cofre está vazio' : 'Nenhuma credencial encontrada'}
                description={
                  items.length === 0
                    ? 'Adicione sua primeira credencial protegida por AES-256-GCM e derivação Argon2id. Nenhuma chave mestra deixa o seu dispositivo.'
                    : 'Nenhum registro corresponde ao filtro ou termo pesquisado. Ajuste a busca ou troque de categoria.'
                }
                action={
                  items.length === 0 ? (
                    <button
                      type="button"
                      className="rz-btn rz-btn-primary"
                      onClick={() => history.push('/vault/add')}
                    >
                      <Plus size={15} />
                      <span>Adicionar Credencial</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rz-btn rz-btn-secondary"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('ALL');
                      }}
                    >
                      <span>Limpar Filtros</span>
                    </button>
                  )
                }
              />
            </div>
          ) : (
            <div className="vault-split-grid">
              {/* Coluna Esquerda: Lista Densa de Credenciais (.rz-list / .rz-row) */}
              <div className="rz-list vault-master-list" role="listbox" aria-label="Lista de credenciais">
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
                      className={`rz-row is-interactive vault-cred-row ${isSelected ? 'is-selected' : ''}`}
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

                      <div className="rz-row-main">
                        <div className="vault-row-title-line">
                          <span className="rz-row-title">{item.title}</span>
                          <span className="rz-badge rz-badge-neutral">
                            {CATEGORY_LABELS[item.category || 'LOGIN']}
                          </span>
                          {item.encryptedTotpSecret && (
                            <span className="rz-badge rz-badge-blue">2FA</span>
                          )}
                          {weak && (
                            <span className="rz-badge rz-badge-warning">Fraca</span>
                          )}
                        </div>
                        <div className="rz-row-meta">
                          {item.username || 'Sem identificador'}
                        </div>
                      </div>

                      <div className="vault-row-actions">
                        {item.username && (
                          <button
                            type="button"
                            className="rz-icon-btn"
                            title="Copiar usuário"
                            aria-label={`Copiar usuário de ${item.title}`}
                            onClick={(e) => copySecure(item.username, 'Usuário', e)}
                          >
                            <Copy />
                          </button>
                        )}
                        <button
                          type="button"
                          className="rz-icon-btn"
                          title="Inspecionar credencial"
                          aria-label={`Ver detalhes de ${item.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            history.push(`/vault/detail/${item.id}`);
                          }}
                        >
                          <Eye />
                        </button>
                        <button
                          type="button"
                          className="rz-icon-btn is-danger"
                          title="Excluir credencial"
                          aria-label={`Excluir ${item.title}`}
                          onClick={(e) => handleDeleteItem(item.id, e)}
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Coluna Direita: Painel de Detalhes (Inspector) */}
              {activeItem && (
                <aside className="rz-panel vault-detail-pane" aria-label="Detalhes da credencial selecionada">
                  <div className="vault-detail-header">
                    <div className="vault-detail-title-group">
                      <div className="vault-detail-avatar">
                        <span>{(activeItem.title || '?').charAt(0).toUpperCase()}</span>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <h2 className="vault-detail-heading">{activeItem.title}</h2>
                          <span className="rz-badge rz-badge-neutral">
                            {CATEGORY_LABELS[activeItem.category || 'LOGIN']}
                          </span>
                        </div>
                        <span className="vault-detail-meta">
                          <ShieldCheck size={14} /> Cifrado com AES-256-GCM
                        </span>
                      </div>
                    </div>

                    <div className="vault-detail-header-btns">
                      <button
                        type="button"
                        className="rz-btn rz-btn-secondary rz-btn-sm"
                        onClick={() => history.push(`/vault/detail/${activeItem.id}`)}
                      >
                        <Eye size={14} />
                        <span>Tela Cheia</span>
                      </button>
                      <button
                        type="button"
                        className="rz-btn rz-btn-secondary rz-btn-sm"
                        onClick={() => history.push(`/vault/edit/${activeItem.id}`)}
                      >
                        <Edit3 size={14} />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        className="rz-btn rz-btn-danger rz-btn-sm"
                        onClick={() => handleDeleteItem(activeItem.id)}
                        title="Excluir credencial"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {isPasswordWeak(activeItem._plaintextPassword) && (
                    <div className="rz-alert rz-alert-warning">
                      <AlertTriangle />
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
                        <span className="vault-field-val rz-font-mono">{activeItem.username || '—'}</span>
                      </div>
                      {activeItem.username && (
                        <button
                          type="button"
                          className="rz-btn rz-btn-secondary rz-btn-sm"
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
                          className="rz-btn rz-btn-secondary rz-btn-sm"
                          onClick={handleRevealClick}
                          title={isRevealed ? 'Ocultar senha' : 'Revelar senha'}
                        >
                          {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          type="button"
                          className="rz-btn rz-btn-secondary rz-btn-sm"
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
                      <div className="vault-field-row">
                        <div className="vault-field-info">
                          <span className="vault-field-label">CÓDIGO 2FA (TOTP AO VIVO)</span>
                          <div className="vault-totp-box">
                            <OrbitRing
                              value={totpPercent}
                              size={42}
                              stroke={3.5}
                              tone={totpData.remainingSeconds <= 5 ? 'danger' : 'accent'}
                              globe={false}
                              label={`Expira em ${totpData.remainingSeconds} segundos`}
                            >
                              <span className="vault-totp-timer">{totpData.remainingSeconds}s</span>
                            </OrbitRing>
                            <span className="vault-totp-digits">{totpData.code}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="rz-btn rz-btn-primary rz-btn-sm"
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
                          <span className="vault-field-val rz-font-mono" style={{ fontSize: 'var(--rz-text-sm)' }}>
                            {activeItem.url}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <a
                            href={activeItem.url.startsWith('http') ? activeItem.url : `https://${activeItem.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rz-btn rz-btn-secondary rz-btn-sm"
                            style={{ textDecoration: 'none' }}
                          >
                            <ExternalLink size={14} />
                          </a>
                          <button
                            type="button"
                            className="rz-btn rz-btn-secondary rz-btn-sm"
                            onClick={() => copySecure(activeItem.url, 'URL')}
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Notas */}
                    {activeItem._plaintextNotes && (
                      <div className="vault-field-row">
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
                              className="rz-btn rz-btn-secondary rz-btn-sm"
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
          className="rz-dialog"
        >
          <div className="rz-dialog-body">
            <PasswordGenerator />
            <button
              type="button"
              className="rz-btn rz-btn-secondary rz-btn-block"
              style={{ marginTop: 12 }}
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
          className="rz-dialog"
        >
          <div className="rz-dialog-body">
            <div className="rz-dialog-head" style={{ marginBottom: 16 }}>
              <div className="rz-icon-tile lg">
                <KeyRound />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 className="rz-dialog-title">Confirmação de PIN</h3>
                <p className="rz-dialog-text">
                  Digite seu PIN de 6 dígitos para descriptografar e exibir a senha.
                </p>
              </div>
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="rz-input is-mono"
              style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.1rem' }}
            />
            <div className="rz-dialog-actions">
              <button
                type="button"
                className="rz-btn rz-btn-secondary"
                onClick={() => setShowPinModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rz-btn rz-btn-primary"
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
