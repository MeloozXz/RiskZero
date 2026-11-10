import React from 'react';
import { IonModal } from '@ionic/react';
import { AlertTriangle, Trash2, Info } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  const isDanger = variant === 'danger';

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onCancel}
      style={{
        '--background': '#121215',
        '--border-radius': '12px',
        '--width': '92%',
        '--max-width': '420px',
        '--height': 'fit-content',
      }}
    >
      <div
        style={{
          padding: '24px',
          background: '#121215',
          border: '1px solid #27272a',
          borderRadius: '12px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: isDanger ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
              border: `1px solid ${isDanger ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              color: isDanger ? '#ef4444' : '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isDanger ? <Trash2 size={20} /> : variant === 'warning' ? <AlertTriangle size={20} /> : <Info size={20} />}
          </div>
          <div>
            <h3
              style={{
                margin: '0 0 6px 0',
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#fafafa',
                letterSpacing: '-0.015em',
              }}
            >
              {title}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: '0.825rem',
                color: '#a1a1aa',
                lineHeight: 1.5,
              }}
            >
              {message}
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid #27272a',
          }}
        >
          <button
            type="button"
            className="rz-btn rz-btn-secondary"
            onClick={onCancel}
            style={{ minWidth: '90px' }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`rz-btn ${isDanger ? 'rz-btn-danger' : 'rz-btn-primary'}`}
            onClick={onConfirm}
            style={{ minWidth: '110px' }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </IonModal>
  );
};

