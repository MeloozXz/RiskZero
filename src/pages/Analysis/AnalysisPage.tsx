import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonPage,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  RefresherEventDetail,
} from '@ionic/react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Clock,
  Lock,
  Plus,
  Wrench,
  Activity,
} from 'lucide-react';
import { useVault } from '../../contexts/VaultContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { OrbitRing, OrbitLoader, OrbitTone } from '../../components/brand';
import './AnalysisPage.css';

interface PasswordDetail {
  id: string;
  title: string;
  username: string;
  password: string;
  isWeak: boolean;
  isDuplicated: boolean;
  isOld: boolean;
  ageDays: number;
  entropy: number;
  strengthLabel: string;
  strengthColor: string;
}

function calcEntropy(password: string): number {
  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;
  return poolSize > 0 ? Math.round(password.length * Math.log2(poolSize)) : 0;
}

function getStrength(entropy: number): { label: string; color: string; score: number } {
  if (entropy < 28)
    return { label: 'Muito Vulnerável', color: 'var(--rz-danger)', score: 0.1 };
  if (entropy < 40) return { label: 'Fraca', color: 'var(--rz-danger)', score: 0.25 };
  if (entropy < 60) return { label: 'Média', color: 'var(--rz-warning)', score: 0.5 };
  if (entropy < 80) return { label: 'Forte', color: 'var(--rz-info)', score: 0.75 };
  return { label: 'Muito Segura', color: 'var(--rz-success)', score: 1.0 };
}

