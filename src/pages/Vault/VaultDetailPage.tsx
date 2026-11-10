import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonContent,
  IonToast,
  IonModal,
} from '@ionic/react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Copy,
  Edit3,
  Trash2,
  ShieldCheck,
  Clock,
  ExternalLink,
  KeyRound,
  Activity,
} from 'lucide-react';
import { useParams, useHistory } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { OrbitRing } from '../../components/brand';
import { useVault } from '../../contexts/VaultContext';
import { useSecurity } from '../../contexts/SecurityContext';
import { ClipboardService } from '../../services/clipboard';
import { StorageService } from '../../services/storage';
import { SessionService } from '../../services/session';

function analyzePasswordStrength(pwd: string) {
  if (!pwd) {
    return { entropy: 0, pct: 0, label: 'Indefinida', color: 'var(--rz-text-muted)', badgeClass: 'rz-badge-neutral' };
  }
  let pool = 0;
  if (/[a-z]/.test(pwd)) pool += 26;
  if (/[A-Z]/.test(pwd)) pool += 26;
  if (/[0-9]/.test(pwd)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pwd)) pool += 32;
  if (pool === 0) pool = 26;

  const entropy = Math.round(pwd.length * Math.log2(pool));
  if (entropy < 45 || pwd.length < 8) {
    return { entropy, pct: 24, label: 'Vulnerável', color: 'var(--rz-danger)', badgeClass: 'rz-badge-danger' };
  }
  if (entropy < 65 || pwd.length < 12) {
    return { entropy, pct: 52, label: 'Moderada', color: 'var(--rz-warning)', badgeClass: 'rz-badge-warning' };
  }
  if (entropy < 90) {
    return { entropy, pct: 80, label: 'Forte', color: 'var(--rz-accent-light)', badgeClass: 'rz-badge-blue' };
  }
  return { entropy, pct: 100, label: 'Blindada (CSPRNG)', color: 'var(--rz-success)', badgeClass: 'rz-badge-success' };
}

