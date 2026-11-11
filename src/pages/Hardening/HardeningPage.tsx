import React, { useState, useEffect } from 'react';
import { IonPage, IonContent, IonToast, IonToggle } from '@ionic/react';
import {
  EyeOff,
  Clipboard,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Clock,
  FileSpreadsheet,
  FileJson,
  Play,
  KeyRound,
  ChevronDown,
  ChevronUp,
  Check,
  Smartphone,
  Monitor,
  Globe,
  Sliders,
} from 'lucide-react';
import { HardeningService } from '../../services/hardening';
import { ClipboardService } from '../../services/clipboard';
import { StorageService } from '../../services/storage';
import { SessionService } from '../../services/session';
import { useSecurity } from '../../contexts/SecurityContext';
import { AuditLog } from '../../types';
import { getErrorMessage } from '../../lib/utils';
import { PageHeader } from '../../components/ui/PageHeader';
import { OrbitRing, OrbitTone } from '../../components/brand';
import './HardeningPage.css';

type PlatformFilter = 'all' | 'android' | 'windows' | 'browser' | 'vault';

interface ChecklistGuideItem {
  id: string;
  title: string;
  summary: string;
  platform: 'android' | 'windows' | 'browser' | 'vault';
  platformLabel: string;
  impact: 'Crítico' | 'Essencial' | 'Recomendado';
  steps: string[];
  linkedRuntimeState?: 'screenshot' | 'panicPin';
}

const HARDENING_CHECKLIST: ChecklistGuideItem[] = [
  {
    id: 'chk-privacy-curtain',
    title: 'Bloqueio de Capturas de Tela & Cortina Anti-PrintScreen',
    summary: 'Oculta o cofre ao detectar perda de foco (Win+Shift+S / Alt+Tab) ou aplica FLAG_SECURE no Android.',
    platform: 'vault',
    platformLabel: 'Cofre / Multiplataforma',
    impact: 'Crítico',
    linkedRuntimeState: 'screenshot',
    steps: [
      'Ative a chave "Bloqueio de Capturas de Tela (Cortina de Privacidade)" nos controles ativos abaixo.',
      'No Windows/Web, qualquer perda de foco da janela ou acionamento da tecla PrintScreen oculta o cofre instantaneamente.',
      'No Android nativo, o módulo aplica a flag de janela FLAG_SECURE diretamente no SurfaceFlinger.',
    ],
  },
  {
    id: 'chk-duress-pin',
    title: 'PIN de Pânico & Cofre de Fachada Anti-Coação',
    summary: 'Protege suas credenciais reais abrindo um cofre fictício convincente sob situação de coação presencial.',
    platform: 'vault',
    platformLabel: 'Cofre Zero-Knowledge',
    impact: 'Crítico',
    linkedRuntimeState: 'panicPin',
    steps: [
      'Expanda o módulo "PIN de Pânico & Cofre de Fachada" abaixo e cadastre um código numérico de 6 dígitos diferente do seu PIN Principal.',
      'Ao sofrer coação presencial, digite o PIN de Pânico na tela de bloqueio.',
      'O aplicativo abrirá silenciosamente um cofre de fachada com contas fictícias inofensivas.',
    ],
  },
  {
    id: 'chk-android-dns',
    title: 'DNS Privado Criptografado (DNS-over-TLS Nativo)',
    summary: 'Impede que provedores ou redes Wi-Fi públicas interceptem ou falsifiquem consultas de domínio.',
    platform: 'android',
    platformLabel: 'Android',
    impact: 'Essencial',
    steps: [
      'Abra Configurações do Android > Rede e Internet > DNS Privado.',
      'Selecione "Nome do host do provedor de DNS privado".',
      'Informe one.one.one.one ou 1dot1dot1dot1.cloudflare-dns.com e toque em Salvar.',
    ],
  },
  {
    id: 'chk-android-adb',
    title: 'Desativação de Depuração USB (ADB) e Fontes Desconhecidas',
    summary: 'Bloqueia extração forense via cabo USB (Juice Jacking) e instalação lateral de APKs trojanizados.',
    platform: 'android',
    platformLabel: 'Android',
    impact: 'Crítico',
    steps: [
      'Acesse Configurações > Sistema > Opções do Desenvolvedor e desative "Depuração USB".',
      'Vá em Configurações > aplicativos > Acesso especial > Instalar apps desconhecidos.',
      'Revogue a permissão de todos os navegadores e gerenciadores de arquivos.',
    ],
  },
  {
    id: 'chk-win-bitlocker',
    title: 'Criptografia de Disco Completa (BitLocker + TPM 2.0)',
    summary: 'Protege os arquivos locais do cofre e cache do navegador caso o notebook/PC seja furtado desligado.',
    platform: 'windows',
    platformLabel: 'Windows',
    impact: 'Crítico',
    steps: [
      'Pressione Win + R, digite control /name Microsoft.BitLockerDriveEncryption e pressione Enter.',
      'Ative o BitLocker na unidade do sistema (C:) vinculando ao chip TPM 2.0.',
      'Salve a chave de recuperação de 48 dígitos dentro do seu Cofre RiskZero.',
    ],
  },
  {
    id: 'chk-win-core-isolation',
    title: 'Isolamento de Núcleo (Integridade da Memória HVCI)',
    summary: 'Usa virtualização de hardware para impedir injeção de código malicioso em processos de alta segurança.',
    platform: 'windows',
    platformLabel: 'Windows',
    impact: 'Essencial',
    steps: [
      'Abra Segurança do Windows > Segurança do Dispositivo > Detalhes de Isolamento de Núcleo.',
      'Ative a chave "Integridade da Memória" e reinicie o computador.',
      'Mantenha o Secure Boot (Inicialização Segura) habilitado na UEFI/BIOS.',
    ],
  },
  {
    id: 'chk-browser-autofill',
    title: 'Desativar Gerenciador de Senhas Nativo do Navegador',
    summary: 'Evita que senhas fiquem salvas sem criptografia Zero-Knowledge no SQLite local do navegador.',
    platform: 'browser',
    platformLabel: 'Navegador',
    impact: 'Essencial',
    steps: [
      'No Chrome ou Edge, acesse chrome://settings/passwords.',
      'Desative "Oferecer para salvar senhas" e "Login automático".',
      'Remova senhas antigas armazenadas no navegador e mantenha-as exclusivamente no Cofre AES-256-GCM.',
    ],
  },
  {
    id: 'chk-browser-doh',
    title: 'DNS-over-HTTPS (DoH) e Proteção Avançada no Navegador',
    summary: 'Criptografa a resolução de nomes e bloqueia downloads maliciosos conhecidos em tempo real.',
    platform: 'browser',
    platformLabel: 'Navegador',
    impact: 'Recomendado',
    steps: [
      'Acesse chrome://settings/security no seu navegador.',
      'Role até "Usar DNS seguro" e selecione Cloudflare (1.1.1.1) ou Google (Public DNS).',
      'Certifique-se de manter apenas extensões auditadas instaladas em chrome://extensions.',
    ],
  },
];

