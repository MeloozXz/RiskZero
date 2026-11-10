import React, { useState, useEffect, useCallback } from 'react';
import {
  IonRange,
  IonToggle,
  IonToast,
} from '@ionic/react';
import { Copy, RefreshCw, ShieldCheck, Check } from 'lucide-react';
import { Clipboard } from '@capacitor/clipboard';

interface PasswordGeneratorProps {
  onSelectPassword?: (password: string) => void;
}

export const PasswordGenerator: React.FC<PasswordGeneratorProps> = ({ onSelectPassword }) => {
  const [password, setPassword] = useState('');
  const [length, setLength] = useState(16);
  const [useUppercase, setUseUppercase] = useState(true);
  const [useLowercase, setUseLowercase] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [entropy, setEntropy] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const generatePassword = useCallback(() => {
    let charset = '';
    if (useUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (useLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (useNumbers) charset += '0123456789';
    if (useSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!charset) {
      setPassword('');
      setEntropy(0);
      return;
    }

    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);

    let generated = '';
    for (let i = 0; i < length; i++) {
      generated += charset[array[i] % charset.length];
    }

    // Garante variedade: inclui pelo menos um caractere de cada tipo selecionado
    const adjusted = generated.split('');
    const ensureChar = (set: string) => {
      const idx = adjusted.findIndex((c) => set.includes(c));
      if (idx === -1) {
        const randIndex = Math.floor(Math.random() * length);
        const randCharIndex = Math.floor(Math.random() * set.length);
        adjusted[randIndex] = set[randCharIndex];
      }
    };

    if (useUppercase) ensureChar('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    if (useLowercase) ensureChar('abcdefghijklmnopqrstuvwxyz');
    if (useNumbers) ensureChar('0123456789');
    if (useSymbols) ensureChar('!@#$%^&*()_+-=[]{}|;:,.<>?');

    const finalPass = adjusted.join('');
    setPassword(finalPass);

    // Calcula a pontuação de segurança (bits de entropia)
    const poolSize = charset.length;
    const computedEntropy = length * Math.log2(poolSize);
    setEntropy(Math.round(computedEntropy));
  }, [length, useUppercase, useLowercase, useNumbers, useSymbols]);

  useEffect(() => {
    generatePassword();
  }, [generatePassword]);

  const copyToClipboard = async () => {
    if (!password) return;
    try {
      await Clipboard.write({ string: password });
      setToastMessage('Senha copiada! Pronta para colar.');
      setShowToast(true);
    } catch (e) {
      console.error(e);
    }
  };

  const getStrengthLabel = () => {
    if (entropy < 40) return { label: 'Muito fraca', color: 'var(--rz-danger)', badge: 'rz-badge-danger', percentage: 20 };
    if (entropy < 60) return { label: 'Fraca', color: 'var(--rz-warning)', badge: 'rz-badge-warning', percentage: 40 };
    if (entropy < 80) return { label: 'Razoável', color: 'var(--rz-info)', badge: 'rz-badge-blue', percentage: 65 };
    if (entropy < 100) return { label: 'Forte', color: 'var(--rz-success)', badge: 'rz-badge-success', percentage: 85 };
    return { label: 'Excelente', color: 'var(--rz-success)', badge: 'rz-badge-success', percentage: 100 };
  };

  const strength = getStrengthLabel();

  return (
    <div
      style={{
        background: 'var(--rz-bg-elevated)',
        color: 'var(--rz-text-primary)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="rz-icon-tile">
            <ShieldCheck />
          </span>
          <div>
            <h3
              style={{
                fontFamily: 'var(--rz-font-display)',
                fontSize: '1.25rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                color: 'var(--rz-text-primary)',
                margin: 0,
              }}
            >
              Gerador CSPRNG
            </h3>
            <span style={{ fontSize: 'var(--rz-text-xs)', color: 'var(--rz-text-muted)' }}>
              Entropia criptográfica WebCrypto API
            </span>
          </div>
        </div>
        <span className={`rz-badge ${strength.badge}`}>{strength.label}</span>
      </div>

      {/* Poço da Senha Gerada */}
      <div
        style={{
          background: 'var(--rz-bg-deep)',
          border: '1px solid var(--rz-border)',
          borderRadius: 'var(--rz-radius-sm)',
          padding: '14px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          className="rz-font-mono"
          style={{
            fontSize: password.length > 24 ? '0.95rem' : '1.125rem',
            fontWeight: 600,
            color: password ? 'var(--rz-ice)' : 'var(--rz-text-muted)',
            wordBreak: 'break-all',
            flex: 1,
            letterSpacing: '0.04em',
            userSelect: 'all',
          }}
        >
          {password || 'Selecione ao menos uma opção'}
        </span>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            className="rz-icon-btn is-bordered"
            onClick={generatePassword}
            title="Gerar nova senha"
            aria-label="Gerar nova senha"
          >
            <RefreshCw />
          </button>
          <button
            type="button"
            className="rz-icon-btn is-bordered"
            onClick={copyToClipboard}
            title="Copiar senha"
            aria-label="Copiar senha"
            style={{ color: 'var(--rz-success)' }}
          >
            <Copy />
          </button>
        </div>
      </div>

      {/* Indicador de Força & Entropia */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ color: 'var(--rz-text-secondary)', fontSize: 'var(--rz-text-xs)' }}>
            Segurança: <strong style={{ color: strength.color }}>{strength.label}</strong>
          </span>
          <span style={{ color: 'var(--rz-text-secondary)', fontSize: 'var(--rz-text-xs)' }}>
            Entropia: <strong className="rz-font-mono" style={{ color: 'var(--rz-text-primary)' }}>{entropy} bits</strong>
          </span>
        </div>
        <div className="rz-meter">
          <span style={{ width: `${strength.percentage}%`, background: strength.color }} />
        </div>
      </div>

      {/* Configurações do Gerador */}
      <div
        style={{
          background: 'var(--rz-bg-deep)',
          border: '1px solid var(--rz-border)',
          borderRadius: 'var(--rz-radius-sm)',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ paddingBottom: 10, borderBottom: '1px solid var(--rz-border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontSize: 'var(--rz-text-sm)', fontWeight: 600, color: 'var(--rz-text-primary)' }}>
              Quantidade de caracteres
            </span>
            <span
              className="rz-num"
              style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                color: 'var(--rz-ice)',
              }}
            >
              {length}
            </span>
          </div>
          <IonRange
            min={8}
            max={64}
            value={length}
            onIonInput={(e) => setLength(e.detail.value as number)}
          />
        </div>

        <div className="rz-setting-row" style={{ padding: '10px 0' }}>
          <span style={{ fontSize: 'var(--rz-text-sm)', fontWeight: 600, color: 'var(--rz-text-primary)' }}>
            Maiúsculas (A-Z)
          </span>
          <IonToggle checked={useUppercase} onIonChange={(e) => setUseUppercase(e.detail.checked)} />
        </div>

        <div className="rz-setting-row" style={{ padding: '10px 0' }}>
          <span style={{ fontSize: 'var(--rz-text-sm)', fontWeight: 600, color: 'var(--rz-text-primary)' }}>
            Minúsculas (a-z)
          </span>
          <IonToggle checked={useLowercase} onIonChange={(e) => setUseLowercase(e.detail.checked)} />
        </div>

        <div className="rz-setting-row" style={{ padding: '10px 0' }}>
          <span style={{ fontSize: 'var(--rz-text-sm)', fontWeight: 600, color: 'var(--rz-text-primary)' }}>
            Números (0-9)
          </span>
          <IonToggle checked={useNumbers} onIonChange={(e) => setUseNumbers(e.detail.checked)} />
        </div>

        <div className="rz-setting-row" style={{ padding: '10px 0', borderBottom: 0 }}>
          <span style={{ fontSize: 'var(--rz-text-sm)', fontWeight: 600, color: 'var(--rz-text-primary)' }}>
            Símbolos (!@#$)
          </span>
          <IonToggle checked={useSymbols} onIonChange={(e) => setUseSymbols(e.detail.checked)} />
        </div>
      </div>

      {onSelectPassword && (
        <button
          type="button"
          className="rz-btn rz-btn-primary rz-btn-block"
          onClick={() => onSelectPassword(password)}
          disabled={!password}
        >
          <Check size={16} />
          <span>Usar esta Senha</span>
        </button>
      )}

      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message={toastMessage}
        duration={2000}
        color="dark"
        position="bottom"
      />
    </div>
  );
};
