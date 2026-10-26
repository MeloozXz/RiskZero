import React, { useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonSegment,
  IonSegmentButton,
  IonLabel,
} from '@ionic/react';
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  globeOutline,
  warningOutline,
} from 'ionicons/icons';
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
} from 'lucide-react';
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
    color: '#ef4444',
    badge: 'Ataque Frequente',
  },
  {
    id: 'credential_stuffing',
    title: 'Credential Stuffing',
    category: 'attacks',
    description: 'Testes automatizados com listas de senhas vazadas na internet.',
    details: 'Robôs tentam usar a mesma combinação de e-mail e senha em centenas de serviços. Se você reutiliza senhas, todas as contas ficam expostas.',
    icon: KeyRound,
    color: '#f97316',
    badge: 'Automação Maliciosa',
  },
  {
    id: 'ransomware',
    title: 'Ransomware',
    category: 'attacks',
    description: 'Sequestro de arquivos através de criptografia não autorizada.',
    details: 'Malwares bloqueiam os arquivos do seu aparelho e exigem pagamento de resgate para fornecer a chave de descriptografia.',
    icon: Lock,
    color: '#dc2626',
    badge: 'Alto Impacto',
  },
  {
    id: 'social_engineering',
    title: 'Engenharia Social',
    category: 'attacks',
    description: 'Manipulação psicológica para obter informações confidenciais.',
    details: 'Criminosos ganham a confiança da vítima fingindo ser suporte técnico, conhecidos ou autoridades para obter códigos e senhas.',
    icon: UserX,
    color: '#eab308',
    badge: 'Manipulação',
  },
  {
    id: 'mitm',
    title: 'Man-in-the-Middle (MitM)',
    category: 'attacks',
    description: 'Interceptação clandestina de dados transmitidos na rede.',
    details: 'Um atacante se posiciona entre o seu aparelho e o roteador/servidor, capturando senhas e mensagens enviadas sem criptografia.',
    icon: Network,
    color: '#a855f7',
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
    color: '#10b981',
    badge: 'Proteção Essencial',
  },
  {
    id: 'password_manager',
    title: 'Gerenciador de Senhas',
    category: 'prevention',
    description: 'Armazenamento seguro e geração de chaves únicas por serviço.',
    details: 'Cria senhas aleatórias e fortes para cada cadastro e as protege com criptografia Zero-Knowledge no aparelho.',
    icon: ShieldCheck,
    color: '#3b82f6',
    badge: 'Recomendado',
  },
  {
    id: 'link_verification',
    title: 'Verificação de Links (URLs)',
    category: 'prevention',
    description: 'Checagem rigorosa de domínios e certificados HTTPS antes de clicar.',
    details: 'Observe atentamente o endereço na barra do navegador. Desconfie de extensões incomuns (.xyz, .tk) ou subdomínios disfarçados.',
    icon: Globe,
    color: '#06b6d4',
    badge: 'Prevenção Ativa',
  },
  {
    id: 'vpn_public_wifi',
    title: 'Uso de VPN em Wi-Fi Público',
    category: 'prevention',
    description: 'Túnel criptografado para conexões em redes abertas de terceiros.',
    details: 'Redes públicas em cafés, hotéis ou aeroportos podem ser monitoradas. A VPN esconde seu tráfego de olhares indiscretos.',
    icon: Wifi,
    color: '#6366f1',
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
    color: '#ec4899',
    badge: 'Privacidade Nativa',
  },
  {
    id: 'auto_lock',
    title: 'Auto-Lock por Inatividade',
    category: 'practices',
    description: 'Bloqueio automático e imediato após período sem uso do app.',
    details: 'Protege seus dados caso você esqueça o celular desbloqueado sobre a mesa ou se o aparelho for tomado rapidamente.',
    icon: Timer,
    color: '#f59e0b',
    badge: 'Defesa de Sessão',
  },
  {
    id: 'encrypted_backups',
    title: 'Backups Criptografados',
    category: 'practices',
    description: 'Cópias de segurança protegidas com chave derivada da Senha Mestra.',
    details: 'Assegura a recuperação completa das credenciais em novo dispositivo sem expor os dados aos servidores em nuvem.',
    icon: Database,
    color: '#14b8a6',
    badge: 'Continuidade',
  },
  {
    id: 'system_updates',
    title: 'Atualizações do Sistema',
    category: 'practices',
    description: 'Correção contínua de falhas de segurança no sistema operacional.',
    details: 'Instalar atualizações do Android/iOS e aplicativos corrige brechas e vulnerabilidades conhecidas (Zero-Day).',
    icon: RefreshCw,
    color: '#8b5cf6',
    badge: 'Higiene Digital',
  },
];

