import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonContent,
  IonToast,
  IonModal,
} from '@ionic/react';
import {
  ArrowLeft,
  Save,
  Eye,
  EyeOff,
  KeyRound
} from 'lucide-react';
import { useHistory, useParams } from 'react-router-dom';
import { useVault } from '../../contexts/VaultContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PasswordGenerator } from '../../components/Vault/PasswordGenerator';
import { VaultCategory } from '../../types';

export const VaultFormPage: React.FC = () => {
  const history = useHistory();
  const { id } = useParams<{ id?: string }>();
  const { items, createItem, updateItem, revealTotpSecret } = useVault();
  const { canUseTOTP, openUpgradeModal } = useSubscription();

  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<VaultCategory>('LOGIN');
  const [totpSecret, setTotpSecret] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showGenModal, setShowGenModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const isEditMode = !!id;

  useEffect(() => {
    if (isEditMode && id) {
      const existing = items.find((item) => item.id === id);
      if (existing) {
        setTitle(existing.title);
        setUsername(existing.username);
        setPassword(existing._plaintextPassword);
        setUrl(existing.url);
        setCategory(existing.category || 'LOGIN');
        if (existing.encryptedNotes) {
          setNotes(existing._plaintextNotes || '');
        }
        if (existing.encryptedTotpSecret) {
          revealTotpSecret(id).then((secret) => {
            if (secret) setTotpSecret(secret);
          });
        }
      }
    }
  }, [isEditMode, id, items, revealTotpSecret]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !username.trim() || !password) {
      setToastMsg('Preencha Nome do Serviço, Usuário e Senha.');
      setShowToast(true);
      return;
    }

    try {
      if (isEditMode && id) {
        await updateItem(id, {
          title: title.trim(),
          username: username.trim(),
          password,
          url: url.trim(),
          category,
          notes: notes.trim() || undefined,
          totpSecret: totpSecret.trim() || undefined,
        });
        setToastMsg('Credencial atualizada.');
      } else {
        await createItem({
          title: title.trim(),
          username: username.trim(),
          password,
          url: url.trim(),
          category,
          notes: notes.trim() || undefined,
          totpSecret: totpSecret.trim() || undefined,
        });
        setToastMsg('Credencial adicionada ao cofre.');
      }
      setShowToast(true);
      setTimeout(() => {
        history.push('/vault');
      }, 600);
    } catch {
      setToastMsg('Erro ao salvar credencial.');
      setShowToast(true);
    }
  };

  const handleSelectGeneratedPassword = (generated: string) => {
    setPassword(generated);
    setShowGenModal(false);
    setToastMsg('Senha gerada aplicada.');
    setShowToast(true);
  };

  const CATEGORIES: { id: VaultCategory; label: string }[] = [
    { id: 'LOGIN', label: 'Login' },
    { id: 'CARD', label: 'Cartão' },
    { id: 'NOTE', label: 'Nota Segura' },
    { id: 'IDENTITY', label: 'Identidade' },
    { id: 'OTHER', label: 'Outro' },
  ];

  return (
    <IonPage style={{ background: '#09090b' }}>
      <IonContent fullscreen style={{ '--background': '#09090b' }}>
        <div className="rz-page-container" style={{ maxWidth: 680 }}>
          <div style={{ marginBottom: 20 }}>
            <button
              type="button"
              className="rz-btn rz-btn-secondary"
              onClick={() => history.push('/vault')}
            >
              <ArrowLeft size={15} />
              <span>Voltar ao Cofre</span>
            </button>
          </div>

          <form onSubmit={handleSave} className="rz-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ borderBottom: '1px solid #27272a', paddingBottom: 14 }}>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fafafa', margin: 0 }}>
                {isEditMode ? 'Editar Credencial' : 'Nova Credencial Criptografada'}
              </h1>
              <p style={{ fontSize: '0.8rem', color: '#a1a1aa', margin: '4px 0 0 0' }}>
                Os dados abaixo serão cifrados localmente com AES-256-GCM antes do armazenamento.
              </p>
            </div>

            {/* Categoria */}
            <div>
              <label className="rz-label">CATEGORIA</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CATEGORIES.map((cat) => {
                  const active = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={active ? 'rz-btn rz-btn-primary' : 'rz-btn rz-btn-secondary'}
                      style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nome do Serviço */}
            <div>
              <label htmlFor="vault-title" className="rz-label">NOME DO SERVIÇO *</label>
              <input
                id="vault-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: AWS Console, GitHub, Banco Itaú"
                className="rz-input"
                required
              />
            </div>

            {/* Usuário */}
            <div>
              <label htmlFor="vault-username" className="rz-label">USUÁRIO OU E-MAIL *</label>
              <input
                id="vault-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="usuario@empresa.com"
                className="rz-input"
                required
              />
            </div>

            {/* Senha */}
            <div>
              <label htmlFor="vault-password" className="rz-label">SENHA DE ACESSO *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    id="vault-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="rz-input"
                    style={{ paddingRight: 38, fontFamily: showPassword ? 'var(--rz-font-mono)' : 'inherit' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: '#71717a',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button
                  type="button"
                  className="rz-btn rz-btn-secondary"
                  onClick={() => setShowGenModal(true)}
                  title="Gerar senha forte CSPRNG"
                >
                  <KeyRound size={15} />
                  <span>Gerar</span>
                </button>
              </div>
            </div>

            {/* URL */}
            <div>
              <label htmlFor="vault-url" className="rz-label">ENDEREÇO WEB (URL)</label>
              <input
                id="vault-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://console.aws.amazon.com"
                className="rz-input"
              />
            </div>

            {/* 2FA / TOTP */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label htmlFor="vault-totp" className="rz-label" style={{ marginBottom: 0 }}>
                  SEGREDO 2FA / TOTP (BASE32 OU OTPAUTH)
                </label>
                {!canUseTOTP && (
                  <button
                    type="button"
                    onClick={() => openUpgradeModal('o Autenticador 2FA / TOTP Integrado', 'PRO')}
                    className="rz-badge rz-badge-blue"
                    style={{ cursor: 'pointer', border: '1px solid rgba(59,130,246,0.4)' }}
                  >
                    Plano Pro
                  </button>
                )}
              </div>
              <input
                id="vault-totp"
                type="text"
                value={totpSecret}
                disabled={!canUseTOTP}
                onChange={(e) => setTotpSecret(e.target.value)}
                placeholder={canUseTOTP ? 'Ex: JBSWY3DPEHPK3PXP' : 'Disponível no Plano Pro'}
                className="rz-input"
              />
            </div>

            {/* Notas */}
            <div>
              <label htmlFor="vault-notes" className="rz-label">NOTAS PROTEGIDAS</label>
              <textarea
                id="vault-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Códigos de recuperação ou observações confidenciais..."
                className="rz-input"
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8, borderTop: '1px solid #27272a' }}>
              <button
                type="button"
                className="rz-btn rz-btn-secondary"
                onClick={() => history.push('/vault')}
              >
                Cancelar
              </button>
              <button type="submit" className="rz-btn rz-btn-primary">
                <Save size={15} />
                <span>Salvar Credencial</span>
              </button>
            </div>
          </form>
        </div>

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
            <PasswordGenerator onSelectPassword={handleSelectGeneratedPassword} />
            <button
              type="button"
              className="rz-btn rz-btn-secondary"
              style={{ width: '100%', marginTop: '12px' }}
              onClick={() => setShowGenModal(false)}
            >
              Cancelar
            </button>
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
      </IonContent>
    </IonPage>
  );
};
