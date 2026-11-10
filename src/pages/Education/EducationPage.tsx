import React, { useState } from 'react';
import {
  IonPage,
  IonContent,
  IonCard,
  IonCardContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
} from '@ionic/react';
import {
  ShieldAlert,
  KeyRound,
  Lock,
  UserX,
  Network,
  QrCode,
  Globe,
  Wifi,
  Smartphone,
  Timer,
  Database,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Award,
  BookOpen,
  CheckCircle2,
  Scale,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Mascot, OrbitRing } from '../../components/brand';
import './EducationPage.css';

// ────────────────────────────────────────
// Interface de Tópicos Educativos
// ────────────────────────────────────────
export interface TopicItem {
  id: string;
  title: string;
  category: 'attacks' | 'prevention' | 'practices';
  description: string;
  details: string;
  icon: React.ElementType;
  color: string;
  tone: 'danger' | 'warning' | 'violet' | 'success' | 'accent';
  badge: string;
}

// ────────────────────────────────────────
// Lista de 13 Tópicos Obrigatórios
// ────────────────────────────────────────
const EDUCATIONAL_TOPICS: TopicItem[] = [
  // --- ATAQUES COMUNS ---
  {
    id: 'phishing',
    title: 'Phishing',
    category: 'attacks',
    description: 'Golpes com e-mails, SMS ou sites clonados para capturar senhas e cartões.',
    details: 'Os atacantes imitam instituições confiáveis (bancos, e-commerces) induzindo a vítima a fornecer credenciais em páginas falsas.',
    icon: ShieldAlert,
    color: 'var(--rz-danger)',
    tone: 'danger',
    badge: 'Ataque Frequente',
  },
  {
    id: 'credential_stuffing',
    title: 'Credential Stuffing',
    category: 'attacks',
    description: 'Testes automatizados com listas de senhas vazadas na internet.',
    details: 'Robôs tentam usar a mesma combinação de e-mail e senha em centenas de serviços. Se você reutiliza senhas, todas as contas ficam expostas.',
    icon: KeyRound,
    color: 'var(--rz-warning)',
    tone: 'warning',
    badge: 'Automação Maliciosa',
  },
  {
    id: 'ransomware',
    title: 'Ransomware',
    category: 'attacks',
    description: 'Sequestro de arquivos através de criptografia não autorizada.',
    details: 'Malwares bloqueiam os arquivos do seu aparelho e exigem pagamento de resgate para fornecer a chave de descriptografia.',
    icon: Lock,
    color: 'var(--rz-danger)',
    tone: 'danger',
    badge: 'Alto Impacto',
  },
  {
    id: 'social_engineering',
    title: 'Engenharia Social',
    category: 'attacks',
    description: 'Manipulação psicológica para obter informações confidenciais.',
    details: 'Criminosos ganham a confiança da vítima fingindo ser suporte técnico, conhecidos ou autoridades para obter códigos e senhas.',
    icon: UserX,
    color: 'var(--rz-warning)',
    tone: 'warning',
    badge: 'Manipulação',
  },
  {
    id: 'mitm',
    title: 'Man-in-the-Middle (MitM)',
    category: 'attacks',
    description: 'Interceptação clandestina de dados transmitidos na rede.',
    details: 'Um atacante se posiciona entre o seu aparelho e o roteador/servidor, capturando senhas e mensagens enviadas sem criptografia.',
    icon: Network,
    color: 'var(--rz-violet)',
    tone: 'violet',
    badge: 'Interceptação',
  },

  // --- COMO EVITAR ---
  {
    id: '2fa',
    title: 'Autenticação em Duas Etapas (2FA)',
    category: 'prevention',
    description: 'Camada adicional de proteção baseada em códigos temporários (TOTP).',
    details: 'Mesmo que sua senha seja descoberta, o invasor não conseguirá acessar a conta sem o token de 6 dígitos gerado pelo seu celular.',
    icon: QrCode,
    color: 'var(--rz-success)',
    tone: 'success',
    badge: 'Proteção Essencial',
  },
  {
    id: 'password_manager',
    title: 'Gerenciador de Senhas',
    category: 'prevention',
    description: 'Armazenamento seguro e geração de chaves únicas por serviço.',
    details: 'Cria senhas aleatórias e fortes para cada cadastro e as protege com criptografia Zero-Knowledge no aparelho.',
    icon: ShieldCheck,
    color: 'var(--rz-accent)',
    tone: 'accent',
    badge: 'Recomendado',
  },
  {
    id: 'link_verification',
    title: 'Verificação de Links (URLs)',
    category: 'prevention',
    description: 'Checagem rigorosa de domínios e certificados HTTPS antes de clicar.',
    details: 'Observe atentamente o endereço na barra do navegador. Desconfie de extensões incomuns (.xyz, .tk) ou subdomínios disfarçados.',
    icon: Globe,
    color: 'var(--rz-accent)',
    tone: 'accent',
    badge: 'Prevenção Ativa',
  },
  {
    id: 'vpn_public_wifi',
    title: 'Uso de VPN em Wi-Fi Público',
    category: 'prevention',
    description: 'Túnel criptografado para conexões em redes abertas de terceiros.',
    details: 'Redes públicas em cafés, hotéis ou aeroportos podem ser monitoradas. A VPN esconde seu tráfego de olhares indiscretos.',
    icon: Wifi,
    color: 'var(--rz-violet)',
    tone: 'violet',
    badge: 'Rede Segura',
  },

  // --- BOAS PRÁTICAS ---
  {
    id: 'screenshot_blocking',
    title: 'Bloqueio de Screenshots',
    category: 'practices',
    description: 'Impedimento nativo de capturas de tela contendo dados sensíveis.',
    details: 'Evita que malwares ou aplicativos espiões gravem em segundo plano as senhas exibidas na tela do celular.',
    icon: Smartphone,
    color: 'var(--rz-violet)',
    tone: 'violet',
    badge: 'Privacidade Nativa',
  },
  {
    id: 'auto_lock',
    title: 'Auto-Lock por Inatividade',
    category: 'practices',
    description: 'Bloqueio automático e imediato após período sem uso do app.',
    details: 'Protege seus dados caso você esqueça o celular desbloqueado sobre a mesa ou se o aparelho for tomado rapidamente.',
    icon: Timer,
    color: 'var(--rz-warning)',
    tone: 'warning',
    badge: 'Defesa de Sessão',
  },
  {
    id: 'encrypted_backups',
    title: 'Backups Criptografados',
    category: 'practices',
    description: 'Cópias de segurança protegidas com chave derivada da Senha Mestra.',
    details: 'Assegura a recuperação completa das credenciais em novo dispositivo sem expor os dados aos servidores em nuvem.',
    icon: Database,
    color: 'var(--rz-success)',
    tone: 'success',
    badge: 'Continuidade',
  },
  {
    id: 'system_updates',
    title: 'Atualizações do Sistema',
    category: 'practices',
    description: 'Correção contínua de falhas de segurança no sistema operacional.',
    details: 'Instalar atualizações do Android/iOS e aplicativos corrige brechas e vulnerabilidades conhecidas (Zero-Day).',
    icon: RefreshCw,
    color: 'var(--rz-accent)',
    tone: 'accent',
    badge: 'Higiene Digital',
  },
];

