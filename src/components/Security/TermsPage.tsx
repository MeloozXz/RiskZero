import React, { useState } from 'react';
import { IonSpinner } from '@ionic/react';
import {
  ShieldCheck,
  Lock,
  FileText,
  Check,
  EyeOff,
  Wifi,
  AlertTriangle
} from 'lucide-react';
import { Logo, RzMark } from '../brand';
import { StorageService } from '../../services/storage';

interface TermsPageProps {
  onAccept: () => void;
}

/**
 * Página completa de Termos — renderiza diretamente sem IonModal.
 * Bloqueia 100% do acesso ao app até o aceite.
 */
export const TermsPage: React.FC<TermsPageProps> = ({ onAccept }) => {
  const [isChecked, setIsChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!isChecked) return;
    setSubmitting(true);
    try {
      await StorageService.saveSecurityTermsAccepted('global', 'v1.0');
      onAccept();
    } catch (e) {
      console.error('Erro ao salvar aceite dos termos:', e);
    } finally {
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
      text: 'Por motivos estritos de segurança e privacidade, a sua Senha Mestra não é armazenada em texto claro nem recuperável por nossa equipe. Caso você a esqueça sem backup ativo, o acesso aos seus dados será permanentemente impossibilitado.'
    },
    {
      icon: Wifi,
      tone: 'success',
      title: '3. Serviço de VPN Nativa e Túnel Criptografado',
      text: 'O recurso de VPN utiliza tunelamento criptografado para proteger sua conexão de rede contra interceptações (MITM) e redes Wi-Fi públicas inseguras. Não realizamos registros de logs de navegação (No-Logs Policy).'
    },
    {
      icon: FileText,
      tone: 'warning',
      title: '4. Módulo de Vazamento de Dados (k-Anonymity)',
      text: 'A consulta de vazamento de credenciais é realizada com a técnica de anonimização por prefixo de hash (k-Anonymity SHA-1). Nenhuma senha ou e-mail bruto é exposto durante a verificação.'
    }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--rz-bg-base)',
        overflowY: 'auto',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingBottom: 'calc(40px + var(--rz-safe-bottom))'
      }}
    >
      {/* Header fixo */}
      <header
        style={{
          width: '100%',
          background: 'var(--rz-bg-elevated)',
          borderBottom: '1px solid var(--rz-border)',
          padding: 'calc(14px + var(--rz-safe-top)) 20px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck className="w-5 h-5" style={{ color: 'var(--rz-ice)' }} />
          <span
            style={{
              fontFamily: 'var(--rz-font-display)',
              color: 'var(--rz-text-primary)',
              fontSize: '1.15rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.03em'
            }}
          >
            Termos de Segurança &amp; Privacidade
          </span>
        </div>
        <Logo width={96} />
      </header>

      <div style={{ maxWidth: '580px', width: '100%', padding: '24px 16px' }}>
        {/* Banner */}
        <div
          className="rz-panel rz-panel-accent rz-meridian-bg"
          style={{
            padding: '24px 20px',
            marginBottom: '20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <RzMark size={40} />
          <h2
            style={{
              fontFamily: 'var(--rz-font-display)',
              color: 'var(--rz-text-primary)',
              fontSize: '1.5rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              margin: '4px 0 0'
            }}
          >
            Compromisso com a Sua Privacidade
          </h2>
          <p style={{ color: 'var(--rz-text-secondary)', fontSize: 'var(--rz-text-xs)', margin: 0 }}>
            Leia atentamente antes de prosseguir.
          </p>
          <span className="rz-badge rz-badge-info" style={{ marginTop: '6px' }}>
            Versão 1.0 — Termos de Serviço e Segurança
          </span>
        </div>

        {/* Cláusulas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {clauses.map((clause, i) => {
            const IconComp = clause.icon;
            return (
              <div key={i} className="rz-panel" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div className={`rz-icon-tile ${clause.tone}`}>
                    <IconComp />
                  </div>
                  <strong style={{ color: 'var(--rz-text-primary)', fontSize: 'var(--rz-text-sm)' }}>
                    {clause.title}
                  </strong>
                </div>
                <p
                  style={{
                    color: 'var(--rz-text-secondary)',
                    fontSize: 'var(--rz-text-xs)',
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

        {/* Checkbox */}
        <div
          role="checkbox"
          aria-checked={isChecked}
          tabIndex={0}
          onClick={() => setIsChecked(!isChecked)}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              setIsChecked(!isChecked);
            }
          }}
          className="rz-panel"
          style={{
            background: isChecked ? 'var(--rz-accent-soft)' : 'var(--rz-bg-deep)',
            borderColor: isChecked ? 'var(--rz-accent)' : 'var(--rz-border)',
            padding: '16px',
            margin: '20px 0 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <div
            style={{
              width: '22px',
              height: '22px',
              borderRadius: 'var(--rz-radius-xs)',
              border: `2px solid ${isChecked ? 'var(--rz-accent)' : 'var(--rz-border-strong)'}`,
              background: isChecked ? 'var(--rz-accent)' : 'transparent',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all var(--rz-dur-fast) var(--rz-ease)'
            }}
          >
            {isChecked && <Check className="w-3.5 h-3.5" style={{ color: 'var(--rz-text-on-accent)' }} />}
          </div>
          <span
            style={{
              color: 'var(--rz-text-primary)',
              fontSize: 'var(--rz-text-xs)',
              fontWeight: 600,
              lineHeight: 1.5
            }}
          >
            Li, compreendi e concordo com os Termos de Uso e Política de Segurança e Criptografia.
          </span>
        </div>

        {/* Aviso */}
        <div className="rz-alert rz-alert-warning" style={{ marginBottom: '20px' }}>
          <AlertTriangle />
          <p style={{ margin: 0, fontSize: 'var(--rz-text-xs)', lineHeight: 1.5 }}>
            <strong>Atenção:</strong> Não é possível usar o aplicativo sem aceitar os termos acima.
          </p>
        </div>

        {/* Botão */}
        <button
          type="button"
          disabled={!isChecked || submitting}
          onClick={handleConfirm}
          className="rz-btn rz-btn-primary rz-btn-lg rz-btn-block"
        >
          {submitting ? (
            <>
              <IonSpinner name="crescent" style={{ width: '18px', height: '18px' }} />
              <span>Registrando...</span>
            </>
          ) : (
            <span>Aceitar e Continuar para o App</span>
          )}
        </button>
      </div>
    </div>
  );
};
