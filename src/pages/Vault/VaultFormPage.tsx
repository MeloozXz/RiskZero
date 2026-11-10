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
  KeyRound,
  ShieldCheck,
  Globe,
  UserRound,
  Lock,
} from 'lucide-react';
import { useHistory, useParams } from 'react-router-dom';
import { useVault } from '../../contexts/VaultContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PageHeader } from '../../components/ui/PageHeader';
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
    <IonPage className="rz-page">
      <IonContent fullscreen className="rz-content">
        <div className="rz-container-narrow">
          <div style={{ marginBottom: 16 }}>
            <button
              type="button"
              className="rz-btn rz-btn-secondary rz-btn-sm"
              onClick={() => history.push('/vault')}
            >
              <ArrowLeft size={15} />
              <span>Voltar ao Cofre</span>
            </button>
          </div>

          <PageHeader
            eyebrow={isEditMode ? 'Edição Zero-Knowledge' : 'Novo Registro Blindado'}
            title={isEditMode ? 'Editar Credencial' : 'Nova Credencial Criptografada'}
            subtitle="Os dados abaixo serão cifrados localmente na memória RAM com AES-256-GCM antes do armazenamento."
          />

          <form onSubmit={handleSave} className="rz-panel" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Categoria */}
            <div className="rz-field" style={{ marginBottom: 0 }}>
              <label className="rz-label">CATEGORIA DO REGISTRO</label>
              <div className="rz-scroll-x">
                {CATEGORIES.map((cat) => {
                  const active = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`rz-chip ${active ? 'is-active' : ''}`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grade de 2 colunas no Desktop, 1 coluna no Mobile */}
            <div className="rz-grid-2">
              {/* Nome do Serviço */}
              <div className="rz-field" style={{ marginBottom: 0 }}>
                <label htmlFor="vault-title" className="rz-label">NOME DO SERVIÇO *</label>
                <div className="rz-input-group">
                  <ShieldCheck />
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
              </div>

              {/* Usuário */}
              <div className="rz-field" style={{ marginBottom: 0 }}>
                <label htmlFor="vault-username" className="rz-label">USUÁRIO OU E-MAIL *</label>
                <div className="rz-input-group">
                  <UserRound />
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
              </div>
            </div>

            {/* Senha + Gerador */}
            <div className="rz-field" style={{ marginBottom: 0 }}>
              <label htmlFor="vault-password" className="rz-label">SENHA DE ACESSO *</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div className="rz-input-group" style={{ flex: 1, minWidth: 220 }}>
                  <Lock />
                  <input
                    id="vault-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className={`rz-input ${showPassword ? 'is-mono' : ''}`}
                    required
                  />
                  <button
                    type="button"
                    className="rz-icon-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    style={{ width: 32, height: 32 }}
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
                  <span>Gerar CSPRNG</span>
                </button>
              </div>
            </div>

            {/* Grade de 2 colunas para URL e Segredo TOTP */}
            <div className="rz-grid-2">
              {/* URL */}
              <div className="rz-field" style={{ marginBottom: 0 }}>
                <label htmlFor="vault-url" className="rz-label">ENDEREÇO WEB (URL)</label>
                <div className="rz-input-group">
                  <Globe />
                  <input
                    id="vault-url"
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://console.aws.amazon.com"
                    className="rz-input"
                  />
                </div>
              </div>

              {/* 2FA / TOTP */}
              <div className="rz-field" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <label htmlFor="vault-totp" className="rz-label">
                    SEGREDO 2FA / TOTP (BASE32)
                  </label>
                  {!canUseTOTP && (
                    <button
                      type="button"
                      onClick={() => openUpgradeModal('o Autenticador 2FA / TOTP Integrado', 'PRO')}
                      className="rz-badge rz-badge-violet"
                      style={{ cursor: 'pointer' }}
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
                  className="rz-input is-mono"
                />
              </div>
            </div>

            {/* Notas */}
            <div className="rz-field" style={{ marginBottom: 0 }}>
              <label htmlFor="vault-notes" className="rz-label">NOTAS PROTEGIDAS</label>
              <textarea
                id="vault-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Códigos de recuperação ou observações confidenciais..."
                className="rz-textarea"
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                paddingTop: 14,
                borderTop: '1px solid var(--rz-border)',
                flexWrap: 'wrap',
              }}
            >
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
          className="rz-dialog"
        >
          <div className="rz-dialog-body">
            <PasswordGenerator onSelectPassword={handleSelectGeneratedPassword} />
            <button
              type="button"
              className="rz-btn rz-btn-secondary rz-btn-block"
              style={{ marginTop: 12 }}
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