// ────────────────────────────────────────
// Quiz de Privacidade
// ────────────────────────────────────────
const QUIZ = [
  {
    q: 'O que é um golpe de phishing?',
    opts: [
      'Um vírus de computador comum',
      'Um golpe com links ou e-mails falsos para roubar dados confidenciais',
      'Tentativa de adivinhar sua senha mestra',
      'Problemas com o sinal de internet',
    ],
    correct: 1,
    explain: 'Golpes de phishing fingem ser comunicações legítimas para enganar você e obter credenciais ou dados sigilosos.',
  },
  {
    q: 'Qual o tamanho recomendado para uma senha segura?',
    opts: [
      'Pelo menos 6 caracteres',
      'Pelo menos 8 caracteres',
      'No mínimo 12 a 16 caracteres',
      'Apenas 4 números',
    ],
    correct: 2,
    explain: 'Senhas longas (a partir de 12 caracteres) tornam o trabalho de invasores praticamente impossível usando computadores convencionais.',
  },
  {
    q: 'O que indica o "https://" no início do endereço de um site?',
    opts: [
      'Indica que o site é do governo',
      'Garante que os dados enviados ao site viajam criptografados e protegidos',
      'Significa que o site é totalmente imune a golpes',
      'Significa que o site não armazena cookies',
    ],
    correct: 1,
    explain: 'O HTTPS garante uma conexão segura e criptografada entre você e o site, impedindo que outros vejam o que você está enviando.',
  },
  {
    q: 'Quais são seus direitos segundo a LGPD?',
    opts: [
      'Usar internet gratuita em locais públicos',
      'Visualizar, corrigir e pedir para excluir seus dados pessoais das empresas',
      'Proteção automática e gratuita contra vírus',
      'Garantia de que senhas nunca expiram',
    ],
    correct: 1,
    explain: 'A Lei Geral de Proteção de Dados (LGPD) devolve a você o controle sobre as suas próprias informações pessoais coletadas por empresas.',
  },
];

