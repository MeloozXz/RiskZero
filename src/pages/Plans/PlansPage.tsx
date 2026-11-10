import React, { useState } from 'react';
import {
  IonPage,
  IonContent,
  IonModal,
  IonToast,
} from '@ionic/react';
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  ShieldCheck,
  CreditCard,
  QrCode,
  Copy,
  X,
  Users,
  Layers,
} from 'lucide-react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PlanTier, BillingCycle } from '../../types';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { PageHeader } from '../../components/ui/PageHeader';
import { ClipboardService } from '../../services/clipboard';
import './PlansPage.css';

const COMPARISON_ROWS = [
  {
    feature: 'Credenciais Criptografadas (Argon2id + AES-256-GCM)',
    free: 'Ilimitadas',
    pro: 'Ilimitadas',
    ultra: 'Ilimitadas',
  },
  {
    feature: 'Dispositivos Conectados Simultaneamente',
    free: '1 aparelho',
    pro: 'Até 5 aparelhos',
    ultra: 'Ilimitados',
  },
  {
    feature: 'Autenticador 2FA / TOTP Integrado',
    free: false,
    pro: true,
    ultra: true,
  },
  {
    feature: 'Monitoramento Dark Web (Have I Been Pwned)',
    free: 'Manual',
    pro: 'Diário Automático',
    ultra: 'Tempo Real',
  },
  {
    feature: 'Armazenamento Seguro de Anexos e Chaves',
    free: '—',
    pro: '1 GB cifrado',
    ultra: '10 GB cifrados',
  },
  {
    feature: 'PIN Duplo de Pânico & Modo Camuflagem',
    free: false,
    pro: false,
    ultra: true,
  },
  {
    feature: 'Membros Familiares com Cofres Isolados',
    free: '1 titular',
    pro: '1 titular',
    ultra: 'Até 6 membros',
  },
];

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
  const [showCancelSubConfirm, setShowCancelSubConfirm] = useState<boolean>(false);

  const handleOpenCheckout = (targetTier: PlanTier) => {
    setSelectedTier(targetTier);
    setShowCheckoutModal(true);
  };

  const handleConfirmPayment = async () => {
    setIsProcessing(true);
    try {
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
    <IonPage className="rz-page plans-page">
      <IonContent className="rz-content plans-content">
        <div className="rz-container">
          <PageHeader
            eyebrow="Licenciamento"
            title="Planos & Assinatura"
            subtitle="Criptografia Zero-Knowledge, autenticador 2FA integrado e proteção de nível institucional para você e sua família."
            actions={
              <div className="cycle-toggle-wrapper" role="group" aria-label="Ciclo de cobrança">
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
            }
          />

          {/* GRADE DE 3 PLANOS */}
          <div className="rz-plans-grid">
            {/* CARD 1: FREE */}
            <article className="plan-card plan-card-free">
              <div>
                <div className="plan-top-row">
                  <span className="plan-tier-name">Free</span>
                  {isCurrentTier('FREE') ? (
                    <span className="rz-badge rz-badge-neutral">Plano Atual</span>
                  ) : (
                    <span className="rz-badge rz-badge-neutral">Essencial</span>
                  )}
                </div>
                <p className="plan-target-desc">
                  Para uso pessoal básico no seu dispositivo principal.
                </p>

                <div className="price-row">
                  <span className="price-currency">R$</span>
                  <span className="price-value">0</span>
                  <span className="price-period">/ para sempre</span>
                </div>

                <div className="features-list">
                  <div className="feature-item">
                    <CheckCircle2 className="feature-icon" style={{ color: 'var(--rz-success)' }} />
                    <span>
                      <strong>Senhas Ilimitadas</strong> no cofre
                    </span>
                  </div>
                  <div className="feature-item">
                    <CheckCircle2 className="feature-icon" style={{ color: 'var(--rz-success)' }} />
                    <span>Criptografia Argon2id + AES-256</span>
                  </div>
                  <div className="feature-item">
                    <CheckCircle2 className="feature-icon" style={{ color: 'var(--rz-success)' }} />
                    <span>1 Dispositivo ativo</span>
                  </div>
                  <div className="feature-item">
                    <CheckCircle2 className="feature-icon" style={{ color: 'var(--rz-success)' }} />
                    <span>Importação e Exportação CSV</span>
                  </div>
                  <div className="feature-item is-muted">
                    <XCircle className="feature-icon" style={{ color: 'var(--rz-text-muted)' }} />
                    <span>Sem Gerador de Códigos 2FA/TOTP</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={isCurrentTier('FREE')}
                className="rz-btn rz-btn-secondary rz-btn-block"
              >
                <span>{isCurrentTier('FREE') ? 'Plano Ativo' : 'Plano Gratuito'}</span>
              </button>
            </article>

            {/* CARD 2: PRO */}
            <article className="plan-card plan-card-pro">
              <span className="card-ribbon ribbon-pro">Mais escolhido</span>

              <div>
                <div className="plan-top-row">
                  <span className="plan-tier-name" style={{ color: 'var(--rz-ice)' }}>
                    Pro
                  </span>
                  {isCurrentTier('PRO') ? (
                    <span className="rz-badge rz-badge-info">Plano ativo</span>
                  ) : (
                    <span className="rz-badge rz-badge-info">Recomendado</span>
                  )}
                </div>
                <p className="plan-target-desc">
                  Para quem busca conveniência, 2FA integrado e múltiplos aparelhos.
                </p>

                <div className="price-row">
                  <span className="price-currency">R$</span>
                  <span className="price-value" style={{ color: 'var(--rz-ice)' }}>
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
                    <CheckCircle2 className="feature-icon" style={{ color: 'var(--rz-accent-light)' }} />
                    <span>
                      <strong>Autenticador 2FA / TOTP Ilimitado</strong>
                    </span>
                  </div>
                  <div className="feature-item">
                    <CheckCircle2 className="feature-icon" style={{ color: 'var(--rz-accent-light)' }} />
                    <span>
                      Até <strong>5 Dispositivos Conectados</strong>
                    </span>
                  </div>
                  <div className="feature-item">
                    <CheckCircle2 className="feature-icon" style={{ color: 'var(--rz-accent-light)' }} />
                    <span>Monitoramento Automático Diário Dark Web</span>
                  </div>
                  <div className="feature-item">
                    <CheckCircle2 className="feature-icon" style={{ color: 'var(--rz-accent-light)' }} />
                    <span>1 GB de Anexos e Arquivos Protegidos</span>
                  </div>
                  <div className="feature-item">
                    <CheckCircle2 className="feature-icon" style={{ color: 'var(--rz-accent-light)' }} />
                    <span>Suporte Prioritário 24/7</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenCheckout('PRO')}
                disabled={isCurrentTier('PRO')}
                className="rz-btn rz-btn-primary rz-btn-lg rz-btn-block"
              >
                <ShieldCheck size={16} />
                <span>{isCurrentTier('PRO') ? 'Plano atual' : 'Assinar Plano Pro'}</span>
              </button>
            </article>

            {/* CARD 3: ULTRA FAMILIAR */}
            <article className="plan-card plan-card-ultra rz-panel-premium">
              <span className="card-ribbon ribbon-ultra">Mais completo</span>

              <div>
                <div className="plan-top-row">
                  <span className="plan-tier-name" style={{ color: 'var(--rz-violet)' }}>
                    Ultra Familiar
                  </span>
                  {isCurrentTier('ULTRA') ? (
                    <span className="rz-badge rz-badge-violet">Plano ativo</span>
                  ) : (
                    <span className="rz-badge rz-badge-violet">
                      <Sparkles size={12} /> Blindagem Máxima
                    </span>
                  )}
                </div>
                <p className="plan-target-desc">
                  Proteção absoluta para você e até 6 membros da sua família.
                </p>

                <div className="price-row">
                  <span className="price-currency">R$</span>
                  <span className="price-value" style={{ color: 'var(--rz-violet)' }}>
                    {cycle === 'ANNUAL' ? pricing.ULTRA.annualMonthlyEquiv : pricing.ULTRA.monthly}
                  </span>
                  <span className="price-period">/ mês</span>
                </div>
                {cycle === 'ANNUAL' && (
                  <div className="price-billing-detail" style={{ color: 'var(--rz-ice)' }}>
                    Faturado anualmente por R$ {pricing.ULTRA.annualTotal} (Apenas R$ 2,08/membro)
                  </div>
                )}

                <div className="features-list">
                  <div className="feature-item">
                    <CheckCircle2 className="feature-icon" style={{ color: 'var(--rz-violet)' }} />
                    <span>
                      <strong>Até 6 Membros Familiares</strong> (Cofres isolados)
                    </span>
                  </div>
                  <div className="feature-item">
                    <CheckCircle2 className="feature-icon" style={{ color: 'var(--rz-violet)' }} />
                    <span>
                      <strong>Dispositivos Ilimitados</strong>
                    </span>
                  </div>
                  <div className="feature-item">
                    <CheckCircle2 className="feature-icon" style={{ color: 'var(--rz-violet)' }} />
                    <span>PIN Duplo de Pânico &amp; Modo Camuflagem</span>
                  </div>
                  <div className="feature-item">
                    <CheckCircle2 className="feature-icon" style={{ color: 'var(--rz-violet)' }} />
                    <span>10 GB de Armazenamento Seguro</span>
                  </div>
                  <div className="feature-item">
                    <CheckCircle2 className="feature-icon" style={{ color: 'var(--rz-violet)' }} />
                    <span>Alertas em Tempo Real de Vazamentos</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenCheckout('ULTRA')}
                disabled={isCurrentTier('ULTRA')}
                className="rz-btn rz-btn-premium rz-btn-lg rz-btn-block"
              >
                <Users size={16} />
                <span>{isCurrentTier('ULTRA') ? 'Plano atual' : 'Assinar Plano Ultra'}</span>
              </button>
            </article>
          </div>

          {/* TABELA DE COMPARAÇÃO DE RECURSOS */}
          <section className="rz-section">
            <div className="rz-section-head">
              <h2 className="rz-section-title">
                <Layers size={16} />
                Comparativo de Capacidades &amp; Infraestrutura
              </h2>
            </div>

            <div className="rz-compare-wrap">
              <table className="rz-compare-table">
                <thead>
                  <tr>
                    <th>Recurso / Camada de Defesa</th>
                    <th>Free</th>
                    <th style={{ color: 'var(--rz-ice)' }}>Pro</th>
                    <th style={{ color: 'var(--rz-violet)' }}>Ultra Familiar</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.feature}>
                      <td style={{ fontWeight: 600, color: 'var(--rz-text-primary)' }}>
                        {row.feature}
                      </td>
                      <td>
                        {typeof row.free === 'boolean' ? (
                          row.free ? (
                            <CheckCircle2 size={16} style={{ color: 'var(--rz-success)' }} />
                          ) : (
                            <XCircle size={16} style={{ color: 'var(--rz-text-muted)' }} />
                          )
                        ) : (
                          <span style={{ color: 'var(--rz-text-secondary)' }}>{row.free}</span>
                        )}
                      </td>
                      <td>
                        {typeof row.pro === 'boolean' ? (
                          row.pro ? (
                            <CheckCircle2 size={16} style={{ color: 'var(--rz-accent-light)' }} />
                          ) : (
                            <XCircle size={16} style={{ color: 'var(--rz-text-muted)' }} />
                          )
                        ) : (
                          <span style={{ color: 'var(--rz-ice)', fontWeight: 700 }}>{row.pro}</span>
                        )}
                      </td>
                      <td>
                        {typeof row.ultra === 'boolean' ? (
                          row.ultra ? (
                            <CheckCircle2 size={16} style={{ color: 'var(--rz-violet)' }} />
                          ) : (
                            <XCircle size={16} style={{ color: 'var(--rz-text-muted)' }} />
                          )
                        ) : (
                          <span className="rz-badge rz-badge-violet">{row.ultra}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Botão de Cancelamento de Renovação (Se tiver plano ativo) */}
          {subscription?.autoRenew && tier !== 'FREE' && (
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button
                type="button"
                className="rz-btn rz-btn-ghost"
                onClick={() => setShowCancelSubConfirm(true)}
              >
                Cancelar Renovação Automática
              </button>
            </div>
          )}
        </div>

        {/* MODAL DE CHECKOUT SIMULADO */}
        <IonModal
          isOpen={showCheckoutModal}
          onDidDismiss={() => setShowCheckoutModal(false)}
          className="rz-dialog"
        >
          <div className="rz-dialog-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div>
                <span className={`rz-badge ${selectedTier === 'ULTRA' ? 'rz-badge-violet' : 'rz-badge-info'}`}>
                  Checkout Seguro
                </span>
                <h3 className="rz-dialog-title" style={{ marginTop: '8px' }}>
                  Assinar Plano {selectedTier} ({cycle === 'ANNUAL' ? 'Anual' : 'Mensal'})
                </h3>
                <div
                  className="rz-num"
                  style={{ color: 'var(--rz-success)', fontWeight: 700, fontSize: '1.25rem' }}
                >
                  Total: R$ {currentPrice}
                </div>
              </div>
              <button
                type="button"
                className="rz-icon-btn is-bordered"
                onClick={() => setShowCheckoutModal(false)}
                aria-label="Fechar checkout"
              >
                <X size={18} />
              </button>
            </div>

            {/* Seletor Método de Pagamento */}
            <div className="rz-checkout-methods">
              <button
                type="button"
                onClick={() => setPaymentMethod('PIX')}
                className={`rz-method-btn ${
                  paymentMethod === 'PIX'
                    ? selectedTier === 'ULTRA'
                      ? 'is-active-violet'
                      : 'is-active'
                    : ''
                }`}
              >
                <QrCode size={16} />
                <span>PIX Instantâneo</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('CREDIT_CARD')}
                className={`rz-method-btn ${
                  paymentMethod === 'CREDIT_CARD'
                    ? selectedTier === 'ULTRA'
                      ? 'is-active-violet'
                      : 'is-active'
                    : ''
                }`}
              >
                <CreditCard size={16} />
                <span>Cartão de Crédito</span>
              </button>
            </div>

            {/* Conteúdo PIX */}
            {paymentMethod === 'PIX' ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '18px',
                }}
              >
                <div className="rz-qr-frame">
                  <svg width="136" height="136" viewBox="0 0 100 100" fill="var(--rz-bg-base)">
                    <rect width="30" height="30" x="10" y="10" />
                    <rect width="20" height="20" x="15" y="15" fill="var(--rz-text-on-accent)" />
                    <rect width="10" height="10" x="20" y="20" />
                    <rect width="30" height="30" x="60" y="10" />
                    <rect width="20" height="20" x="65" y="15" fill="var(--rz-text-on-accent)" />
                    <rect width="10" height="10" x="70" y="20" />
                    <rect width="30" height="30" x="10" y="60" />
                    <rect width="20" height="20" x="15" y="65" fill="var(--rz-text-on-accent)" />
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

                <span className="rz-text-muted" style={{ fontSize: 'var(--rz-text-xs)', textAlign: 'center' }}>
                  Escaneie com o app do seu banco ou copie o código abaixo:
                </span>

                <div className="rz-input-group" style={{ width: '100%' }}>
                  <span
                    className="rz-font-mono rz-truncate"
                    style={{
                      flex: 1,
                      fontSize: 'var(--rz-text-xs)',
                      color: 'var(--rz-text-primary)',
                    }}
                  >
                    {mockPixKey}
                  </span>
                  <button
                    type="button"
                    className="rz-icon-btn"
                    onClick={() => copyPixKey(mockPixKey)}
                    aria-label="Copiar chave PIX"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>
            ) : (
              /* Conteúdo Cartão de Crédito */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
                <div className="rz-input-group">
                  <CreditCard size={17} />
                  <input
                    className="rz-input is-mono"
                    placeholder="Número do Cartão"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div className="rz-input-group" style={{ flex: 1 }}>
                    <input
                      className="rz-input is-mono"
                      placeholder="MM/AA"
                      value={cardExp}
                      onChange={(e) => setCardExp(e.target.value)}
                    />
                  </div>
                  <div className="rz-input-group" style={{ flex: 1 }}>
                    <input
                      className="rz-input is-mono"
                      placeholder="CVV"
                      type="password"
                      maxLength={4}
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                    />
                  </div>
                </div>
                <div className="rz-input-group">
                  <input
                    className="rz-input"
                    placeholder="Nome no Cartão"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Botão de Confirmação */}
            <button
              type="button"
              onClick={handleConfirmPayment}
              disabled={isProcessing}
              className={`rz-btn rz-btn-lg rz-btn-block ${
                selectedTier === 'ULTRA' ? 'rz-btn-premium' : 'rz-btn-primary'
              }`}
            >
              <span>
                {isProcessing ? 'Processando Ativação...' : `Confirmar assinatura ${selectedTier}`}
              </span>
            </button>
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

        <ConfirmModal
          isOpen={showCancelSubConfirm}
          title="Cancelar Renovação Automática?"
          message="Você continuará com todos os benefícios do seu plano ativo até o término do ciclo atual de cobrança."
          confirmText="Confirmar Cancelamento"
          cancelText="Voltar"
          variant="warning"
          onConfirm={async () => {
            setShowCancelSubConfirm(false);
            await cancelSubscription();
            setToastMsg('Renovação automática cancelada.');
            setShowToast(true);
          }}
          onCancel={() => setShowCancelSubConfirm(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default PlansPage;
