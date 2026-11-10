import React, { useState } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCheckbox,
  IonItem,
  IonLabel,
  IonButtons
} from '@ionic/react';
import {
  ShieldCheck,
  Lock,
  FileText,
  CheckCircle2,
  EyeOff,
  Wifi,
  X
} from 'lucide-react';
import { RzMark } from '../brand';
import { StorageService } from '../../services/storage';

interface SecurityTermsModalProps {
  isOpen: boolean;
  userEmail: string;
  onAccept: () => void;
  canDismiss?: boolean;
  onClose?: () => void;
}

export const SecurityTermsModal: React.FC<SecurityTermsModalProps> = ({
  isOpen,
  userEmail,
  onAccept,
  canDismiss = false,
  onClose
}) => {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleScroll = (e: CustomEvent) => {
    const detail = e.detail;
    if (detail && detail.scrollTop) {
      if (detail.scrollTop > 100) {
        setHasScrolled(true);
      }
    }
  };

  const handleConfirm = async () => {
    if (!isChecked && !hasScrolled) return;
    setSubmitting(true);
    try {
      await StorageService.saveSecurityTermsAccepted(userEmail, 'v1.0');
      setSubmitting(false);
      onAccept();
    } catch (e) {
      console.error('Erro ao salvar aceite dos termos:', e);
      setSubmitting(false);
    }
  };

  const clauses = [
    {
      icon: Lock,
      tone: '',
      title: '1. Arquitetura Zero-Knowledge e Criptografia Local',
      text: 'Todas as senhas e informações confidenciais cadastradas neste aplicativo são cifradas diretamente no seu dispositivo móvel antes de qualquer sincronização. Nossas chaves de criptografia são derivadas exclusivamente da sua Senha Mestra e nunca são enviadas aos nossos servidores sem cifragem de grau militar.'
    },
    {
      icon: EyeOff,
      tone: 'violet',
      title: '2. Irrecuperabilidade da Senha Mestra',
      text: 'Por motivos estritos de segurança e privacidade, a sua Senha Mestra não é armazenada em texto claro nem recuperável por nossa equipe. Caso você esqueça a sua Senha Mestra e não possua um backup de chaves ou PIN ativo, o acesso aos seus dados cifrados será permanentemente impossibilitado.'
    },
    {
      icon: Wifi,
      tone: 'success',
      title: '3. Serviço de VPN Nativa e Túnel Criptografado',
      text: 'O recurso de VPN do aplicativo utiliza tunelamento criptografado (Android VpnService / iOS NetworkExtension) para proteger sua conexão de rede contra interceptações (MITM) e redes Wi-Fi públicas inseguras. Não realizamos registros de logs de navegação ou atividades do usuário (No-Logs Policy).'
    },
    {
      icon: FileText,
      tone: 'warning',
      title: '4. Módulo de Vazamento de Dados (k-Anonymity)',
      text: 'A consulta de vazamento de credenciais é realizada utilizando a técnica de anonimização por prefixo de hash (k-Anonymity SHA-1). Nenhuma senha ou e-mail bruto é exposto durante a verificação contra bases públicas de violações de dados.'
    }
  ];

  return (
    <IonModal
      isOpen={isOpen}
      backdropDismiss={canDismiss}
      canDismiss={canDismiss}
      onDidDismiss={onClose}
      style={{
        '--background': 'var(--rz-bg-base)',
        '--border-radius': 'var(--rz-radius-lg)'
      }}
    >
      <IonHeader>
        <IonToolbar
          style={{
            '--background': 'var(--rz-bg-elevated)',
            borderBottom: '1px solid var(--rz-border)'
          }}
        >
          <IonTitle>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck className="w-5 h-5" style={{ color: 'var(--rz-ice)' }} />
              <span>Termos de Segurança &amp; Privacidade</span>
            </span>
          </IonTitle>
          {canDismiss && onClose && (
            <IonButtons slot="end">
              <button type="button" onClick={onClose} className="rz-icon-btn" aria-label="Fechar">
                <X />
              </button>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>

      <IonContent
        scrollEvents={true}
        onIonScroll={handleScroll}
        className="ion-padding"
        style={{ '--background': 'var(--rz-bg-base)' }}
      >
        <div style={{ maxWidth: '580px', margin: '0 auto', padding: '8px 0 24px' }}>
          {/* Header Banner */}
          <div
            className="rz-panel rz-panel-accent rz-meridian-bg"
            style={{
              textAlign: 'center',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              padding: '24px 20px'
            }}
          >
            <RzMark size={38} />
            <h2
              style={{
                fontFamily: 'var(--rz-font-display)',
                fontSize: '1.5rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: 'var(--rz-text-primary)',
                margin: 0
              }}
            >
              Compromisso com a Sua Privacidade
            </h2>
            <p
              style={{
                fontSize: 'var(--rz-text-xs)',
                color: 'var(--rz-text-secondary)',
                margin: 0,
                maxWidth: '48ch',
                lineHeight: 1.5
              }}
            >
              Leia atentamente as nossas diretrizes de proteção cibernética, criptografia de ponta e arquitetura Zero-Knowledge antes de prosseguir.
            </p>
            <span className="rz-badge rz-badge-info" style={{ marginTop: '4px' }}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Versão 1.0 — Proteção Criptográfica</span>
            </span>
          </div>

          {/* Cláusulas dos Termos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {clauses.map((clause, idx) => {
              const IconComp = clause.icon;
              return (
                <div key={idx} className="rz-panel" style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <div className={`rz-icon-tile ${clause.tone}`}>
                      <IconComp />
                    </div>
                    <h3
                      style={{
                        fontSize: 'var(--rz-text-sm)',
                        fontWeight: 700,
                        color: 'var(--rz-text-primary)',
                        margin: 0
                      }}
                    >
                      {clause.title}
                    </h3>
                  </div>
                  <p
                    style={{
                      fontSize: 'var(--rz-text-xs)',
                      color: 'var(--rz-text-secondary)',
                      lineHeight: 1.6,
                      margin: 0
                    }}
                  >
                    {clause.text}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Checkbox de confirmação de leitura */}
          <div
            className="rz-panel"
            style={{
              marginTop: '20px',
              padding: '8px 12px',
              background: 'var(--rz-bg-deep)',
              borderColor: isChecked ? 'var(--rz-accent)' : 'var(--rz-border)'
            }}
          >
            <IonItem lines="none" style={{ '--background': 'transparent' }}>
              <IonCheckbox
                slot="start"
                checked={isChecked}
                onIonChange={(e) => setIsChecked(e.detail.checked)}
              />
              <IonLabel
                className="ion-text-wrap"
                style={{
                  fontSize: 'var(--rz-text-xs)',
                  color: 'var(--rz-text-primary)',
                  fontWeight: 600,
                  lineHeight: 1.45
                }}
              >
                Li, compreendi e concordo com os Termos de Uso e Política de Segurança e Criptografia.
              </IonLabel>
            </IonItem>
          </div>

          {/* Botão de Confirmação */}
          <div style={{ marginTop: '20px' }}>
            <button
              type="button"
              className="rz-btn rz-btn-primary rz-btn-lg rz-btn-block"
              disabled={(!isChecked && !hasScrolled) || submitting}
              onClick={handleConfirm}
            >
              {submitting ? 'Registrando Aceite...' : 'Aceitar e Continuar para o App'}
            </button>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
};
