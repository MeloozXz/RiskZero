import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface TotpQrCodeProps {
  /** E-mail exibido no app autenticador */
  account: string;
  /** Segredo Base32 do TOTP */
  secret: string;
  /** Tamanho em pixels */
  size?: number;
  alt?: string;
  className?: string;
}

/**
 * Gera o QR Code do Google Authenticator 100% localmente (Zero-Knowledge).
 * O segredo TOTP nunca é enviado a serviços externos de geração de QR Code.
 */
export const TotpQrCode: React.FC<TotpQrCodeProps> = ({ account, secret, size = 160, alt = 'QR Code 2FA', className }) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const uri = `otpauth://totp/RiskZero:${encodeURIComponent(account)}?secret=${secret}&issuer=RiskZero`;
    QRCode.toDataURL(uri, { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [account, secret, size]);

  if (!dataUrl) {
    return <div className={className} style={{ width: size, height: size }} aria-label="Gerando QR Code" />;
  }

  return <img src={dataUrl} width={size} height={size} alt={alt} className={className} />;
};