export const VaultDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const { items, removeItem, revealPassword, revealHistoryPassword, getTotpCode } = useVault();
  const { unlockWithPIN } = useSecurity();

  const [item, setItem] = useState<(typeof items)[0] | null>(null);
  const [plaintextPassword, setPlaintextPassword] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [totpData, setTotpData] = useState<{ code: string; remainingSeconds: number; period: number } | null>(null);

  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinActionType, setPinActionType] = useState<'REVEAL' | 'REVEAL_HISTORY'>('REVEAL');
  const [selectedHistoryId, setSelectedHistoryId] = useState<string>('');

  useEffect(() => {
    const found = items.find((i) => i.id === id);
    if (found) {
      setItem(found);
    } else {
      history.replace('/vault');
    }
  }, [id, items, history]);

  useEffect(() => {
    if (!item?.encryptedTotpSecret) {
      setTotpData(null);
      return;
    }

    let isMounted = true;
    const fetchTotp = async () => {
      try {
        const res = await getTotpCode(id);
        if (isMounted && res) {
          setTotpData(res);
        }
      } catch (err) {
        console.error('Erro ao gerar código TOTP:', err);
      }
    };

    fetchTotp();
    const interval = setInterval(fetchTotp, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [id, item?.encryptedTotpSecret, getTotpCode]);

  const verifyPinAndProceed = async () => {
    if (!enteredPin) return;

    const res = await unlockWithPIN(enteredPin);
    if (res.success) {
      setShowPinModal(false);
      setEnteredPin('');
      if (pinActionType === 'REVEAL') {
        const decrypted = await revealPassword(id);
        setPlaintextPassword(decrypted);
        setIsRevealed(true);
      } else if (pinActionType === 'REVEAL_HISTORY' && selectedHistoryId) {
        const decrypted = await revealHistoryPassword(id, selectedHistoryId);
        setPlaintextPassword(decrypted);
        setIsRevealed(true);
      }
    } else {
      setToastMsg(res.error || 'PIN incorreto.');
      setShowToast(true);
      setEnteredPin('');
    }
  };

  const handleRevealClick = async () => {
    if (isRevealed) {
      setIsRevealed(false);
      setPlaintextPassword('');
    } else {
      const email = SessionService.getActiveUserEmail();
      if (email) {
        const savedPINHash = await StorageService.getPINHash(email);
        if (savedPINHash) {
          setPinActionType('REVEAL');
          setShowPinModal(true);
          return;
        }
      }
      const decrypted = await revealPassword(id);
      setPlaintextPassword(decrypted);
      setIsRevealed(true);
    }
  };

  const handleRevealHistoryClick = async (historyId: string) => {
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
      const decrypted = await revealHistoryPassword(id, historyId);
      setPlaintextPassword(decrypted);
      setIsRevealed(true);
    } catch {
      setToastMsg('Falha ao decifrar a versão histórica.');
      setShowToast(true);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await ClipboardService.copySecure(text, label, (msg) => {
        setToastMsg(msg);
        setShowToast(true);
      });
    } catch {
      setToastMsg('Erro ao copiar dados.');
      setShowToast(true);
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setShowDeleteConfirm(false);
    await removeItem(id);
    history.replace('/vault');
  };

  const CATEGORY_LABELS: Record<string, string> = {
    LOGIN: 'Login',
    CARD: 'Cartão',
    NOTE: 'Nota Segura',
    IDENTITY: 'Identidade',
    OTHER: 'Outro',
  };

  if (!item) return null;

  const strength = analyzePasswordStrength(isRevealed && plaintextPassword ? plaintextPassword : item._plaintextPassword);
  const totpPeriod = totpData?.period || 30;
  const totpPercent = totpData ? Math.round((totpData.remainingSeconds / totpPeriod) * 100) : 0;

  return (
    <IonPage className="rz-page">
      <IonContent fullscreen className="rz-content">
        <div className="rz-container-narrow">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <button
              type="button"
              className="rz-btn rz-btn-secondary rz-btn-sm"
              onClick={() => history.push('/vault')}
            >
              <ArrowLeft size={15} />
              <span>Voltar ao Cofre</span>
            </button>

            <span className="rz-badge rz-badge-neutral">
              {CATEGORY_LABELS[item.category || 'LOGIN']}
            </span>
          </div>

          <PageHeader
            eyebrow="Inspeção de Credencial"
            title={item.title}
            subtitle={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--rz-success)', fontWeight: 600 }}>
                <ShieldCheck size={15} /> Protegido localmente com AES-256-GCM · Autodestruição de clipboard em 30s
              </span>
            }
            actions={
              <>
                <button
                  type="button"
                  className="rz-btn rz-btn-secondary"
                  onClick={() => history.push(`/vault/edit/${item.id}`)}
                >
                  <Edit3 size={15} />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
                  className="rz-btn rz-btn-danger"
                  onClick={handleDelete}
                >
                  <Trash2 size={15} />
                  <span>Excluir</span>
                </button>
              </>
            }
          />

          {/* Painel de Campos Criptografados */}
          <div className="rz-panel" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Usuário / E-mail */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  background: 'var(--rz-bg-deep)',
                  border: '1px solid var(--rz-border)',
                  borderRadius: 'var(--rz-radius-sm)',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="rz-label">USUÁRIO / E-MAIL</div>
                  <div
                    className="rz-font-mono"
                    style={{
                      color: 'var(--rz-text-primary)',
                      fontSize: 'var(--rz-text-md)',
                      fontWeight: 600,
                      wordBreak: 'break-all',
                    }}
                  >
                    {item.username || '—'}
                  </div>
                </div>
                {item.username && (
                  <button
                    type="button"
                    className="rz-btn rz-btn-secondary rz-btn-sm"
                    onClick={() => copyToClipboard(item.username, 'Usuário')}
                  >
                    <Copy size={14} />
                    <span>Copiar</span>
                  </button>
                )}
              </div>

              {/* Senha de Acesso + Barra de Entropia */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  padding: '14px 16px',
                  background: 'var(--rz-bg-deep)',
                  border: '1px solid var(--rz-border)',
                  borderRadius: 'var(--rz-radius-sm)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="rz-label">SENHA DE ACESSO</div>
                    <div
                      className="rz-font-mono"
                      style={{
                        fontSize: 'var(--rz-text-md)',
                        fontWeight: 600,
                        color: isRevealed ? 'var(--rz-ice)' : 'var(--rz-text-muted)',
                        letterSpacing: isRevealed ? '0.03em' : '0.16em',
                        wordBreak: 'break-all',
                      }}
                    >
                      {isRevealed ? plaintextPassword : '••••••••••••••••'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="rz-btn rz-btn-secondary rz-btn-sm"
                      onClick={handleRevealClick}
                      aria-label={isRevealed ? 'Ocultar senha' : 'Revelar senha'}
                    >
                      {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      type="button"
                      className="rz-btn rz-btn-secondary rz-btn-sm"
                      onClick={async () => {
                        const pass = isRevealed ? plaintextPassword : await revealPassword(id);
                        copyToClipboard(pass, 'Senha');
                      }}
                    >
                      <Copy size={14} />
                      <span>Copiar</span>
                    </button>
                  </div>
                </div>

                {/* Barra de Força / Entropia */}
                <div
                  style={{
                    borderTop: '1px solid var(--rz-border-subtle)',
                    paddingTop: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--rz-text-xs)', color: 'var(--rz-text-secondary)' }}>
                      <Activity size={13} style={{ color: strength.color }} />
                      Entropia estimada: <strong className="rz-font-mono" style={{ color: 'var(--rz-text-primary)' }}>{strength.entropy} bits</strong>
                    </span>
                    <span className={`rz-badge ${strength.badgeClass}`}>{strength.label}</span>
                  </div>
                  <div className="rz-meter">
                    <span style={{ width: `${strength.pct}%`, background: strength.color }} />
                  </div>
                </div>
              </div>

              {/* Código 2FA TOTP com OrbitRing (Ciclo 30s) */}
              {totpData && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 14,
                    flexWrap: 'wrap',
                    padding: '16px',
                    background: 'var(--rz-bg-deep)',
                    border: '1px solid var(--rz-accent-line)',
                    borderRadius: 'var(--rz-radius-sm)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <OrbitRing
                      value={totpPercent}
                      size={54}
                      stroke={4}
                      tone={totpData.remainingSeconds <= 5 ? 'danger' : 'accent'}
                      globe={false}
                      label={`Expira em ${totpData.remainingSeconds} segundos`}
                    >
                      <span className="rz-font-mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--rz-text-primary)' }}>
                        {totpData.remainingSeconds}s
                      </span>
                    </OrbitRing>

                    <div>
                      <div className="rz-label" style={{ marginBottom: 2 }}>CÓDIGO 2FA (TOTP AO VIVO)</div>
                      <div
                        className="rz-font-mono"
                        style={{
                          fontSize: '1.5rem',
                          fontWeight: 700,
                          color: 'var(--rz-ice)',
                          letterSpacing: '0.16em',
                        }}
                      >
                        {totpData.code}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="rz-btn rz-btn-primary"
                    onClick={() => copyToClipboard(totpData.code, 'Código 2FA')}
                  >
                    <Copy size={14} />
                    <span>Copiar 2FA</span>
                  </button>
                </div>
              )}

              {/* Endereço Web (URL) */}
              {item.url && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    background: 'var(--rz-bg-deep)',
                    border: '1px solid var(--rz-border)',
                    borderRadius: 'var(--rz-radius-sm)',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="rz-label">ENDEREÇO WEB</div>
                    <div
                      className="rz-font-mono"
                      style={{
                        color: 'var(--rz-text-primary)',
                        fontSize: 'var(--rz-text-sm)',
                        wordBreak: 'break-all',
                      }}
                    >
                      {item.url}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <a
                      href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rz-btn rz-btn-secondary rz-btn-sm"
                      style={{ textDecoration: 'none' }}
                      aria-label="Abrir site em nova aba"
                    >
                      <ExternalLink size={14} />
                    </a>
                    <button
                      type="button"
                      className="rz-btn rz-btn-secondary rz-btn-sm"
                      onClick={() => copyToClipboard(item.url, 'URL')}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Notas Protegidas */}
              {item._plaintextNotes && (
                <div
                  style={{
                    padding: '14px 16px',
                    background: 'var(--rz-bg-deep)',
                    border: '1px solid var(--rz-border)',
                    borderRadius: 'var(--rz-radius-sm)',
                  }}
                >
                  <div className="rz-label">NOTAS PROTEGIDAS</div>
                  <p
                    className="rz-font-mono"
                    style={{
                      color: 'var(--rz-text-secondary)',
                      fontSize: 'var(--rz-text-sm)',
                      margin: '4px 0 0 0',
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.55,
                    }}
                  >
                    {item._plaintextNotes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Histórico de Alterações */}
          {item.history && item.history.length > 0 && (
            <div className="rz-panel">
              <div className="rz-section-head">
                <h2 className="rz-section-title">
                  <Clock size={15} />
                  <span>Histórico de Alterações</span>
                  <span className="rz-count">{item.history.length}</span>
                </h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {item.history.map((hist, idx) => (
                  <div
                    key={hist.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      background: 'var(--rz-bg-deep)',
                      border: '1px solid var(--rz-border)',
                      borderRadius: 'var(--rz-radius-xs)',
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--rz-text-primary)', fontSize: 'var(--rz-text-sm)', marginRight: 10 }}>
                        Versão #{item.history!.length - idx}
                      </strong>
                      <span className="rz-font-mono" style={{ color: 'var(--rz-text-muted)', fontSize: 'var(--rz-text-xs)' }}>
                        {new Date(hist.updatedAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="rz-btn rz-btn-secondary rz-btn-sm"
                      onClick={() => handleRevealHistoryClick(hist.id)}
                    >
                      <Eye size={13} />
                      <span>Revelar</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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
                  Insira seu código PIN para descriptografar a senha.
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

        <ConfirmModal
          isOpen={showDeleteConfirm}
          title="Excluir Credencial"
          message={`Tem certeza que deseja remover "${item.title}" permanentemente do cofre? Esta ação não pode ser desfeita.`}
          confirmText="Excluir Credencial"
          cancelText="Cancelar"
          variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </IonContent>
    </IonPage>
  );
};
