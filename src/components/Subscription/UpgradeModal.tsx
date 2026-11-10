import React from 'react';
import { IonModal } from '@ionic/react';
import {
  Sparkles,
  ShieldCheck,
  X,
  ArrowRight,
  Lock,
} from 'lucide-react';
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
      className="rz-dialog"
    >
      <div
        className={`rz-dialog-body ${isUltraReq ? 'rz-panel-premium' : 'rz-panel-accent'}`}
        style={{ border: 0, borderRadius: 'inherit' }}
      >
        {/* Top Row: Icon + Badge + Close */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className={`rz-icon-tile lg ${isUltraReq ? 'violet' : ''}`}>
              {isUltraReq ? <Lock /> : <Sparkles />}
            </div>
            <div>
              <span className={`rz-badge ${isUltraReq ? 'rz-badge-violet' : 'rz-badge-info'}`}>
                Recurso {isUltraReq ? 'Ultra' : 'Pro'}
              </span>
              <h2 className="rz-dialog-title" style={{ marginTop: '6px', marginBottom: 0 }}>
                Desbloqueie {modalFeatureName}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={closeUpgradeModal}
            className="rz-icon-btn is-bordered"
            aria-label="Fechar modal de upgrade"
          >
            <X size={18} />
          </button>
        </div>

        <p className="rz-dialog-text" style={{ marginBottom: '16px' }}>
          Eleve sua segurança digital com o plano {isUltraReq ? 'Ultra' : 'Pro'} a partir de apenas{' '}
          <strong style={{ color: 'var(--rz-text-primary)' }}>
            {isUltraReq ? 'R$ 12,49/mês' : 'R$ 5,82/mês'}
          </strong>{' '}
          no plano anual.
        </p>

        {/* Lista de Vantagens */}
        <div
          style={{
            background: 'var(--rz-bg-deep)',
            border: '1px solid var(--rz-border)',
            borderRadius: 'var(--rz-radius-sm)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            marginBottom: '20px',
          }}
        >
          {[
            isUltraReq
              ? 'Até 6 Membros Familiares com cofres isolados'
              : 'Até 5 Dispositivos Conectados simultaneamente',
            'Autenticador 2FA / TOTP integrado em todas as credenciais',
            isUltraReq
              ? 'PIN Duplo de Pânico & Modo Camuflagem'
              : 'Monitoramento Diário de Vazamentos Dark Web',
            isUltraReq
              ? '10 GB de Armazenamento Seguro para Documentos'
              : '1 GB de Arquivos e Anexos Protegidos',
          ].map((benefit, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck
                size={17}
                style={{
                  color: isUltraReq ? 'var(--rz-violet)' : 'var(--rz-success)',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 'var(--rz-text-sm)',
                  color: 'var(--rz-text-primary)',
                  fontWeight: 600,
                }}
              >
                {benefit}
              </span>
            </div>
          ))}
        </div>

        {/* Botões de Ação */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            onClick={handleGoToPlans}
            className={`rz-btn rz-btn-lg rz-btn-block ${
              isUltraReq ? 'rz-btn-premium' : 'rz-btn-primary'
            }`}
          >
            <span>Ver Planos &amp; Fazer Upgrade</span>
            <ArrowRight size={16} />
          </button>

          <button
            type="button"
            onClick={closeUpgradeModal}
            className="rz-btn rz-btn-ghost rz-btn-block"
          >
            <span>Continuar com o plano gratuito</span>
          </button>
        </div>
      </div>
    </IonModal>
  );
};

export default UpgradeModal;