const CHECKLIST_STORAGE_KEY = 'rz_hardening_checklist_v1';

export const HardeningPage: React.FC = () => {
  const {
    hasPIN,
    hasPanicPIN,
    isCamouflageMode,
    registerPanicPIN,
    disablePanicPIN,
    lockApp,
  } = useSecurity();

  const [screenshotBlocked, setScreenshotBlocked] = useState<boolean>(() =>
    HardeningService.isPrivacyScreenEnabled()
  );
  const [clipboardDemo, setClipboardDemo] = useState(false);
  const [clipboardCountdown, setClipboardCountdown] = useState(0);
  const [isNative, setIsNative] = useState(false);
  const [envAudit, setEnvAudit] = useState<{
    isCompromised: boolean;
    riskLevel: 'SEGURO' | 'ALERTA' | 'CRÍTICO';
    details: string[];
  }>({ isCompromised: false, riskLevel: 'SEGURO', details: [] });

  // Estados do PIN de Pânico & Camuflagem
  const [showPanicForm, setShowPanicForm] = useState<boolean>(false);
  const [panicPinInput, setPanicPinInput] = useState<string>('');
  const [panicPinConfirm, setPanicPinConfirm] = useState<string>('');
  const [panicError, setPanicError] = useState<string | null>(null);
  const [savingPanic, setSavingPanic] = useState<boolean>(false);

  // Estados do Checklist Operacional
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [expandedItem, setExpandedItem] = useState<string | null>('chk-privacy-curtain');
  const [completedChecklist, setCompletedChecklist] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    setIsNative(HardeningService.isNative());
    setScreenshotBlocked(HardeningService.isPrivacyScreenEnabled());
    HardeningService.detectRootOrJailbreak()
      .then((res) => setEnvAudit(res))
      .catch(() => {});
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const email = SessionService.getActiveUserEmail();
    if (!email) return;
    const logs = await StorageService.getAuditLogs(email);
    setRecentLogs(logs.slice(0, 6));
  };

  const handleScreenshotToggle = async (enabled: boolean) => {
    setScreenshotBlocked(enabled);
    if (enabled) {
      await HardeningService.enablePrivacyScreen();
      setToastMsg(
        isNative
          ? 'FLAG_SECURE ativado: capturas de tela bloqueadas no Android.'
          : 'Cortina de Privacidade ativada: a tela será ocultada ao detectar PrintScreen ou perda de foco (Win+Shift+S).'
      );
    } else {
      await HardeningService.disablePrivacyScreen();
      setToastMsg('Proteção contra capturas de tela desativada.');
    }
    setShowToast(true);
    await loadLogs();
  };

  const handleTestPrivacyCurtain = async () => {
    if (!screenshotBlocked) {
      await handleScreenshotToggle(true);
    }
    window.dispatchEvent(new Event('blur'));
  };

  const handleClipboardDemo = async () => {
    setClipboardDemo(true);
    const demoText = 'SenhaExemplo@123!Demo';
    await ClipboardService.copySecure(
      demoText,
      'Senha Demonstração',
      (_msg, timeLeft) => {
        setClipboardCountdown(timeLeft);
        if (timeLeft === 0) {
          setClipboardDemo(false);
          setToastMsg('Área de transferência sobrescrita e limpa automaticamente.');
          setShowToast(true);
          loadLogs();
        }
      }
    );
    setToastMsg('Senha copiada! Autodestruição da área de transferência iniciada (30s).');
    setShowToast(true);
  };

  const handleClearNow = async () => {
    await ClipboardService.clearNow();
    setClipboardDemo(false);
    setClipboardCountdown(0);
    setToastMsg('Área de transferência limpa imediatamente.');
    setShowToast(true);
    await loadLogs();
  };

  const handleToggleCamouflage = async (checked: boolean) => {
    setPanicError(null);
    if (checked) {
      setShowPanicForm(true);
    } else {
      setShowPanicForm(false);
      setPanicPinInput('');
      setPanicPinConfirm('');
      if (hasPanicPIN) {
        await disablePanicPIN();
        setToastMsg('PIN de Pânico & Camuflagem desativado.');
        setShowToast(true);
        await loadLogs();
      }
    }
  };

  const handleSavePanicPIN = async (e: React.FormEvent) => {
    e.preventDefault();
    setPanicError(null);

    if (panicPinInput.length !== 6 || isNaN(Number(panicPinInput))) {
      setPanicError('O PIN de Pânico deve conter exatamente 6 dígitos numéricos.');
      return;
    }

    if (panicPinInput !== panicPinConfirm) {
      setPanicError('A confirmação do PIN de Pânico não confere.');
      return;
    }

    setSavingPanic(true);
    try {
      await registerPanicPIN(panicPinInput);
      setPanicPinInput('');
      setPanicPinConfirm('');
      setShowPanicForm(false);
      setToastMsg('PIN de Pânico & Camuflagem ativado com sucesso!');
      setShowToast(true);
      await loadLogs();
    } catch (err: unknown) {
      setPanicError(getErrorMessage(err) || 'Erro ao salvar PIN de Pânico.');
    } finally {
      setSavingPanic(false);
    }
  };

  const isChecklistItemDone = (item: ChecklistGuideItem): boolean => {
    if (item.linkedRuntimeState === 'screenshot') return screenshotBlocked;
    if (item.linkedRuntimeState === 'panicPin') return hasPanicPIN;
    return !!completedChecklist[item.id];
  };

  const toggleChecklistItem = async (item: ChecklistGuideItem) => {
    if (item.linkedRuntimeState === 'screenshot') {
      await handleScreenshotToggle(!screenshotBlocked);
      return;
    }
    if (item.linkedRuntimeState === 'panicPin') {
      setShowPanicForm(true);
      setExpandedItem(item.id);
      return;
    }
    setCompletedChecklist((prev) => {
      const next = { ...prev, [item.id]: !prev[item.id] };
      try {
        localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignora erro de quota
      }
      return next;
    });
  };

  const handleExportCSV = async () => {
    const email = SessionService.getActiveUserEmail();
    if (!email) return;
    try {
      const csv = await StorageService.exportAuditLogsCSV(email);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria_seguranca_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToastMsg('Relatório CSV exportado.');
    } catch {
      setToastMsg('Erro ao exportar CSV.');
    }
    setShowToast(true);
  };

  const handleExportJSON = async () => {
    const email = SessionService.getActiveUserEmail();
    if (!email) return;
    try {
      const json = await StorageService.exportAuditLogsJSON(email);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_lgpd_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToastMsg('Relatório LGPD (JSON) exportado.');
    } catch {
      setToastMsg('Erro ao exportar JSON.');
    }
    setShowToast(true);
  };

  const totalChecklistCount = HARDENING_CHECKLIST.length;
  const completedCount = HARDENING_CHECKLIST.filter((i) => isChecklistItemDone(i)).length;
  const completionPct = Math.round((completedCount / totalChecklistCount) * 100);

  const ringTone: OrbitTone =
    completionPct >= 75 ? 'success' : completionPct >= 40 ? 'accent' : 'warning';

  const filteredChecklist = HARDENING_CHECKLIST.filter((item) => {
    if (platformFilter === 'all') return true;
    return item.platform === platformFilter;
  });

  return (
    <IonPage className="rz-page">
      <IonContent fullscreen className="rz-content">
        <div className="rz-page-container">
          <PageHeader
            eyebrow="Blindagem Operacional"
            title="Proteção do Aparelho"
            subtitle="Controles ativos contra captura de tela, exfiltração de clipboard, coação presencial e checklist de endurecimento do sistema."
            actions={
              <span className={`rz-badge ${isNative ? 'rz-badge-success' : 'rz-badge-blue'}`}>
                <span className="rz-dot success is-live" />
                {isNative ? 'Ambiente Android Nativo' : 'Proteção Web / Windows Ativa'}
              </span>
            }
          />

          {/* ==================== PAINEL HERO: PROGRESSO DE HARDENING COM ORBITRING ==================== */}
          <section
            className="rz-panel rz-meridian-bg hardening-hero"
            aria-label="Índice de blindagem do dispositivo"
          >
            <div className="hardening-hero-left">
              <OrbitRing
                size={122}
                stroke={7}
                value={completionPct}
                tone={ringTone}
                globe
                label={`Progresso de blindagem: ${completionPct}%`}
              >
                <span
                  className="rz-num"
                  style={{
                    fontSize: '1.95rem',
                    fontWeight: 800,
                    lineHeight: 1,
                    color: 'var(--rz-text-primary)',
                  }}
                >
                  {completionPct}%
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--rz-text-muted)',
                    marginTop: 2,
                  }}
                >
                  Blindado
                </span>
              </OrbitRing>

              <div className="hardening-hero-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    className={`rz-badge ${
                      envAudit.riskLevel === 'SEGURO'
                        ? 'rz-badge-success'
                        : envAudit.riskLevel === 'ALERTA'
                          ? 'rz-badge-warning'
                          : 'rz-badge-danger'
                    }`}
                  >
                    {envAudit.riskLevel === 'SEGURO' ? (
                      <ShieldCheck size={12} />
                    ) : (
                      <ShieldAlert size={12} />
                    )}
                    <span>Integridade do Host: {envAudit.riskLevel}</span>
                  </span>
                  <span className="rz-badge rz-badge-neutral rz-font-mono">
                    {completedCount}/{totalChecklistCount} Diretrizes Concluídas
                  </span>
                </div>

                <h2 className="hardening-hero-title">Postura de Blindagem Operacional</h2>
                <p className="rz-text-muted" style={{ maxWidth: '62ch' }}>
                  Combine os guardiões de tempo de execução do RiskZero (Cortina Anti-PrintScreen, PIN de Pânico e Sanitização de Clipboard) com as diretrizes de endurecimento do sistema operacional.
                </p>
              </div>
            </div>
          </section>

          {/* ==================== CONTROLES ATIVOS DE RUNTIME ==================== */}
          <div className="hardening-controls-grid">
            {/* 1. Bloqueio de Capturas de Tela */}
            <section className="rz-panel">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div className={`rz-icon-tile ${screenshotBlocked ? 'success' : ''}`}>
                    <EyeOff />
                  </div>
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <h2 className="rz-card-title">
                        Bloqueio de Capturas de Tela (Cortina de Privacidade)
                      </h2>
                      <span
                        className={`rz-badge ${
                          screenshotBlocked ? 'rz-badge-success' : 'rz-badge-neutral'
                        }`}
                      >
                        {screenshotBlocked ? 'Protegido' : 'Inativo'}
                      </span>
                    </div>
                    <p className="rz-text-muted" style={{ marginTop: 6 }}>
                      No Windows/Web, aciona instantaneamente uma{' '}
                      <strong>Cortina de Privacidade</strong> ao detectar perda de foco da janela
                      (como ao abrir a Ferramenta de Captura <code className="rz-kbd">Win+Shift+S</code>{' '}
                      ou <code className="rz-kbd">Alt+Tab</code>) e intercepta a tecla{' '}
                      <code className="rz-kbd">PrintScreen</code> limpando a área de transferência.
                      No Android nativo, aplica <code>FLAG_SECURE</code>.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <IonToggle
                    checked={screenshotBlocked}
                    onIonChange={(e) => handleScreenshotToggle(e.detail.checked)}
                    aria-label="Ativar Bloqueio de Capturas de Tela"
                  />
                </div>
              </div>

              <div className="hardening-control-foot">
                <span
                  style={{
                    fontSize: 'var(--rz-text-xs)',
                    fontWeight: 600,
                    color: screenshotBlocked ? 'var(--rz-success)' : 'var(--rz-text-muted)',
                  }}
                >
                  {screenshotBlocked
                    ? '✓ Cortina ativa: tente pressionar Win+Shift+S, Alt+Tab ou PrintScreen.'
                    : 'Ative a chave acima para blindar a janela contra capturas.'}
                </span>

                <button
                  type="button"
                  className="rz-btn rz-btn-secondary rz-btn-sm"
                  onClick={handleTestPrivacyCurtain}
                >
                  <Play size={14} />
                  <span>Simular Captura / Testar Cortina</span>
                </button>
              </div>
            </section>

            {/* 2. PIN de Pânico & Camuflagem (Duress PIN) */}
            <section className="rz-panel">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div className="rz-icon-tile warning">
                    <KeyRound />
                  </div>
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <h2 className="rz-card-title">
                        PIN de Pânico &amp; Cofre de Fachada (Modo Camuflagem)
                      </h2>
                      <span
                        className={`rz-badge ${
                          hasPanicPIN ? 'rz-badge-success' : 'rz-badge-warning'
                        }`}
                      >
                        {hasPanicPIN ? 'PIN de Pânico Configurado' : 'Não Configurado'}
                      </span>
                      {isCamouflageMode && (
                        <span className="rz-badge rz-badge-blue">Modo Fachada Ativo</span>
                      )}
                    </div>
                    <p className="rz-text-muted" style={{ marginTop: 6 }}>
                      Em situações de coação (assalto ou coerção presencial), digitar o seu{' '}
                      <strong>PIN de Pânico de 6 dígitos</strong> abre silenciosamente um{' '}
                      <strong>Cofre de Fachada</strong> com contas cotidianas reais (Netflix, Mercado Livre, iFood, Uber), mantendo suas senhas verdadeiras 100% ocultas.
                    </p>
                    <div className="rz-alert rz-alert-info" style={{ marginTop: 10 }}>
                      <ShieldCheck size={18} />
                      <span>
                        <strong>Uso sob Coação no Login Inicial:</strong> Se o aplicativo estiver deslogado, você pode digitar o seu <strong>PIN de Pânico diretamente no campo de Senha Mestra</strong> da tela de login. O sistema detectará o código de emergência na hora, entrará sem pedir 2FA e exibirá o cofre camuflado para proteger sua integridade.
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <IonToggle
                    checked={hasPanicPIN || showPanicForm}
                    onIonChange={(e) => handleToggleCamouflage(e.detail.checked)}
                    aria-label="Configurar PIN de Pânico"
                  />
                </div>
              </div>

              {/* Formulário de Configuração do PIN de Pânico */}
              {(showPanicForm || !hasPanicPIN) && (
                <form
                  onSubmit={handleSavePanicPIN}
                  style={{
                    marginTop: 16,
                    paddingTop: 16,
                    borderTop: '1px solid var(--rz-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 'var(--rz-text-sm)',
                      fontWeight: 700,
                      color: 'var(--rz-text-primary)',
                    }}
                  >
                    {hasPanicPIN
                      ? 'Alterar PIN Secundário de Pânico (6 dígitos)'
                      : 'Definir PIN Secundário de Pânico (6 dígitos)'}
                  </div>

                  {!hasPIN && (
                    <div className="rz-alert rz-alert-info">
                      <ShieldCheck size={18} />
                      <span>
                        Dica: você também pode configurar seu PIN Principal no Painel Geral para alternar entre o Cofre Real (PIN Principal) e o Cofre de Fachada (PIN de Pânico).
                      </span>
                    </div>
                  )}

                  <div className="rz-grid-2">
                    <div>
                      <label htmlFor="panic-pin-input" className="rz-label">
                        PIN DE PÂNICO (6 NÚMEROS)
                      </label>
                      <input
                        id="panic-pin-input"
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Ex: 999999"
                        value={panicPinInput}
                        onChange={(e) =>
                          setPanicPinInput(e.target.value.replace(/\D/g, ''))
                        }
                        className="rz-input is-mono"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="panic-pin-confirm" className="rz-label">
                        CONFIRMAR PIN DE PÂNICO
                      </label>
                      <input
                        id="panic-pin-confirm"
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Repita os 6 dígitos"
                        value={panicPinConfirm}
                        onChange={(e) =>
                          setPanicPinConfirm(e.target.value.replace(/\D/g, ''))
                        }
                        className="rz-input is-mono"
                        required
                      />
                    </div>
                  </div>

                  {panicError && <div className="rz-field-error">{panicError}</div>}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    {showPanicForm && hasPanicPIN && (
                      <button
                        type="button"
                        className="rz-btn rz-btn-secondary"
                        onClick={() => {
                          setShowPanicForm(false);
                          setPanicError(null);
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={
                        savingPanic ||
                        panicPinInput.length !== 6 ||
                        panicPinConfirm.length !== 6
                      }
                      className="rz-btn rz-btn-primary"
                    >
                      <CheckCircle2 size={15} />
                      <span>{savingPanic ? 'Salvando...' : 'Salvar PIN de Pânico'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Ações quando o PIN de Pânico já está configurado */}
              {hasPanicPIN && !showPanicForm && (
                <div className="hardening-control-foot">
                  <span
                    style={{
                      fontSize: 'var(--rz-text-xs)',
                      fontWeight: 600,
                      color: 'var(--rz-success)',
                    }}
                  >
                    ✓ PIN de Pânico pronto. Você pode digitá-lo na tela de bloqueio OU diretamente no campo de Senha Mestra na tela inicial de login para abrir o Cofre de Fachada.
                  </span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="rz-btn rz-btn-secondary rz-btn-sm"
                      onClick={() => setShowPanicForm(true)}
                    >
                      Alterar PIN de Pânico
                    </button>
                    <button
                      type="button"
                      className="rz-btn rz-btn-primary rz-btn-sm"
                      onClick={lockApp}
                    >
                      <Lock size={14} />
                      <span>Bloquear Agora e Testar</span>
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* 3. Limpeza da Área de Transferência */}
            <section className="rz-panel">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                <div className="rz-icon-tile success">
                  <Clipboard />
                </div>
                <div>
                  <h2 className="rz-card-title">
                    Autodestruição da Área de Transferência (30s)
                  </h2>
                  <p className="rz-text-muted" style={{ marginTop: 6 }}>
                    Qualquer credencial copiada do cofre é automaticamente sobrescrita e limpa da memória da área de transferência após 30 segundos.
                  </p>
                </div>
              </div>

              {clipboardDemo && clipboardCountdown > 0 && (
                <div className="clipboard-timer-banner">
                  <div className="clipboard-timer-text">
                    <Clock size={16} />
                    <span>
                      Sobrescrevendo área de transferência em{' '}
                      <strong className="rz-font-mono">{clipboardCountdown}s</strong>
                    </span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleClipboardDemo}
                  disabled={clipboardDemo}
                  className="rz-btn rz-btn-secondary"
                  style={{ flex: 1 }}
                >
                  <Clipboard size={15} />
                  <span>Testar Cópia com Autodestruição (30s)</span>
                </button>
                {clipboardDemo && (
                  <button
                    type="button"
                    onClick={handleClearNow}
                    className="rz-btn rz-btn-danger"
                  >
                    <Trash2 size={15} />
                    <span>Limpar Agora</span>
                  </button>
                )}
              </div>
            </section>
          </div>

          {/* ==================== CHECKLIST EXPANSÍVEL POR PLATAFORMA ==================== */}
          <section className="rz-section">
            <div className="rz-section-head" style={{ flexWrap: 'wrap' }}>
              <h2 className="rz-section-title">
                <Sliders size={16} />
                <span>Checklist de Blindagem Passo a Passo</span>
                <span className="rz-count">
                  {completedCount}/{totalChecklistCount}
                </span>
              </h2>

              <div className="rz-scroll-x" role="tablist" aria-label="Filtrar checklist por plataforma">
                {(
                  [
                    { id: 'all', label: 'Todos', icon: ShieldCheck },
                    { id: 'vault', label: 'Cofre', icon: Lock },
                    { id: 'android', label: 'Android', icon: Smartphone },
                    { id: 'windows', label: 'Windows / PC', icon: Monitor },
                    { id: 'browser', label: 'Navegador', icon: Globe },
                  ] as const
                ).map((chip) => {
                  const Icon = chip.icon;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      role="tab"
                      aria-selected={platformFilter === chip.id}
                      onClick={() => setPlatformFilter(chip.id)}
                      className={`rz-chip ${platformFilter === chip.id ? 'is-active' : ''}`}
                    >
                      <Icon size={14} />
                      <span>{chip.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rz-list">
              {filteredChecklist.map((item) => {
                const done = isChecklistItemDone(item);
                const isOpen = expandedItem === item.id;
                return (
                  <div key={item.id} className="hardening-checklist-item">
                    <div className="hardening-checklist-head">
                      <button
                        type="button"
                        onClick={() => toggleChecklistItem(item)}
                        className={`hardening-check-toggle ${done ? 'is-checked' : ''}`}
                        aria-label={`Marcar "${item.title}" como ${done ? 'pendente' : 'concluído'}`}
                      >
                        <Check size={14} strokeWidth={3} />
                      </button>

                      <button
                        type="button"
                        className="hardening-expand-btn"
                        onClick={() => setExpandedItem(isOpen ? null : item.id)}
                        aria-expanded={isOpen}
                      >
                        <div className="rz-row-main">
                          <div
                            className="rz-row-title"
                            style={{
                              whiteSpace: 'normal',
                              textDecoration: done ? 'line-through' : 'none',
                              opacity: done ? 0.78 : 1,
                            }}
                          >
                            {item.title}
                          </div>
                          <div className="rz-row-meta" style={{ whiteSpace: 'normal' }}>
                            {item.summary}
                          </div>
                        </div>

                        <div className="rz-row-trailing">
                          <span className="rz-badge rz-badge-neutral">{item.platformLabel}</span>
                          <span
                            className={`rz-badge ${
                              done
                                ? 'rz-badge-success'
                                : item.impact === 'Crítico'
                                  ? 'rz-badge-danger'
                                  : item.impact === 'Essencial'
                                    ? 'rz-badge-warning'
                                    : 'rz-badge-blue'
                            }`}
                          >
                            {done ? 'Ativo' : item.impact}
                          </span>
                          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </button>
                    </div>

                    {isOpen && (
                      <div className="hardening-checklist-body">
                        <div className="hardening-step-list">
                          {item.steps.map((stepText, idx) => (
                            <div key={idx} className="hardening-step-row">
                              <span className="hardening-step-idx">{idx + 1}</span>
                              <span>{stepText}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ==================== 4. EXPORTAÇÃO DE CONFORMIDADE & EVENTOS ==================== */}
          <section className="rz-panel">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div>
                <h2 className="rz-card-title">
                  Relatórios de Conformidade (LGPD &amp; ISO/IEC 27001)
                </h2>
                <p className="rz-text-muted" style={{ marginTop: 4 }}>
                  Exporte a trilha de auditoria técnica para validação acadêmica ou corporativa.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="rz-btn rz-btn-secondary"
                >
                  <FileSpreadsheet size={15} />
                  <span>Exportar CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="rz-btn rz-btn-primary"
                >
                  <FileJson size={15} />
                  <span>Exportar JSON (LGPD)</span>
                </button>
              </div>
            </div>

            {recentLogs.length > 0 && (
              <div className="hardening-logs-wrapper" style={{ marginTop: 12 }}>
                {recentLogs.map((log) => (
                  <div key={log.id} className="hardening-log-item">
                    <span className="hardening-log-text">{log.details}</span>
                    <span className="hardening-log-time">
                      {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          duration={2500}
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};
