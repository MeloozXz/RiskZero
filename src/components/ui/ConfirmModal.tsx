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

/**
 * Diálogo de confirmação. No desktop é um diálogo centralizado;
 * no celular vira uma folha ancorada na base (estilos em .rz-dialog).
 */
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
  const tone = variant === 'danger' ? 'danger' : variant === 'warning' ? 'warning' : '';
  const Icon = variant === 'danger' ? Trash2 : variant === 'warning' ? AlertTriangle : Info;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onCancel} className="rz-dialog">
      <div className="rz-dialog-body" role="alertdialog" aria-labelledby="rz-confirm-title" aria-describedby="rz-confirm-text">
        <div className="rz-dialog-head">
          <div className={`rz-icon-tile lg ${tone}`}>
            <Icon />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 id="rz-confirm-title" className="rz-dialog-title">
              {title}
            </h3>
            <p id="rz-confirm-text" className="rz-dialog-text">
              {message}
            </p>
          </div>
        </div>

        <div className="rz-dialog-actions">
          <button type="button" className="rz-btn rz-btn-secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`rz-btn ${variant === 'danger' ? 'rz-btn-danger' : 'rz-btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </IonModal>
  );
};
