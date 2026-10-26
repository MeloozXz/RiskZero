import React, { useState, useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonInput,
  IonButton,
  IonIcon,
  IonButtons,
  IonBackButton,
  IonTextarea,
  IonToast,
  IonModal,
} from '@ionic/react';
import {
  saveOutline,
  eyeOutline,
  eyeOffOutline,
  keyOutline,
  globeOutline,
  personOutline,
  lockClosedOutline,
  documentTextOutline,
  qrCodeOutline,
} from 'ionicons/icons';
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

  const handleSave = async () => {
    if (!title || !username || !password) {
      setToastMsg('Por favor, preencha Título, Usuário e Senha.');
      setShowToast(true);
      return;
    }

    try {
      if (isEditMode && id) {
        await updateItem(id, {
          title,
          username,
          password,
          url,
          category,
          notes: notes || undefined,
          totpSecret: totpSecret.trim() || undefined,
        });
        setToastMsg('Credencial atualizada com sucesso!');
      } else {
        await createItem({
          title,
          username,
          password,
          url,
          category,
          notes: notes || undefined,
          totpSecret: totpSecret.trim() || undefined,
        });
        setToastMsg('Credencial salva com sucesso!');
      }
      setShowToast(true);
      setTimeout(() => {
        history.goBack();
      }, 1000);
    } catch (e) {
      console.error(e);
      setToastMsg('Erro ao salvar credencial.');
      setShowToast(true);
    }
  };

  const handleSelectGeneratedPassword = (generated: string) => {
    setPassword(generated);
    setShowGenModal(false);
    setToastMsg('Senha gerada aplicada com sucesso!');
    setShowToast(true);
  };

  const CATEGORIES: { id: VaultCategory; label: string }[] = [
    { id: 'LOGIN', label: 'Login' },
    { id: 'CARD', label: 'Cartão de Crédito' },
    { id: 'NOTE', label: 'Nota Segura' },
    { id: 'IDENTITY', label: 'Identidade' },
    { id: 'OTHER', label: 'Outro' },
  ];

  return (
    <IonPage style={{ background: 'transparent' }}>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'transparent', '--color': '#e8ecf2' }}>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/vault" style={{ color: '#fff' }} />
          </IonButtons>
          <IonTitle style={{ fontWeight: '700', fontSize: '1.25rem' }}>
            {isEditMode ? 'Editar Credencial' : 'Nova Credencial'}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': '#070a13' }}>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Seletor de Categoria */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', marginLeft: '4px' }}>
              Categoria
            </span>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    style={{
                      background: isSelected ? 'rgba(96, 165, 250, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      color: isSelected ? '#60a5fa' : '#94a3b8',
                      border: isSelected ? '1px solid #60a5fa' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '8px 16px',
                      fontSize: '0.85rem',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Título da Credencial */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', marginLeft: '4px' }}>
              Nome do Serviço
            </span>
            <IonItem lines="none" style={{ '--background': 'rgba(20, 28, 45, 0.7)', '--border-radius': '14px', border: '1px solid rgba(255,255,255,0.08)', padding: '2px 8px' }}>
              <IonIcon icon={keyOutline} slot="start" style={{ color: '#60a5fa', fontSize: '20px', marginRight: '14px', flexShrink: 0 }} />
              <IonInput
                value={title}
                onIonInput={(e) => setTitle(e.detail.value ?? '')}
                placeholder="Ex: Google, Netflix, Banco"
                style={{ '--color': '#fff', '--padding-start': '6px' }}
              />
            </IonItem>
          </div>

          {/* Usuário / E-mail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: '600', marginLeft: '4px' }}>
              Nome de Usuário / E-mail
            </span>
            <IonItem lines="none" style={{ '--background': 'rgba(255,255,255,0.04)', '--border-radius': '14px', border: '1px solid rgba(255,255,255,0.05)', padding: '2px 8px' }}>
              <IonIcon icon={personOutline} slot="start" style={{ color: '#60a5fa', fontSize: '20px', marginRight: '14px', flexShrink: 0 }} />
              <IonInput
                value={username}
                onIonInput={(e) => setUsername(e.detail.value ?? '')}
                placeholder="usuario@email.com"
                style={{ '--color': '#fff', '--padding-start': '6px' }}
              />
            </IonItem>
          </div>

          {/* Senha */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: '600', marginLeft: '4px' }}>
              Senha de Acesso
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <IonItem lines="none" style={{ flex: '1', '--background': 'rgba(20, 28, 45, 0.7)', '--border-radius': '14px', border: '1px solid rgba(255,255,255,0.08)', padding: '2px 8px' }}>
                <IonIcon icon={lockClosedOutline} slot="start" style={{ color: '#60a5fa', fontSize: '20px', marginRight: '14px', flexShrink: 0 }} />
                <IonInput
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onIonInput={(e) => setPassword(e.detail.value ?? '')}
                  placeholder="••••••••••••"
                  style={{ '--color': '#fff', '--padding-start': '6px', fontFamily: showPassword ? 'monospace' : 'inherit' }}
                />
                <IonButton fill="clear" color="light" slot="end" onClick={() => setShowPassword(!showPassword)}>
                  <IonIcon icon={showPassword ? eyeOffOutline : eyeOutline} style={{ color: '#94a3b8', fontSize: '20px', marginLeft: '8px' }} />
                </IonButton>
              </IonItem>
              <IonButton
                onClick={() => setShowGenModal(true)}
                style={{
                  height: '48px',
                  '--background': 'rgba(56, 128, 255, 0.1)',
                  '--color': '#60a5fa',
                  '--border-radius': '14px',
                  margin: '0',
                }}
              >
                <IonIcon icon={keyOutline} slot="icon-only" style={{ fontSize: '20px' }} />
              </IonButton>
            </div>
          </div>

          {/* URL do Website */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: '600', marginLeft: '4px' }}>
              Endereço / URL do Site
            </span>
            <IonItem lines="none" style={{ '--background': 'rgba(255,255,255,0.04)', '--border-radius': '14px', border: '1px solid rgba(255,255,255,0.05)', padding: '2px 8px' }}>
              <IonIcon icon={globeOutline} slot="start" style={{ color: '#60a5fa', fontSize: '20px', marginRight: '14px', flexShrink: 0 }} />
              <IonInput
                value={url}
                onIonInput={(e) => setUrl(e.detail.value ?? '')}
                placeholder="https://exemplo.com"
                style={{ '--color': '#fff', '--padding-start': '6px' }}
              />
            </IonItem>
          </div>

          {/* Chave de Autenticação 2FA / TOTP */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: '600', marginLeft: '4px' }}>
                Chave de 2FA / TOTP {canUseTOTP ? '(Opcional)' : ''}
              </span>
              {canUseTOTP ? (
                <span style={{ color: '#60a5fa', fontSize: '0.75rem', fontWeight: '600' }}>
                  Gera códigos de 6 dígitos
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => openUpgradeModal('o Autenticador 2FA / TOTP Integrado', 'PRO')}
                  style={{
                    background: 'rgba(96, 165, 250, 0.15)',
                    border: '1px solid rgba(96, 165, 250, 0.4)',
                    borderRadius: '8px',
                    padding: '2px 8px',
                    color: '#60a5fa',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Disponível no Pro
                </button>
              )}
            </div>
            <div
              onClick={() => {
                if (!canUseTOTP) {
                  openUpgradeModal('o Autenticador 2FA / TOTP Integrado', 'PRO');
                }
              }}
              style={{ position: 'relative' }}
            >
              <IonItem
                lines="none"
                style={{
                  '--background': 'rgba(255,255,255,0.04)',
                  '--border-radius': '14px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  opacity: canUseTOTP ? 1 : 0.6,
                  padding: '2px 8px',
                }}
              >
                <IonIcon icon={qrCodeOutline} slot="start" style={{ color: '#60a5fa', fontSize: '20px', marginRight: '14px', flexShrink: 0 }} />
                <IonInput
                  value={totpSecret}
                  disabled={!canUseTOTP}
                  onIonInput={(e) => setTotpSecret(e.detail.value ?? '')}
                  placeholder={canUseTOTP ? 'Cole a chave Base32 ou URL otpauth://...' : 'Disponível no Plano Pro (Toque para desbloquear)'}
                  style={{ '--color': '#fff', '--padding-start': '6px' }}
                />
              </IonItem>
            </div>
          </div>

          {/* Notas Seguras */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: '600', marginLeft: '4px' }}>
              Notas e Observações Protegidas
            </span>
            <IonItem lines="none" style={{ '--background': 'rgba(255,255,255,0.04)', '--border-radius': '14px', border: '1px solid rgba(255,255,255,0.05)', padding: '2px 8px' }}>
              <IonIcon icon={documentTextOutline} slot="start" style={{ color: '#60a5fa', fontSize: '20px', marginRight: '14px', marginTop: '14px', flexShrink: 0 }} />
              <IonTextarea
                value={notes}
                onIonInput={(e) => setNotes(e.detail.value ?? '')}
                placeholder="Adicione chaves de recuperação, códigos adicionais ou anotações secretas..."
                rows={4}
                style={{ '--color': '#fff', '--padding-start': '6px', marginTop: '12px' }}
              />
            </IonItem>
          </div>

          {/* Botão de Ação */}
          <IonButton
            expand="block"
            onClick={handleSave}
            style={{
              marginTop: '16px',
              '--background': 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              '--border-radius': '14px',
              fontWeight: '700',
              height: '52px',
              letterSpacing: '0.03em',
              fontSize: '0.98rem',
            }}
          >
            <IonIcon icon={saveOutline} slot="start" style={{ marginRight: '12px', fontSize: '20px' }} />
            Salvar Credencial
          </IonButton>
        </div>

        {/* Modal do Gerador de Senhas Integrado */}
        <IonModal
          isOpen={showGenModal}
          onDidDismiss={() => setShowGenModal(false)}
          initialBreakpoint={0.75}
          breakpoints={[0, 0.75, 0.95]}
          style={{
            '--background': '#0c0d14',
            '--border-radius': '24px 24px 0 0',
          }}
        >
          <div style={{ padding: '16px', background: '#0c0d14', height: '100%', overflowY: 'auto' }}>
            <PasswordGenerator onSelectPassword={handleSelectGeneratedPassword} />
            <IonButton
              expand="block"
              color="light"
              onClick={() => setShowGenModal(false)}
              style={{ marginTop: '16px', '--border-radius': '14px', fontWeight: '600' }}
            >
              Cancelar
            </IonButton>
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
