import React, { useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonModal,
  IonInput,
  IonItem,
  IonToast,
} from '@ionic/react';
import {
  checkmarkCircle,
  closeCircle,
  sparklesOutline,
  shieldCheckmarkOutline,
  cardOutline,
  qrCodeOutline,
  copyOutline,
  closeOutline,
  lockClosedOutline,
  peopleOutline,
  timeOutline,
} from 'ionicons/icons';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PlanTier, BillingCycle } from '../../types';
import { ClipboardService } from '../../services/clipboard';
import './PlansPage.css';

export const PlansPage: React.FC = () => {
  const { tier, subscription, upgradePlan, cancelSubscription } = useSubscription();

  const [cycle, setCycle] = useState<BillingCycle>('ANNUAL');
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [selectedTier, setSelectedTier] = useState<PlanTier>('PRO');
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');

  // Estados do Formulário de Cartão
  const [cardNumber, setCardNumber] = useState<string>('');
  const [cardExp, setCardExp] = useState<string>('');
  const [cardCvv, setCardCvv] = useState<string>('');
  const [cardName, setCardName] = useState<string>('');

  // Estados de Feedback
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string>('');
  const [toastColor, setToastColor] = useState<string>('dark');

  const handleOpenCheckout = (targetTier: PlanTier) => {
    setSelectedTier(targetTier);
    setShowCheckoutModal(true);
  };

  const handleConfirmPayment = async () => {
    setIsProcessing(true);
    try {
      // Simula validação e tempo de resposta de gateway de pagamento
      await new Promise((r) => setTimeout(r, 1200));
      const success = await upgradePlan(selectedTier, cycle, paymentMethod);
      if (success) {
        setShowCheckoutModal(false);
        setToastMsg(`Pagamento confirmado. Seu plano ${selectedTier} já está ativo.`);
        setToastColor('success');
        setShowToast(true);
      } else {
        setToastMsg('Falha ao processar o pagamento. Tente novamente.');
        setToastColor('danger');
        setShowToast(true);
      }
    } catch {
      setToastMsg('Erro inesperado durante o processamento do pagamento.');
      setToastColor('danger');
      setShowToast(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyPixKey = async (pixKey: string) => {
    await ClipboardService.copySecure(pixKey, 'Chave PIX', (msg) => {
      setToastMsg(msg);
      setToastColor('dark');
      setShowToast(true);
    });
  };

  const isCurrentTier = (t: PlanTier) => tier === t;

  // Preços
  const pricing = {
    PRO: {
      monthly: '9,90',
      annualMonthlyEquiv: '5,82',
      annualTotal: '69,90',
    },
    ULTRA: {
      monthly: '19,90',
      annualMonthlyEquiv: '12,49',
      annualTotal: '149,90',
    },
  };

  const currentPrice =
    selectedTier === 'PRO'
      ? cycle === 'ANNUAL'
        ? pricing.PRO.annualTotal
        : pricing.PRO.monthly
      : cycle === 'ANNUAL'
      ? pricing.ULTRA.annualTotal
      : pricing.ULTRA.monthly;

  const mockPixKey = `00020126580014br.gov.bcb.pix0136riskzero-pay-${selectedTier.toLowerCase()}5204000053039865405${currentPrice.replace(',', '.')}5802BR5915RiskZero Ltda6009Sao Paulo62070503***6304`;

  return (
    <IonPage style={{ background: 'transparent' }}>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'transparent', '--color': '#e8ecf2' }}>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/settings" style={{ color: '#fff' }} />
          </IonButtons>
          <IonTitle style={{ fontWeight: '800' }}>Planos & Assinatura</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': 'transparent' }}>
        <div className="plans-container">

          {/* Cabeçalho */}
          <div className="plans-header">
            <span className="plans-badge">
              <IonIcon icon={sparklesOutline} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Proteção Sem Fronteiras
            </span>
            <h1 className="plans-title">Escolha o nível ideal de segurança</h1>
            <p className="plans-subtitle">
              Criptografia Zero-Knowledge, 2FA integrado e segurança total para você e sua família.
            </p>
          </div>

          {/* Toggle de Ciclo de Cobrança */}
          <div className="cycle-toggle-wrapper">
            <button
              type="button"
              className={`cycle-toggle-btn ${cycle === 'MONTHLY' ? 'active' : ''}`}
              onClick={() => setCycle('MONTHLY')}
            >
              Mensal
            </button>
            <button
              type="button"
              className={`cycle-toggle-btn ${cycle === 'ANNUAL' ? 'active' : ''}`}
              onClick={() => setCycle('ANNUAL')}
            >
              Anual <span className="discount-pill">-41% OFF</span>
            </button>
          </div>

          {/* CARD 1: FREE */}
          <div className="plan-card plan-card-free">
            <div className="plan-top-row">
              <span className="plan-tier-name">Free</span>
              {isCurrentTier('FREE') && (
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>
                  Plano Atual
                </span>
              )}
            </div>
            <p className="plan-target-desc">Para uso pessoal básico no seu dispositivo principal.</p>
            
            <div className="price-row">
              <span className="price-currency">R$</span>
              <span className="price-value">0</span>
              <span className="price-period">/ para sempre</span>
            </div>

            <div className="features-list">
              <div className="feature-item">
                <IonIcon icon={checkmarkCircle} className="feature-icon" style={{ color: '#10b981' }} />
                <span><strong>Senhas Ilimitadas</strong> no cofre</span>
              </div>
              <div className="feature-item">
                <IonIcon icon={checkmarkCircle} className="feature-icon" style={{ color: '#10b981' }} />
                <span>Criptografia Argon2id + AES-256</span>
              </div>
              <div className="feature-item">
                <IonIcon icon={checkmarkCircle} className="feature-icon" style={{ color: '#10b981' }} />
                <span>1 Dispositivo ativo</span>
              </div>
              <div className="feature-item">
                <IonIcon icon={checkmarkCircle} className="feature-icon" style={{ color: '#10b981' }} />
                <span>Importação e Exportação CSV</span>
              </div>
              <div className="feature-item">
                <IonIcon icon={closeCircle} className="feature-icon" style={{ color: '#64748b' }} />
                <span style={{ color: '#64748b' }}>Sem Gerador de Códigos 2FA/TOTP</span>
              </div>
            </div>

            <IonButton
              expand="block"
              fill="outline"
              disabled={isCurrentTier('FREE')}
              style={{
                '--border-color': 'rgba(255,255,255,0.15)',
                '--border-radius': '14px',
                color: '#94a3b8',
                fontWeight: 700,
              }}
            >
              {isCurrentTier('FREE') ? 'Plano Ativo' : 'Plano Gratuito'}
            </IonButton>
          </div>

          {/* CARD 2: PRO */}
          <div className="plan-card plan-card-pro">
            <span className="card-ribbon ribbon-pro">Mais escolhido</span>
            
            <div className="plan-top-row">
              <span className="plan-tier-name" style={{ color: '#60a5fa' }}>Pro</span>
              {isCurrentTier('PRO') && (
                <span style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 800 }}>
                  Plano ativo
                </span>
              )}
            </div>
            <p className="plan-target-desc">Para quem busca conveniência, 2FA integrado e múltiplos aparelhos.</p>
            
            <div className="price-row">
              <span className="price-currency">R$</span>
              <span className="price-value" style={{ color: '#60a5fa' }}>
                {cycle === 'ANNUAL' ? pricing.PRO.annualMonthlyEquiv : pricing.PRO.monthly}
              </span>
              <span className="price-period">/ mês</span>
            </div>
            {cycle === 'ANNUAL' && (
              <div className="price-billing-detail">
                Faturado anualmente por R$ {pricing.PRO.annualTotal}
              </div>
            )}

            <div className="features-list">
              <div className="feature-item">
                <IonIcon icon={checkmarkCircle} className="feature-icon" style={{ color: '#60a5fa' }} />
                <span><strong>Autenticador 2FA / TOTP Ilimitado</strong></span>
              </div>
              <div className="feature-item">
                <IonIcon icon={checkmarkCircle} className="feature-icon" style={{ color: '#60a5fa' }} />
                <span>Até <strong>5 Dispositivos Conectados</strong></span>
              </div>
              <div className="feature-item">
                <IonIcon icon={checkmarkCircle} className="feature-icon" style={{ color: '#60a5fa' }} />
                <span>Monitoramento Automático Diário Dark Web</span>
              </div>
              <div className="feature-item">
                <IonIcon icon={checkmarkCircle} className="feature-icon" style={{ color: '#60a5fa' }} />
                <span>1 GB de Anexos e Arquivos Protegidos</span>
              </div>
              <div className="feature-item">
                <IonIcon icon={checkmarkCircle} className="feature-icon" style={{ color: '#60a5fa' }} />
                <span>Suporte Prioritário 24/7</span>
              </div>
            </div>

            <IonButton
              expand="block"
              onClick={() => handleOpenCheckout('PRO')}
              disabled={isCurrentTier('PRO')}
              style={{
                '--background': 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
                '--color': '#000000',
                '--border-radius': '14px',
                fontWeight: 900,
                height: '48px',
              }}
            >
              {isCurrentTier('PRO') ? 'Plano atual' : 'Assinar Plano Pro'}
            </IonButton>
          </div>

          {/* CARD 3: ULTRA */}
          <div className="plan-card plan-card-ultra">
            <span className="card-ribbon ribbon-ultra">Mais completo</span>

            <div className="plan-top-row">
              <span className="plan-tier-name" style={{ color: '#c084fc' }}>Ultra Familiar</span>
              {isCurrentTier('ULTRA') && (
                <span style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: 800 }}>
                  Plano ativo
                </span>
              )}
            </div>
            <p className="plan-target-desc">Proteção absoluta para você e até 6 membros da sua família.</p>
            
            <div className="price-row">
              <span className="price-currency">R$</span>
              <span className="price-value" style={{ color: '#c084fc' }}>
                {cycle === 'ANNUAL' ? pricing.ULTRA.annualMonthlyEquiv : pricing.ULTRA.monthly}
              </span>
              <span className="price-period">/ mês</span>
            </div>
            {cycle === 'ANNUAL' && (
              <div className="price-billing-detail" style={{ color: '#c084fc' }}>
                Faturado anualmente por R$ {pricing.ULTRA.annualTotal} (Apenas R$ 2,08/membro)
              </div>
            )}

            <div className="features-list">
              <div className="feature-item">
                <IonIcon icon={checkmarkCircle} className="feature-icon" style={{ color: '#a855f7' }} />
                <span><strong>Até 6 Membros Familiares</strong> (Cofres isolados)</span>
              </div>
              <div className="feature-item">
                <IonIcon icon={checkmarkCircle} className="feature-icon" style={{ color: '#a855f7' }} />
                <span><strong>Dispositivos Ilimitados</strong></span>
              </div>
              <div className="feature-item">
                <IonIcon icon={checkmarkCircle} className="feature-icon" style={{ color: '#a855f7' }} />
                <span>PIN Duplo de Pânico & Modo Camuflagem</span>
              </div>
              <div className="feature-item">
                <IonIcon icon={checkmarkCircle} className="feature-icon" style={{ color: '#a855f7' }} />
                <span>10 GB de Armazenamento Seguro</span>
              </div>
              <div className="feature-item">
                <IonIcon icon={checkmarkCircle} className="feature-icon" style={{ color: '#a855f7' }} />
                <span>Alertas em Tempo Real de Vazamentos</span>
              </div>
            </div>

            <IonButton
              expand="block"
              onClick={() => handleOpenCheckout('ULTRA')}
              disabled={isCurrentTier('ULTRA')}
              style={{
                '--background': 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                '--color': '#ffffff',
                '--border-radius': '14px',
                fontWeight: 900,
                height: '48px',
              }}
            >
              {isCurrentTier('ULTRA') ? 'Plano atual' : 'Assinar Plano Ultra'}
            </IonButton>
          </div>

          {/* Botão de Cancelamento de Renovação (Se tiver plano ativo) */}
          {subscription?.autoRenew && tier !== 'FREE' && (
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <IonButton
                fill="clear"
                color="medium"
                onClick={async () => {
                  if (window.confirm('Deseja cancelar a renovação automática da assinatura? Você continuará com os benefícios até o fim do período.')) {
                    await cancelSubscription();
                    setToastMsg('Renovação automática cancelada.');
                    setShowToast(true);
                  }
                }}
                style={{ fontSize: '0.8rem' }}
              >
                Cancelar Renovação Automática
              </IonButton>
            </div>
          )}

        </div>

        {/* MODAL DE CHECKOUT SIMULADO */}
        <IonModal
          isOpen={showCheckoutModal}
          onDidDismiss={() => setShowCheckoutModal(false)}
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
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(7, 10, 19, 1) 100%)',
            border: selectedTier === 'ULTRA' ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(96, 165, 250, 0.4)',
            borderRadius: '24px',
            color: '#f8fafc',
            position: 'relative',
          }}>
            {/* Fechar */}
            <button
              onClick={() => setShowCheckoutModal(false)}
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

            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                padding: '4px 12px',
                borderRadius: '12px',
                background: selectedTier === 'ULTRA' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(96, 165, 250, 0.2)',
                color: selectedTier === 'ULTRA' ? '#e9d5ff' : '#60a5fa',
              }}>
                Checkout Seguro
              </span>
              <h3 style={{ margin: '8px 0 4px', fontWeight: 900, fontSize: '1.3rem' }}>
                Assinar Plano {selectedTier} ({cycle === 'ANNUAL' ? 'Anual' : 'Mensal'})
              </h3>
              <div style={{ color: '#10b981', fontWeight: 800, fontSize: '1.2rem', marginTop: '4px' }}>
                Total: R$ {currentPrice}
              </div>
            </div>

            {/* Seletor Método de Pagamento */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setPaymentMethod('PIX')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '12px',
                  border: paymentMethod === 'PIX' ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.1)',
                  background: paymentMethod === 'PIX' ? 'rgba(96, 165, 250, 0.15)' : 'rgba(255,255,255,0.04)',
                  color: paymentMethod === 'PIX' ? '#60a5fa' : '#94a3b8',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <IonIcon icon={qrCodeOutline} />
                PIX Instantâneo
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('CREDIT_CARD')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '12px',
                  border: paymentMethod === 'CREDIT_CARD' ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.1)',
                  background: paymentMethod === 'CREDIT_CARD' ? 'rgba(96, 165, 250, 0.15)' : 'rgba(255,255,255,0.04)',
                  color: paymentMethod === 'CREDIT_CARD' ? '#60a5fa' : '#94a3b8',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <IonIcon icon={cardOutline} />
                Cartão de Crédito
              </button>
            </div>

            {/* Conteúdo PIX */}
            {paymentMethod === 'PIX' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  padding: '12px',
                  background: '#ffffff',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {/* QR Code SVG Simulado */}
                  <svg width="140" height="140" viewBox="0 0 100 100" fill="#000000">
                    <rect width="30" height="30" x="10" y="10" />
                    <rect width="20" height="20" x="15" y="15" fill="#ffffff" />
                    <rect width="10" height="10" x="20" y="20" />
                    <rect width="30" height="30" x="60" y="10" />
                    <rect width="20" height="20" x="65" y="15" fill="#ffffff" />
                    <rect width="10" height="10" x="70" y="20" />
                    <rect width="30" height="30" x="10" y="60" />
                    <rect width="20" height="20" x="15" y="65" fill="#ffffff" />
                    <rect width="10" height="10" x="20" y="70" />
                    <rect width="10" height="10" x="45" y="15" />
                    <rect width="10" height="10" x="45" y="35" />
                    <rect width="10" height="10" x="45" y="55" />
                    <rect width="10" height="10" x="45" y="75" />
                    <rect width="10" height="10" x="65" y="45" />
                    <rect width="10" height="10" x="75" y="65" />
                    <rect width="10" height="10" x="85" y="85" />
                  </svg>
                </div>
                
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Escaneie com o app do seu banco ou copie o código abaixo:
                </span>

                <div style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}>
                  <span style={{
                    fontSize: '0.75rem',
                    color: '#e2e8f0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {mockPixKey}
                  </span>
                  <IonButton
                    size="small"
                    fill="clear"
                    onClick={() => copyPixKey(mockPixKey)}
                    style={{ '--color': '#60a5fa', margin: 0 }}
                  >
                    <IonIcon icon={copyOutline} slot="icon-only" />
                  </IonButton>
                </div>
              </div>
            ) : (
              /* Conteúdo Cartão de Crédito */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                <IonItem lines="none" style={{ '--background': 'rgba(20, 28, 45, 0.7)', '--border-radius': '12px' }}>
                  <IonInput
                    placeholder="Número do Cartão"
                    value={cardNumber}
                    onIonInput={(e) => setCardNumber(e.detail.value ?? '')}
                    style={{ '--color': '#fff' }}
                  />
                </IonItem>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <IonItem lines="none" style={{ flex: 1, '--background': 'rgba(20, 28, 45, 0.7)', '--border-radius': '12px' }}>
                    <IonInput
                      placeholder="MM/AA"
                      value={cardExp}
                      onIonInput={(e) => setCardExp(e.detail.value ?? '')}
                      style={{ '--color': '#fff' }}
                    />
                  </IonItem>
                  <IonItem lines="none" style={{ flex: 1, '--background': 'rgba(20, 28, 45, 0.7)', '--border-radius': '12px' }}>
                    <IonInput
                      placeholder="CVV"
                      type="password"
                      maxlength={4}
                      value={cardCvv}
                      onIonInput={(e) => setCardCvv(e.detail.value ?? '')}
                      style={{ '--color': '#fff' }}
                    />
                  </IonItem>
                </div>
                <IonItem lines="none" style={{ '--background': 'rgba(20, 28, 45, 0.7)', '--border-radius': '12px' }}>
                  <IonInput
                    placeholder="Nome no Cartão"
                    value={cardName}
                    onIonInput={(e) => setCardName(e.detail.value ?? '')}
                    style={{ '--color': '#fff' }}
                  />
                </IonItem>
              </div>
            )}

            {/* Botão de Confirmação */}
            <IonButton
              expand="block"
              onClick={handleConfirmPayment}
              disabled={isProcessing}
              style={{
                '--background': selectedTier === 'ULTRA'
                  ? 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)'
                  : 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
                '--color': selectedTier === 'ULTRA' ? '#ffffff' : '#000000',
                '--border-radius': '14px',
                fontWeight: 900,
                height: '48px',
              }}
            >
              {isProcessing ? 'Processando Ativação...' : `Confirmar assinatura ${selectedTier}`}
            </IonButton>
          </div>
        </IonModal>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          color={toastColor}
          duration={3000}
          position="top"
        />
      </IonContent>
    </IonPage>
  );
};
