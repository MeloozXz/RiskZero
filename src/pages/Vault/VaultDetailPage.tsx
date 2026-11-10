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
  Clock
} from 'lucide-react';
import { useParams, useHistory } from 'react-router-dom';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useVault } from '../../contexts/VaultContext';
import { useSecurity } from '../../contexts/SecurityContext';
import { ClipboardService } from '../../services/clipboard';
import { StorageService } from '../../services/storage';
import { SessionService } from '../../services/session';

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

  return (
    <IonPage style={{ background: '#09090b' }}>
      <IonContent fullscreen style={{ '--background': '#09090b' }}>
        <div className="rz-page-container" style={{ maxWidth: 720 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <button
              type="button"
              className="rz-btn rz-btn-secondary"
              onClick={() => history.push('/vault')}
            >
              <ArrowLeft size={15} />
              <span>Voltar ao Cofre</span>
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="rz-btn rz-btn-secondary"
                onClick={() => history.push(`/vault/edit/${item.id}`)}
              >
                <Edit3 size={14} />
                <span>Editar</span>
              </button>
              <button
                type="button"
                className="rz-btn rz-btn-danger"
                onClick={handleDelete}
              >
                <Trash2 size={14} />
                <span>Excluir</span>
              </button>
            </div>
          </div>

          <div className="rz-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #27272a' }}>
              <div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fafafa', margin: 0 }}>
                  {item.title}
                </h1>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: '#10b981', marginTop: 4 }}>
                  <ShieldCheck size={13} /> Protegido com AES-256-GCM
                </span>
              </div>
              <span className="rz-badge rz-badge-neutral">
                {CATEGORY_LABELS[item.category || 'LOGIN']}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="rz-label">USUÁRIO / E-MAIL</div>
                  <div style={{ color: '#fafafa', fontSize: '0.92rem' }}>{item.username || '—'}</div>
                </div>
                {item.username && (
                  <button
                    type="button"
                    className="rz-btn rz-btn-secondary"
                    onClick={() => copyToClipboard(item.username, 'Usuário')}
                  >
                    <Copy size={14} />
                    <span>Copiar</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1c1c21', paddingTop: 14 }}>
                <div>
                  <div className="rz-label">SENHA DE ACESSO</div>
                  <div style={{ fontFamily: 'var(--rz-font-mono)', fontSize: '0.95rem', color: isRevealed ? '#fafafa' : '#71717a' }}>
                    {isRevealed ? plaintextPassword : '••••••••••••••••'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="rz-btn rz-btn-secondary" onClick={handleRevealClick}>
                    {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    type="button"
                    className="rz-btn rz-btn-secondary"
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

              {totpData && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1c1c21', paddingTop: 14 }}>
                  <div>
                    <div className="rz-label">CÓDIGO 2FA (TOTP)</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span style={{ fontFamily: 'var(--rz-font-mono)', fontSize: '1.35rem', fontWeight: 700, color: '#3b82f6' }}>
                        {totpData.code}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>
                        {totpData.remainingSeconds}s
                      </span>
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

              {item.url && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1c1c21', paddingTop: 14 }}>
                  <div>
                    <div className="rz-label">ENDEREÇO WEB</div>
                    <div style={{ color: '#fafafa', fontSize: '0.88rem' }}>{item.url}</div>
                  </div>
                  <button
                    type="button"
                    className="rz-btn rz-btn-secondary"
                    onClick={() => copyToClipboard(item.url, 'URL')}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              )}

              {item._plaintextNotes && (
                <div style={{ borderTop: '1px solid #1c1c21', paddingTop: 14 }}>
                  <div className="rz-label">NOTAS PROTEGIDAS</div>
                  <p style={{ color: '#d4d4d8', fontSize: '0.85rem', margin: '4px 0 0 0', whiteSpace: 'pre-wrap' }}>
                    {item._plaintextNotes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {item.history && item.history.length > 0 && (
            <div className="rz-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600, color: '#a1a1aa', marginBottom: 12 }}>
                <Clock size={14} />
                <span>Histórico de Alterações</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {item.history.map((hist, idx) => (
                  <div key={hist.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#09090b', border: '1px solid #27272a', borderRadius: 6 }}>
                    <div>
                      <strong style={{ color: '#d4d4d8', fontSize: '0.8rem', marginRight: 8 }}>
                        Versão #{item.history!.length - idx}
                      </strong>
                      <span style={{ color: '#71717a', fontSize: '0.75rem' }}>
                        {new Date(hist.updatedAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="rz-btn rz-btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
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
              Insira seu código PIN para descriptografar a senha.
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
