import React, { useState } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonCheckbox,
  IonItem,
  IonLabel,
  IonBadge
} from '@ionic/react';
import {
  shieldCheckmarkOutline,
  lockClosedOutline,
  documentTextOutline,
  checkmarkCircleOutline,
  eyeOffOutline,
  wifiOutline
} from 'ionicons/icons';
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

  return (
    <IonModal isOpen={isOpen} backdropDismiss={false} canDismiss={false}>
      <IonHeader>
        <IonToolbar style={{ '--background': '#070a13', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <IonTitle style={{ color: '#00f2fe', fontSize: '1.1rem', fontWeight: 800 }}>
            <IonIcon icon={shieldCheckmarkOutline} style={{ verticalAlign: 'middle', marginRight: '8px', fontSize: '20px' }} />
            Termos de Segurança & Privacidade
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent scrollEvents={true} onIonScroll={handleScroll} className="ion-padding" style={{ '--background': '#070a13' }}>
        <div className="max-w-xl mx-auto py-2">
          
          {/* Header Banner */}
          <div className="glass-card p-5 mb-6 text-center border border-cyan-500/20 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
            <IonIcon icon={lockClosedOutline} className="text-4xl text-cyan-400 mb-2 drop-shadow-md" />
            <h2 className="text-xl font-extrabold text-slate-100">Compromisso com a Sua Privacidade</h2>
            <p className="text-xs text-slate-400 mt-1">
              Leia atentamente as nossas diretrizes de proteção cibernética, criptografia de ponta e arquitetura Zero-Knowledge antes de prosseguir.
            </p>
            <IonBadge color="primary" className="cyber-badge mt-3">
              <IonIcon icon={checkmarkCircleOutline} /> Versão 1.0 - Proteção Criptográfica
            </IonBadge>
          </div>

          {/* Cláusulas dos Termos */}
          <div className="space-y-4 text-sm text-slate-300">
            
            {/* Cláusula 1 */}
            <div className="glass-card p-4 rounded-xl border border-white/5">
              <div className="flex items-center gap-3 mb-2">
                <IonIcon icon={lockClosedOutline} className="text-cyan-400 text-lg" />
                <h3 className="font-bold text-slate-100">1. Arquitetura Zero-Knowledge e Criptografia Local</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Todas as senhas e informações confidenciais cadastradas neste aplicativo são cifradas diretamente no seu dispositivo móvel antes de qualquer sincronização. Nossas chaves de criptografia são derivadas exclusivamente da sua <strong>Senha Mestra</strong> e nunca são enviadas aos nossos servidores sem cifragem de grau militar.
              </p>
            </div>

            {/* Cláusula 2 */}
            <div className="glass-card p-4 rounded-xl border border-white/5">
              <div className="flex items-center gap-3 mb-2">
                <IonIcon icon={eyeOffOutline} className="text-indigo-400 text-lg" />
                <h3 className="font-bold text-slate-100">2. Irrecuperabilidade da Senha Mestra</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Por motivos estritos de segurança e privacidade, a sua Senha Mestra <strong>não é armazenada em texto claro nem recuperável</strong> por nossa equipe. Caso você esqueça a sua Senha Mestra e não possua um backup de chaves ou PIN ativo, o acesso aos seus dados cifrados será permanentemente impossibilitado.
              </p>
            </div>

            {/* Cláusula 3 */}
            <div className="glass-card p-4 rounded-xl border border-white/5">
              <div className="flex items-center gap-3 mb-2">
                <IonIcon icon={wifiOutline} className="text-emerald-400 text-lg" />
                <h3 className="font-bold text-slate-100">3. Serviço de VPN Nativa e Túnel Criptografado</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                O recurso de VPN do aplicativo utiliza tunelamento criptografado (Android VpnService / iOS NetworkExtension) para proteger sua conexão de rede contra interceptações (MITM) e redes Wi-Fi públicas inseguras. Não realizamos registros de logs de navegação ou atividades do usuário (*No-Logs Policy*).
              </p>
            </div>

            {/* Cláusula 4 */}
            <div className="glass-card p-4 rounded-xl border border-white/5">
              <div className="flex items-center gap-3 mb-2">
                <IonIcon icon={documentTextOutline} className="text-amber-400 text-lg" />
                <h3 className="font-bold text-slate-100">4. Módulo de Vazamento de Dados (k-Anonymity)</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                A consulta de vazamento de credenciais é realizada utilizando a técnica de anonimização por prefixo de hash (k-Anonymity SHA-1). Nenhuma senha ou e-mail bruto é exposto durante a verificação contra bases públicas de violações de dados.
              </p>
            </div>
          </div>

          {/* Checkbox de confirmação de leitura */}
          <div className="glass-card p-4 mt-6 rounded-xl border border-cyan-500/30">
            <IonItem lines="none" style={{ '--background': 'transparent' }}>
              <IonCheckbox
                slot="start"
                checked={isChecked}
                onIonChange={(e) => setIsChecked(e.detail.checked)}
                style={{ '--color-checked': '#00f2fe' }}
              />
              <IonLabel className="ion-text-wrap text-xs text-slate-200 font-semibold">
                Li, compreendi e concordo com os Termos de Uso e Política de Segurança e Criptografia.
              </IonLabel>
            </IonItem>
          </div>

          {/* Botão de Confirmação */}
          <div className="mt-6 mb-4">
            <IonButton
              expand="block"
              className="cyber-btn"
              disabled={!isChecked && !hasScrolled}
              onClick={handleConfirm}
              style={{
                '--background': isChecked || hasScrolled ? 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)' : '#334155',
                '--color': '#070a13',
                height: '52px',
                fontWeight: 800
              }}
            >
              {submitting ? 'Registrando Aceite...' : 'Aceitar e Continuar para o App'}
            </IonButton>
          </div>

        </div>
      </IonContent>
    </IonModal>
  );
};
