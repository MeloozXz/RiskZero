import React, { useState } from 'react';
import { IonIcon, IonSpinner } from '@ionic/react';
import {
  shieldCheckmarkOutline,
  lockClosedOutline,
  documentTextOutline,
  checkmarkCircleOutline,
  eyeOffOutline,
  wifiOutline,
  warningOutline
} from 'ionicons/icons';
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

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#070a13',
      overflowY: 'auto',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '0 0 40px 0'
    }}>
      {/* Header fixo */}
      <div style={{
        width: '100%',
        background: '#070a13',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <IonIcon icon={shieldCheckmarkOutline} style={{ color: '#00f2fe', fontSize: '22px' }} />
        <span style={{ color: '#00f2fe', fontSize: '1.1rem', fontWeight: 800 }}>
          Termos de Segurança &amp; Privacidade
        </span>
      </div>

      <div style={{ maxWidth: '560px', width: '100%', padding: '20px 16px' }}>

        {/* Banner */}
        <div style={{
          background: 'rgba(0, 242, 254, 0.05)',
          border: '1px solid rgba(0, 242, 254, 0.2)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          <IonIcon icon={lockClosedOutline} style={{ color: '#00f2fe', fontSize: '36px', display: 'block', margin: '0 auto 12px' }} />
          <h2 style={{ color: '#f1f5f9', fontSize: '1.2rem', fontWeight: 800, margin: '0 0 8px' }}>
            Compromisso com a Sua Privacidade
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>
            Leia atentamente antes de prosseguir.
          </p>
          <span style={{
            display: 'inline-block',
            marginTop: '12px',
            background: 'rgba(99, 102, 241, 0.2)',
            color: '#818cf8',
            borderRadius: '20px',
            padding: '4px 14px',
            fontSize: '0.75rem',
            fontWeight: 700
          }}>
            ✓ Versão 1.0 — Proteção Criptográfica
          </span>
        </div>

        {/* Cláusulas */}
        {[
          { icon: lockClosedOutline, color: '#00f2fe', title: '1. Arquitetura Zero-Knowledge e Criptografia Local', text: 'Todas as senhas e informações confidenciais cadastradas neste aplicativo são cifradas diretamente no seu dispositivo móvel antes de qualquer sincronização. Nossas chaves de criptografia são derivadas exclusivamente da sua Senha Mestra e nunca são enviadas aos nossos servidores sem cifragem de grau militar.' },
          { icon: eyeOffOutline, color: '#818cf8', title: '2. Irrecuperabilidade da Senha Mestra', text: 'Por motivos estritos de segurança e privacidade, a sua Senha Mestra não é armazenada em texto claro nem recuperável por nossa equipe. Caso você a esqueça sem backup ativo, o acesso aos seus dados será permanentemente impossibilitado.' },
          { icon: wifiOutline, color: '#10b981', title: '3. Serviço de VPN Nativa e Túnel Criptografado', text: 'O recurso de VPN utiliza tunelamento criptografado para proteger sua conexão de rede contra interceptações (MITM) e redes Wi-Fi públicas inseguras. Não realizamos registros de logs de navegação (*No-Logs Policy*).' },
          { icon: documentTextOutline, color: '#f59e0b', title: '4. Módulo de Vazamento de Dados (k-Anonymity)', text: 'A consulta de vazamento de credenciais é realizada com a técnica de anonimização por prefixo de hash (k-Anonymity SHA-1). Nenhuma senha ou e-mail bruto é exposto durante a verificação.' },
        ].map((clause, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <IonIcon icon={clause.icon} style={{ color: clause.color, fontSize: '18px', flexShrink: 0 }} />
              <strong style={{ color: '#f1f5f9', fontSize: '0.85rem' }}>{clause.title}</strong>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: '1.6', margin: 0 }}>{clause.text}</p>
          </div>
        ))}

        {/* Checkbox */}
        <div style={{
          background: 'rgba(0, 242, 254, 0.05)',
          border: '1px solid rgba(0, 242, 254, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          margin: '24px 0 20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          cursor: 'pointer'
        }} onClick={() => setIsChecked(!isChecked)}>
          <div style={{
            width: '22px',
            height: '22px',
            borderRadius: '6px',
            border: `2px solid ${isChecked ? '#00f2fe' : '#475569'}`,
            background: isChecked ? '#00f2fe' : 'transparent',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}>
            {isChecked && <IonIcon icon={checkmarkCircleOutline} style={{ color: '#070a13', fontSize: '16px' }} />}
          </div>
          <span style={{ color: '#e2e8f0', fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.5 }}>
            Li, compreendi e concordo com os Termos de Uso e Política de Segurança e Criptografia.
          </span>
        </div>

        {/* Aviso */}
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '10px',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          marginBottom: '20px'
        }}>
          <IonIcon icon={warningOutline} style={{ color: '#f59e0b', fontSize: '18px', flexShrink: 0, marginTop: '2px' }} />
          <p style={{ color: '#fcd34d', fontSize: '0.75rem', margin: 0, lineHeight: 1.5 }}>
            <strong>Atenção:</strong> Não é possível usar o aplicativo sem aceitar os termos acima.
          </p>
        </div>

        {/* Botão */}
        <button
          disabled={!isChecked || submitting}
          onClick={handleConfirm}
          style={{
            width: '100%',
            height: '52px',
            borderRadius: '12px',
            border: 'none',
            background: isChecked ? 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)' : '#1e293b',
            color: isChecked ? '#070a13' : '#475569',
            fontSize: '1rem',
            fontWeight: 800,
            cursor: isChecked ? 'pointer' : 'not-allowed',
            transition: 'all 0.3s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          {submitting
            ? <><IonSpinner name="crescent" style={{ width: '20px', height: '20px' }} /> Registrando...</>
            : 'Aceitar e Continuar para o App'
          }
        </button>
      </div>
    </div>
  );
};