// ────────────────────────────────────────
// Quiz de Privacidade
// ────────────────────────────────────────
const QUIZ = [
  {
    q: 'O que é um golpe de phishing?',
    opts: ['Um vírus de computador comum', 'Um golpe com links ou e-mails falsos para roubar dados confidenciais', 'Tentativa de adivinhar sua senha mestra', 'Problemas com o sinal de internet'],
    correct: 1,
    explain: 'Golpes de phishing fingem ser comunicações legítimas para enganar você e obter credenciais ou dados sigilosos.',
  },
  {
    q: 'Qual o tamanho recomendado para uma senha segura?',
    opts: ['Pelo menos 6 caracteres', 'Pelo menos 8 caracteres', 'No mínimo 12 a 16 caracteres', 'Apenas 4 números'],
    correct: 2,
    explain: 'Senhas longas (a partir de 12 caracteres) tornam o trabalho de invasores praticamente impossível usando computadores convencionais.',
  },
  {
    q: 'O que indica o "https://" no início do endereço de um site?',
    opts: ['Indica que o site é do governo', 'Garante que os dados enviados ao site viajam criptografados e protegidos', 'Significa que o site é totalmente imune a golpes', 'Significa que o site não armazena cookies'],
    correct: 1,
    explain: 'O HTTPS garante uma conexão segura e criptografada entre você e o site, impedindo que outros vejam o que você está enviando.',
  },
  {
    q: 'Quais são seus direitos segundo a LGPD?',
    opts: ['Usar internet gratuita em locais públicos', 'Visualizar, corrigir e pedir para excluir seus dados pessoais das empresas', 'Proteção automática e gratuita contra vírus', 'Garantia de que senhas nunca expiram'],
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

  const handleAnswer = (optIdx: number) => {
    if (selected !== null) return;
    setSelected(optIdx);
    const correct = QUIZ[quizIndex].correct === optIdx;
    if (correct) setScore(s => s + 1);
  };

  const handleNext = () => {
    if (quizIndex + 1 >= QUIZ.length) {
      setQuizDone(true);
    } else {
      setQuizIndex(i => i + 1);
      setSelected(null);
    }
  };

  const resetQuiz = () => { setQuizIndex(0); setSelected(null); setScore(0); setQuizDone(false); };

  // Filtra os tópicos de acordo com a aba selecionada
  const currentTopics = EDUCATIONAL_TOPICS.filter(t => t.category === segment);

  return (
    <IonPage className="education-page">
      <IonHeader className="ion-no-border">
        <IonToolbar className="education-toolbar">
          <IonTitle className="education-title">Central de Aprendizado</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="education-content">
        {/* Navegação por Abas (Segmented Controls/Pills) */}
        <div className="education-header-container">
          <IonSegment
            value={segment}
            onIonChange={e => {
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
            ].map(s => (
              <IonSegmentButton key={s.val} value={s.val} className="education-segment-btn">
                <IonLabel>{s.label}</IonLabel>
              </IonSegmentButton>
            ))}
          </IonSegment>
        </div>

        <div className="education-tab-container">

          {/* ── SEÇÃO DE CARDS EDUCATIVOS (Ataques Comuns / Como Evitar / Boas Práticas) ── */}
          {(segment === 'attacks' || segment === 'prevention' || segment === 'practices') && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentTopics.map((topic) => {
                const IconComponent = topic.icon;
                return (
                  <div
                    key={topic.id}
                    className="group bg-slate-900/60 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 hover:shadow-xl transition-all duration-300 backdrop-blur-md flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center border border-white/5 transition-transform duration-300 group-hover:scale-105"
                          style={{ background: `${topic.color}15` }}
                        >
                          <IconComponent style={{ color: topic.color, width: 24, height: 24 }} />
                        </div>
                        <span
                          className="text-[11px] font-bold px-3 py-1 rounded-full border border-white/5 uppercase tracking-wider"
                          style={{ color: topic.color, backgroundColor: `${topic.color}10` }}
                        >
                          {topic.badge}
                        </span>
                      </div>

                      <h3 className="text-slate-100 font-extrabold text-lg mb-2 group-hover:text-cyan-400 transition-colors">
                        {topic.title}
                      </h3>

                      <p className="text-slate-400 text-sm font-medium leading-relaxed mb-3">
                        {topic.description}
                      </p>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 mt-2 text-xs text-slate-300 leading-normal">
                      <strong className="text-slate-200 block mb-1">Como funciona</strong>
                      {topic.details}
                    </div>
                  </div>
                );
              })}
            </div>
          )}


          {/* ── QUIZ DE PRIVACIDADE ── */}
          {segment === 'quiz' && (
            <div className="max-w-2xl mx-auto w-full">
              <IonCard className="quiz-card">
                <IonCardContent style={{ padding: '20px' }}>
                  {quizDone ? (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(96, 165, 250, 0.1)', border: '1px solid rgba(96, 165, 250, 0.25)', marginBottom: '16px', color: '#60a5fa' }}>
                        {score === QUIZ.length ? <Trophy size={42} color="#fbbf24" /> : score >= 2 ? <Award size={42} color="#60a5fa" /> : <BookOpen size={42} color="#94a3b8" />}
                      </div>
                      <div style={{ color: '#f1f5f9', fontSize: '1.35rem', fontWeight: '800', letterSpacing: '-0.3px' }}>
                        {score} de {QUIZ.length} acertos
                      </div>
                      <div style={{ color: '#94a3b8', marginTop: '8px', marginBottom: '24px', fontSize: '0.9rem', fontWeight: '500', lineHeight: '1.5' }}>
                        {score === QUIZ.length ? 'Excelente! Seus conhecimentos sobre segurança e privacidade estão consolidados.' : score >= 2 ? 'Bom resultado! Recomendamos revisar os tópicos de ataques comuns e engenharia social.' : 'Recomendamos estudar as diretrizes de prevenção antes de realizar uma nova tentativa.'}
                      </div>
                      <IonButton expand="block" onClick={resetQuiz} className="cyber-btn" color="primary">
                        Refazer Avaliação
                      </IonButton>
                    </div>
                  ) : (
                    <>
                      <div className="quiz-header-row">
                        <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                          Pergunta {quizIndex + 1} de {QUIZ.length}
                        </span>
                        <span style={{ color: '#3b82f6', fontSize: '0.82rem' }}>
                          {score} acertos
                        </span>
                      </div>

                      <div className="quiz-progress-track">
                        <div className="quiz-progress-fill" style={{ width: `${((quizIndex) / QUIZ.length) * 100}%` }} />
                      </div>

                      <h3 className="quiz-question">
                        {QUIZ[quizIndex].q}
                      </h3>

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
                            <div key={i} onClick={() => handleAnswer(i)} className={`quiz-option-btn ${optionClass}`}>
                              <span>{opt}</span>
                            </div>
                          );
                        })}
                      </div>

                      {selected !== null && (
                        <>
                          <div className="quiz-explanation-box">
                            <p>
                              <strong style={{ color: '#60a5fa' }}>Explicação:</strong> {QUIZ[quizIndex].explain}
                            </p>
                          </div>
                          <IonButton expand="block" onClick={handleNext} className="cyber-btn" color="primary" style={{ marginTop: '16px' }}>
                            {quizIndex + 1 < QUIZ.length ? 'Próxima pergunta' : 'Ver resultado'}
                          </IonButton>
                        </>
                      )}
                    </>
                  )}
                </IonCardContent>
              </IonCard>
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default EducationPage;
