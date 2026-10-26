import React from 'react';
import {
  IonModal,
  IonButton,
  IonIcon,
} from '@ionic/react';
import {
  sparklesOutline,
  shieldCheckmarkOutline,
  closeOutline,
  arrowForwardOutline,
  lockClosedOutline,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { useSubscription } from '../../contexts/SubscriptionContext';

export const UpgradeModal: React.FC = () => {
  const history = useHistory();
  const { isUpgradeModalOpen, modalFeatureName, modalMinTier, closeUpgradeModal } = useSubscription();

  const isUltraReq = modalMinTier === 'ULTRA';

  const handleGoToPlans = () => {
    closeUpgradeModal();
    history.push('/plans');
  };

  return (
    <IonModal
      isOpen={isUpgradeModalOpen}
      onDidDismiss={closeUpgradeModal}
      style={{
        '--background': 'rgba(10, 15, 30, 0.95)',
        '--border-radius': '24px',
        '--width': '92%',
        '--max-width': '460px',
        '--height': 'fit-content',
      }}
    >
      <div style={{
        padding: '24px',
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(7, 10, 19, 0.98) 100%)',
        border: isUltraReq ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(96, 165, 250, 0.4)',
        borderRadius: '24px',
        boxShadow: isUltraReq ? '0 0 40px rgba(168, 85, 247, 0.2)' : '0 0 40px rgba(96, 165, 250, 0.2)',
        color: '#f8fafc',
        position: 'relative',
      }}>
        {/* Botão Fechar */}
        <button
          onClick={closeUpgradeModal}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            cursor: 'pointer',
          }}
        >
          <IonIcon icon={closeOutline} style={{ fontSize: '20px' }} />
        </button>

        {/* Header com Ícone Pulsante */}
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <div style={{
            display: 'inline-flex',
            padding: '14px',
            borderRadius: '20px',
            background: isUltraReq ? 'rgba(168, 85, 247, 0.15)' : 'rgba(96, 165, 250, 0.15)',
            border: isUltraReq ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(96, 165, 250, 0.3)',
            marginBottom: '14px',
          }}>
            <IonIcon
              icon={isUltraReq ? lockClosedOutline : sparklesOutline}
              style={{
                color: isUltraReq ? '#c084fc' : '#60a5fa',
                fontSize: '32px',
              }}
            />
          </div>

          <span style={{
            display: 'inline-block',
            fontSize: '0.75rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            padding: '4px 12px',
            borderRadius: '12px',
            background: isUltraReq ? 'rgba(168, 85, 247, 0.2)' : 'rgba(96, 165, 250, 0.2)',
            color: isUltraReq ? '#e9d5ff' : '#60a5fa',
            marginBottom: '8px',
          }}>
            Recurso {isUltraReq ? 'Ultra' : 'Pro'}
          </span>

          <h2 style={{
            margin: '4px 0 8px 0',
            fontSize: '1.4rem',
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-0.5px',
          }}>
            Desbloqueie {modalFeatureName}
          </h2>

          <p style={{
            margin: '0 0 18px 0',
            fontSize: '0.9rem',
            color: '#94a3b8',
            lineHeight: '1.4',
          }}>
            Eleve sua segurança digital com o plano {isUltraReq ? 'Ultra' : 'Pro'} a partir de apenas{' '}
            <strong style={{ color: '#ffffff' }}>{isUltraReq ? 'R$ 12,49/mês' : 'R$ 5,82/mês'}</strong> no plano anual.
          </p>
        </div>

        {/* Lista de Vantagens */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          marginBottom: '20px',
        }}>
          {[
            isUltraReq ? 'Até 6 Membros Familiares com cofres isolados' : 'Até 5 Dispositivos Conectados simultaneamente',
            'Autenticador 2FA / TOTP integrado em todas as credenciais',
            isUltraReq ? 'PIN Duplo de Pânico & Modo Camuflagem' : 'Monitoramento Diário de Vazamentos Dark Web',
            isUltraReq ? '10 GB de Armazenamento Seguro para Documentos' : '1 GB de Arquivos e Anexos Protegidos',
          ].map((benefit, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <IonIcon
                icon={shieldCheckmarkOutline}
                style={{ color: isUltraReq ? '#c084fc' : '#10b981', fontSize: '18px', flexShrink: 0 }}
              />
              <span style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 500 }}>
                {benefit}
              </span>
            </div>
          ))}
        </div>

        {/* Botão de Ação */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <IonButton
            expand="block"
            onClick={handleGoToPlans}
            style={{
              '--background': isUltraReq
                ? 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)'
                : 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
              '--color': isUltraReq ? '#ffffff' : '#000000',
              '--border-radius': '14px',
              fontWeight: 800,
              height: '48px',
              fontSize: '0.95rem',
            }}
          >
            Ver Planos & Fazer Upgrade
            <IonIcon slot="end" icon={arrowForwardOutline} />
          </IonButton>

          <IonButton
            expand="block"
            fill="clear"
            onClick={closeUpgradeModal}
            style={{
              '--color': '#94a3b8',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            Continuar com o plano gratuito
          </IonButton>
        </div>
      </div>
    </IonModal>
  );
};