export const EducationPage: React.FC = () => {
  const [segment, setSegment] = useState<'attacks' | 'prevention' | 'practices' | 'quiz'>('attacks');
  const [quizIndex, setQuizIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [readTopicIds, setReadTopicIds] = useState<string[]>([
    'phishing',
    '2fa',
    'password_manager',
    'encrypted_backups',
  ]);

  const toggleReadTopic = (id: string) => {
    setReadTopicIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAnswer = (optIdx: number) => {
    if (selected !== null) return;
    setSelected(optIdx);
    const correct = QUIZ[quizIndex].correct === optIdx;
    if (correct) setScore((s) => s + 1);
  };

  const handleNext = () => {
    if (quizIndex + 1 >= QUIZ.length) {
      setQuizDone(true);
    } else {
      setQuizIndex((i) => i + 1);
      setSelected(null);
    }
  };

  const resetQuiz = () => {
    setQuizIndex(0);
    setSelected(null);
    setScore(0);
    setQuizDone(false);
  };

  // Filtra os tópicos de acordo com a aba selecionada
  const currentTopics = EDUCATIONAL_TOPICS.filter((t) => t.category === segment);

  // Calcula progresso geral (módulos revisados + progresso/conclusão do quiz)
  const totalUnits = EDUCATIONAL_TOPICS.length + QUIZ.length;
  const completedUnits = readTopicIds.length + (quizDone ? score : quizIndex);
  const masteryPct = Math.min(100, Math.round((completedUnits / totalUnits) * 100));

  const badgeToneClass = (tone: TopicItem['tone']) => {
    switch (tone) {
      case 'danger':
        return 'rz-badge-danger';
      case 'warning':
        return 'rz-badge-warning';
      case 'violet':
        return 'rz-badge-violet';
      case 'success':
        return 'rz-badge-success';
      default:
        return 'rz-badge-info';
    }
  };

  const tileToneClass = (tone: TopicItem['tone']) => {
    switch (tone) {
      case 'danger':
        return 'danger';
      case 'warning':
        return 'warning';
      case 'violet':
        return 'violet';
      case 'success':
        return 'success';
      default:
        return '';
    }
  };

  return (
    <IonPage className="rz-page education-page">
      <IonContent className="rz-content education-content">
        <div className="rz-container">
          <PageHeader
            eyebrow="Academia de Defesa"
            title="Educação & Conformidade LGPD"
            subtitle="Doutrina prática contra vetores de ataque modernos, higiene criptográfica Zero-Knowledge e direitos do titular segundo a Lei nº 13.709/2018."
            actions={
              <button
                type="button"
                className="rz-btn rz-btn-secondary"
                onClick={() => setSegment(segment === 'quiz' ? 'attacks' : 'quiz')}
              >
                <BookOpen size={16} />
                <span>{segment === 'quiz' ? 'Explorar Módulos' : 'Avaliação LGPD'}</span>
              </button>
            }
          />

          {/* Guia de Segurança RiskZero — Companion Callout com Mascot + OrbitRing */}
          <section className="rz-edu-guide rz-meridian-bg" aria-label="Guia de Segurança RiskZero">
            <div className="rz-edu-mascot-wrap">
              <Mascot height={130} alt="Mascote Agente RiskZero" />
            </div>

            <div className="rz-edu-guide-body">
              <span className="rz-edu-guide-tag">
                <Scale size={14} />
                Guia de Segurança RiskZero · Conformidade ISO 27001 &amp; LGPD
              </span>
              <h2 className="rz-edu-guide-title">
                Defesa Ativa começa pela Consciência Operacional
              </h2>
              <p className="rz-edu-guide-desc">
                A criptografia Argon2id + AES-256-GCM protege seu cofre contra força bruta, mas a prevenção contra engenharia social e phishing depende de você. Revise os 13 protocolos abaixo e valide seu domínio no Quiz.
              </p>

              <div className="rz-edu-guide-pills">
                <span className="rz-badge rz-badge-info">
                  {readTopicIds.length}/{EDUCATIONAL_TOPICS.length} módulos revisados
                </span>
                <span className="rz-badge rz-badge-violet">
                  Art. 6º &amp; 18º LGPD — Autodeterminação Informativa
                </span>
                {quizDone && (
                  <span className="rz-badge rz-badge-success">
                    Quiz concluído: {score}/{QUIZ.length}
                  </span>
                )}
              </div>
            </div>

            <div className="rz-edu-orbit-box">
              <OrbitRing
                value={masteryPct}
                size={96}
                stroke={6}
                tone={masteryPct >= 80 ? 'success' : masteryPct >= 45 ? 'accent' : 'violet'}
                label="Progresso de prontidão educativa"
              >
                <span
                  className="rz-num"
                  style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--rz-text-primary)', lineHeight: 1 }}
                >
                  {masteryPct}%
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--rz-text-muted)',
                    marginTop: '2px',
                  }}
                >
                  Domínio
                </span>
              </OrbitRing>
              <span className="rz-edu-orbit-caption">Prontidão de Defesa</span>
            </div>
          </section>

          {/* Navegação por Abas */}
          <div className="rz-edu-tabs-bar">
            <IonSegment
              value={segment}
              onIonChange={(e) => {
                if (e.detail.value) {
                  setSegment(e.detail.value as 'attacks' | 'prevention' | 'practices' | 'quiz');
                }
              }}
              className="education-segment"
              scrollable
            >
              {[
                { val: 'attacks', label: 'Ataques comuns' },
                { val: 'prevention', label: 'Como evitar' },
                { val: 'practices', label: 'Boas práticas' },
                { val: 'quiz', label: 'Quiz' },
              ].map((s) => (
                <IonSegmentButton key={s.val} value={s.val} className="education-segment-btn">
                  <IonLabel>{s.label}</IonLabel>
                </IonSegmentButton>
              ))}
            </IonSegment>

            {segment !== 'quiz' && (
              <span className="rz-text-muted" style={{ fontSize: 'var(--rz-text-xs)' }}>
                Exibindo <strong>{currentTopics.length}</strong> módulos técnicos nesta categoria
              </span>
            )}
          </div>

          {/* ── SEÇÃO DE CARDS EDUCATIVOS (Ataques Comuns / Como Evitar / Boas Práticas) ── */}
          {(segment === 'attacks' || segment === 'prevention' || segment === 'practices') && (
            <div className="rz-edu-grid">
              {currentTopics.map((topic) => {
                const IconComponent = topic.icon;
                const isRead = readTopicIds.includes(topic.id);

                return (
                  <article
                    key={topic.id}
                    className={`rz-edu-card ${isRead ? 'is-read' : ''}`}
                  >
                    <div>
                      <div className="rz-edu-card-top">
                        <div className={`rz-icon-tile lg ${tileToneClass(topic.tone)}`}>
                          <IconComponent />
                        </div>
                        <span className={`rz-badge ${badgeToneClass(topic.tone)}`}>
                          {topic.badge}
                        </span>
                      </div>

                      <h3 className="rz-edu-card-title">{topic.title}</h3>
                      <p className="rz-edu-card-desc">{topic.description}</p>
                    </div>

                    <div>
                      <div className="rz-edu-card-detail">
                        <strong>Como funciona</strong>
                        {topic.details}
                      </div>

                      <div className="rz-edu-card-foot">
                        <span
                          style={{
                            fontSize: 'var(--rz-text-xs)',
                            color: isRead ? 'var(--rz-success)' : 'var(--rz-text-muted)',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <CheckCircle2 size={14} />
                          {isRead ? 'Módulo consolidado' : 'Leitura pendente'}
                        </span>

                        <button
                          type="button"
                          onClick={() => toggleReadTopic(topic.id)}
                          className={`rz-btn rz-btn-sm ${isRead ? 'rz-btn-ghost' : 'rz-btn-secondary'}`}
                        >
                          {isRead ? 'Concluído' : 'Marcar lido'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* ── QUIZ DE PRIVACIDADE E LGPD ── */}
          {segment === 'quiz' && (
            <div className="rz-quiz-layout">
              <IonCard className="quiz-card">
                <IonCardContent style={{ padding: '24px' }}>
                  {quizDone ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                        <OrbitRing
                          value={Math.round((score / QUIZ.length) * 100)}
                          size={112}
                          stroke={6}
                          tone={score === QUIZ.length ? 'success' : score >= 2 ? 'accent' : 'warning'}
                          label="Resultado final do Quiz"
                        >
                          {score === QUIZ.length ? (
                            <Trophy size={30} style={{ color: 'var(--rz-success)' }} />
                          ) : score >= 2 ? (
                            <Award size={30} style={{ color: 'var(--rz-ice)' }} />
                          ) : (
                            <BookOpen size={30} style={{ color: 'var(--rz-warning)' }} />
                          )}
                        </OrbitRing>
                      </div>

                      <div
                        className="rz-num"
                        style={{
                          color: 'var(--rz-text-primary)',
                          fontSize: '1.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        {score} de {QUIZ.length} acertos
                      </div>

                      <p
                        className="rz-text-muted"
                        style={{
                          maxWidth: '48ch',
                          margin: '8px auto 24px',
                        }}
                      >
                        {score === QUIZ.length
                          ? 'Excelente! Seus conhecimentos sobre segurança e privacidade estão consolidados.'
                          : score >= 2
                            ? 'Bom resultado! Recomendamos revisar os tópicos de ataques comuns e engenharia social.'
                            : 'Recomendamos estudar as diretrizes de prevenção antes de realizar uma nova tentativa.'}
                      </p>

                      <button
                        type="button"
                        onClick={resetQuiz}
                        className="rz-btn rz-btn-primary rz-btn-block"
                      >
                        <RotateCcw size={16} />
                        <span>Refazer Avaliação</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="quiz-header-row">
                        <span style={{ color: 'var(--rz-text-secondary)', fontSize: 'var(--rz-text-sm)' }}>
                          Pergunta {quizIndex + 1} de {QUIZ.length}
                        </span>
                        <span className="rz-badge rz-badge-info">
                          {score} acertos
                        </span>
                      </div>

                      <div className="quiz-progress-track">
                        <div
                          className="quiz-progress-fill"
                          style={{ width: `${((quizIndex + (selected !== null ? 1 : 0)) / QUIZ.length) * 100}%` }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '14px 0 10px' }}>
                        <Mascot height={76} variant="question" alt="Dúvida do Mascote" />
                        <h3 className="quiz-question" style={{ margin: 0 }}>{QUIZ[quizIndex].q}</h3>
                      </div>

                      <div className="quiz-options-list">
                        {QUIZ[quizIndex].opts.map((opt, i) => {
                          const isCorrect = i === QUIZ[quizIndex].correct;
                          const isSelected = i === selected;
                          let optionClass = '';
                          if (selected !== null) {
                            if (isCorrect) optionClass = 'correct';
                            else if (isSelected) optionClass = 'incorrect';
                            else optionClass = 'disabled';
                          }
                          return (
                            <div
                              key={i}
                              onClick={() => handleAnswer(i)}
                              className={`quiz-option-btn ${optionClass}`}
                            >
                              <span>{opt}</span>
                              {selected !== null && isCorrect && (
                                <CheckCircle2 size={18} style={{ color: 'var(--rz-success)', flexShrink: 0 }} />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {selected !== null && (
                        <>
                          <div className="quiz-explanation-box">
                            <p>
                              <strong style={{ color: 'var(--rz-ice)' }}>Explicação:</strong>{' '}
                              {QUIZ[quizIndex].explain}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleNext}
                            className="rz-btn rz-btn-primary rz-btn-block"
                            style={{ marginTop: '16px' }}
                          >
                            <span>{quizIndex + 1 < QUIZ.length ? 'Próxima pergunta' : 'Ver resultado'}</span>
                            <ArrowRight size={16} />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </IonCardContent>
              </IonCard>

              {/* Painel Lateral de Direitos do Titular LGPD */}
              <aside className="rz-panel">
                <div className="rz-card-header">
                  <div className="rz-card-title-group">
                    <div className="rz-icon-tile violet">
                      <Scale />
                    </div>
                    <h3 className="rz-card-title">Direitos do Titular (LGPD)</h3>
                  </div>
                </div>
                <p className="rz-text-muted" style={{ marginBottom: '14px' }}>
                  No modelo Zero-Knowledge do RiskZero, você exerce controle técnico direto sobre seus dados:
                </p>
                <div className="rz-setting-row">
                  <div>
                    <div className="rz-row-title" style={{ fontSize: 'var(--rz-text-sm)' }}>Portabilidade Integral</div>
                    <div className="rz-row-meta">Exportação JSON cifrada e CSV padrão</div>
                  </div>
                  <span className="rz-badge rz-badge-success">Art. 18, V</span>
                </div>
                <div className="rz-setting-row">
                  <div>
                    <div className="rz-row-title" style={{ fontSize: 'var(--rz-text-sm)' }}>Eliminação &amp; Wipe Local</div>
                    <div className="rz-row-meta">Destruição criptográfica imediata</div>
                  </div>
                  <span className="rz-badge rz-badge-info">Art. 18, VI</span>
                </div>
                <div className="rz-setting-row">
                  <div>
                    <div className="rz-row-title" style={{ fontSize: 'var(--rz-text-sm)' }}>Sigilo por Design</div>
                    <div className="rz-row-meta">Chave mestra jamais sai do dispositivo</div>
                  </div>
                  <span className="rz-badge rz-badge-violet">Art. 46</span>
                </div>
              </aside>
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default EducationPage;