export const AnalysisPage: React.FC = () => {
  const history = useHistory();
  const { items, loading, refreshVault, healthStats } = useVault();
  const [details, setDetails] = useState<PasswordDetail[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'WEAK' | 'DUPL' | 'OLD'>('ALL');

  useEffect(() => {
    if (items.length === 0) {
      setDetails([]);
      return;
    }

    const passwords = items.map((i) => i._plaintextPassword || '');
    const dupMap = new Map<string, number>();
    passwords.forEach((p) => dupMap.set(p, (dupMap.get(p) ?? 0) + 1));

    const now = Date.now();
    const NINETY_DAYS_MS = 90 * 86400 * 1000;

    const computed: PasswordDetail[] = items.map((item) => {
      const pwd = item._plaintextPassword || '';
      const entropy = calcEntropy(pwd);
      const { label, color } = getStrength(entropy);
      const isWeak =
        pwd.length < 12 ||
        !/[A-Z]/.test(pwd) ||
        !/[0-9]/.test(pwd) ||
        !/[^a-zA-Z0-9]/.test(pwd);
      const isDuplicated = (dupMap.get(pwd) ?? 1) > 1;
      const updatedMs = item.updatedAt ? new Date(item.updatedAt).getTime() : now;
      const ageMs = Math.max(0, now - (isNaN(updatedMs) ? now : updatedMs));
      const ageDays = Math.floor(ageMs / 86400000);
      const isOld = ageMs >= NINETY_DAYS_MS;

      return {
        id: item.id,
        title: item.title,
        username: item.username,
        password: '••••••••',
        isWeak,
        isDuplicated,
        isOld,
        ageDays,
        entropy,
        strengthLabel: label,
        strengthColor: color,
      };
    });

    setDetails(computed);
  }, [items]);

  const filtered = details.filter((d) => {
    if (filter === 'WEAK') return d.isWeak;
    if (filter === 'DUPL') return d.isDuplicated;
    if (filter === 'OLD') return d.isOld;
    return true;
  });

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    await refreshVault();
    e.detail.complete();
  };

  const totalCount = healthStats?.total ?? details.length;
  const weakCount = healthStats?.weak ?? details.filter((d) => d.isWeak).length;
  const reusedCount = healthStats?.reused ?? details.filter((d) => d.isDuplicated).length;
  const strongCount =
    healthStats?.strongCount ??
    details.filter((d) => !d.isWeak && !d.isDuplicated).length;
  const oldCount = details.filter((d) => d.isOld).length;

  const secureScore =
    totalCount > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(((totalCount - weakCount - reusedCount) / totalCount) * 100)
          )
        )
      : 0;

  const scoreTone: OrbitTone =
    totalCount === 0
      ? 'muted'
      : secureScore >= 70
        ? 'success'
        : secureScore >= 40
          ? 'warning'
          : 'danger';

  const isCleanHealthState = totalCount > 0 && weakCount === 0 && reusedCount === 0;

  return (
    <IonPage className="rz-page">
      <IonContent className="rz-content" fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="rz-page-container">
          <PageHeader
            eyebrow="Diagnóstico Criptográfico"
            title="Saúde das Senhas"
            subtitle="Avaliação local de entropia de Shannon (bits), detecção de reutilização entre serviços e alerta de rotação."
            actions={
              <button
                type="button"
                className="rz-btn rz-btn-secondary"
                onClick={() => refreshVault()}
              >
                <RefreshCw size={15} />
                <span>Reavaliar Cofre</span>
              </button>
            }
          />

          {/* ==================== PAINEL HERO: SCORE GERAL COM ORBITRING ==================== */}
          <section
            className="rz-panel rz-meridian-bg analysis-hero"
            aria-label="Pontuação geral de saúde das senhas"
          >
            <div className="analysis-hero-left">
              <OrbitRing
                size={124}
                stroke={7}
                spinning={loading}
                value={loading ? undefined : secureScore}
                tone={scoreTone}
                globe
                label={`Pontuação Geral de Segurança: ${secureScore}%`}
              >
                <span
                  className="rz-num"
                  style={{
                    fontSize: '2rem',
                    fontWeight: 800,
                    lineHeight: 1,
                    color:
                      scoreTone === 'success'
                        ? 'var(--rz-success)'
                        : scoreTone === 'warning'
                          ? 'var(--rz-warning)'
                          : scoreTone === 'danger'
                            ? 'var(--rz-danger)'
                            : 'var(--rz-text-primary)',
                  }}
                >
                  {secureScore}%
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
                  Score
                </span>
              </OrbitRing>

              <div className="analysis-hero-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    className={`rz-badge ${
                      scoreTone === 'success'
                        ? 'rz-badge-success'
                        : scoreTone === 'warning'
                          ? 'rz-badge-warning'
                          : scoreTone === 'danger'
                            ? 'rz-badge-danger'
                            : 'rz-badge-neutral'
                    }`}
                  >
                    <Activity size={12} />
                    <span>
                      {totalCount === 0
                        ? 'Cofre Vazio'
                        : secureScore >= 80
                          ? 'Postura Excelente'
                          : secureScore >= 50
                            ? 'Atenção Necessária'
                            : 'Risco Elevado'}
                    </span>
                  </span>
                  <span className="rz-badge rz-badge-neutral rz-font-mono">
                    {totalCount} {totalCount === 1 ? 'Credencial' : 'Credenciais'} no Cofre
                  </span>
                </div>

                <h2 className="analysis-hero-title">Pontuação Geral de Segurança</h2>
                <p className="rz-text-muted" style={{ maxWidth: '60ch' }}>
                  A análise de entropia é executada 100% em memória RAM local (Zero-Knowledge), verificando comprimento, diversidade de caracteres e colisão de hashes.
                </p>

                <div className="rz-meter" style={{ maxWidth: 420, marginTop: 6 }}>
                  <span
                    style={{
                      width: `${secureScore}%`,
                      background:
                        scoreTone === 'success'
                          ? 'var(--rz-success)'
                          : scoreTone === 'warning'
                            ? 'var(--rz-warning)'
                            : 'var(--rz-danger)',
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ==================== FAIXA DE MÉTRICAS (.rz-metrics) ==================== */}
          <section className="rz-metrics" aria-label="Resumo da saúde das senhas">
            <div className="rz-metric">
              <span className="rz-stat-label">Fortes</span>
              <div
                className="rz-stat-value rz-num"
                style={{ color: 'var(--rz-success)' }}
              >
                {strongCount}
              </div>
              <span className="rz-help">Alta entropia e exclusivas</span>
            </div>

            <div className="rz-metric">
              <span className="rz-stat-label">Fracas</span>
              <div
                className="rz-stat-value rz-num"
                style={{
                  color: weakCount > 0 ? 'var(--rz-danger)' : 'var(--rz-text-primary)',
                }}
              >
                {weakCount}
              </div>
              <span className="rz-help">Baixa complexidade / curtas</span>
            </div>

            <div className="rz-metric">
              <span className="rz-stat-label">Reutilizadas</span>
              <div
                className="rz-stat-value rz-num"
                style={{
                  color: reusedCount > 0 ? 'var(--rz-warning)' : 'var(--rz-text-primary)',
                }}
              >
                {reusedCount}
              </div>
              <span className="rz-help">Repetidas em múltiplas contas</span>
            </div>

            <div className="rz-metric">
              <span className="rz-stat-label">Antigas</span>
              <div
                className="rz-stat-value rz-num"
                style={{
                  color: oldCount > 0 ? 'var(--rz-ice)' : 'var(--rz-text-primary)',
                }}
              >
                {oldCount}
              </div>
              <span className="rz-help">Sem rotação há &gt; 90 dias</span>
            </div>
          </section>

          {/* ==================== ESTADO IMPECÁVEL COM MASCOTE ==================== */}
          {!loading && isCleanHealthState && (
            <section className="rz-panel" style={{ marginTop: 20 }}>
              <EmptyState
                mascot
                mascotHeight={165}
                title="Saúde Criptográfica Impecável"
                description="Tudo limpo! Nenhuma senha fraca ou repetida foi detectada no seu cofre. Suas credenciais possuem alta entropia e exclusividade."
              />
            </section>
          )}

          {/* ==================== FILTROS E LISTA DENSA DE REMEDIAÇÃO ==================== */}
          <div className="analysis-toolbar-row">
            <h2 className="rz-section-title">
              <span>Diagnóstico por Credencial</span>
              <span className="rz-count">{filtered.length} ITENS</span>
            </h2>

            <div className="rz-scroll-x" role="tablist" aria-label="Filtrar credenciais">
              {(
                [
                  { id: 'ALL', label: `Todas (${details.length})` },
                  { id: 'WEAK', label: `Fracas (${weakCount})` },
                  { id: 'DUPL', label: `Repetidas (${reusedCount})` },
                  { id: 'OLD', label: `Antigas (${oldCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`rz-chip ${filter === tab.id ? 'is-active' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="rz-panel">
              <OrbitLoader label="Avaliando senhas..." />
            </div>
          ) : details.length === 0 ? (
            <div className="rz-panel">
              <EmptyState
                icon={<Lock size={22} />}
                title="Nenhuma senha no cofre."
                description="Adicione credenciais ao seu cofre para iniciar o diagnóstico criptográfico de força, entropia e reutilização."
                action={
                  <button
                    type="button"
                    className="rz-btn rz-btn-primary"
                    onClick={() => history.push('/vault/add')}
                  >
                    <Plus size={16} />
                    <span>Nova Credencial</span>
                  </button>
                }
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rz-panel">
              <EmptyState
                mascot
                mascotHeight={165}
                title="Tudo limpo! Nenhuma senha fraca ou repetida."
                description="Nenhuma credencial corresponde a este filtro de vulnerabilidade. Sua postura está protegida."
                action={
                  <button
                    type="button"
                    className="rz-btn rz-btn-secondary rz-btn-sm"
                    onClick={() => setFilter('ALL')}
                  >
                    <span>Mostrar Todas as Credenciais</span>
                  </button>
                }
              />
            </div>
          ) : (
            <div className="rz-list">
              {filtered.map((item) => {
                const stateClass = item.isWeak
                  ? 'is-weak'
                  : item.isDuplicated
                    ? 'is-reused'
                    : 'is-strong';
                const iconClass = item.isWeak
                  ? 'danger'
                  : item.isDuplicated
                    ? 'warning'
                    : 'success';

                return (
                  <div key={item.id} className={`analysis-cred-row ${stateClass}`}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 14,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <div className={`rz-icon-tile ${iconClass}`} style={{ marginTop: 2 }}>
                        {item.isWeak ? (
                          <ShieldAlert />
                        ) : item.isDuplicated ? (
                          <AlertTriangle />
                        ) : (
                          <ShieldCheck />
                        )}
                      </div>

                      <div className="analysis-cred-main">
                        <div className="analysis-cred-head">
                          <span className="analysis-cred-title">{item.title}</span>
                          {item.isWeak && (
                            <span className="rz-badge rz-badge-danger">Senha Fraca</span>
                          )}
                          {item.isDuplicated && (
                            <span className="rz-badge rz-badge-warning">Senha Repetida</span>
                          )}
                          {item.isOld && (
                            <span className="rz-badge rz-badge-blue">
                              <Clock size={11} />
                              {item.ageDays}d sem trocar
                            </span>
                          )}
                          {!item.isWeak && !item.isDuplicated && (
                            <span className="rz-badge rz-badge-success">Forte</span>
                          )}
                        </div>

                        <div className="analysis-cred-meta">
                          <span
                            style={{
                              fontWeight: 700,
                              color: item.strengthColor,
                            }}
                          >
                            {item.strengthLabel}
                          </span>
                          <span>•</span>
                          <span className="rz-font-mono">
                            Entropia: {item.entropy} bits
                          </span>
                          {item.username && (
                            <>
                              <span>•</span>
                              <span className="rz-truncate">{item.username}</span>
                            </>
                          )}
                        </div>

                        <div className="rz-meter analysis-entropy-bar">
                          <span
                            style={{
                              width: `${Math.min(100, Math.max(8, item.entropy))}%`,
                              background: item.strengthColor,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => history.push(`/vault/edit/${item.id}`)}
                        className={`rz-btn rz-btn-sm ${
                          item.isWeak || item.isDuplicated
                            ? 'rz-btn-primary'
                            : 'rz-btn-secondary'
                        }`}
                      >
                        <Wrench size={14} />
                        <span>Melhorar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};
