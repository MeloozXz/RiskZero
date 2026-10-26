import { VaultService } from './vault';
import { SessionService } from './session';
import { StorageService } from './storage';
import { VaultCategory } from '../types';

export interface ParsedImportItem {
  title: string;
  username: string;
  password: string;
  url: string;
  notes?: string;
  category?: VaultCategory;
  totpSecret?: string;
}

export type SupportedImportFormat = 'BITWARDEN' | 'ONE_PASSWORD' | 'CHROME' | 'LASTPASS' | 'GENERIC';

/**
 * Parser robusto de CSV em conformidade com RFC 4180 (suporta campos entre aspas, vírgulas internas e quebras de linha).
 */
export function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // pula a aspa duplicada
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // consome \r\n
      }
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.some((f) => f.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export const ImporterService = {
  /**
   * Detecta o formato do CSV baseado nas colunas do cabeçalho.
   */
  detectFormat(headers: string[]): SupportedImportFormat {
    const normalized = headers.map((h) => h.toLowerCase().trim().replace(/['"]/g, ''));
    
    if (normalized.includes('login_uri') || normalized.includes('login_username') || normalized.includes('login_totp')) {
      return 'BITWARDEN';
    }
    if (normalized.includes('website') && normalized.includes('title')) {
      return 'ONE_PASSWORD';
    }
    if (normalized.includes('name') && normalized.includes('url') && normalized.includes('password')) {
      return 'CHROME';
    }
    if (normalized.includes('grouping') || normalized.includes('fav')) {
      return 'LASTPASS';
    }
    return 'GENERIC';
  },

  /**
   * Faz o parse das linhas do CSV convertendo para a estrutura do SeguranApp.
   */
  parseCSVToItems(csvContent: string): { format: SupportedImportFormat; items: ParsedImportItem[] } {
    const rows = parseCSV(csvContent);
    if (rows.length < 2) {
      throw new Error('O arquivo CSV está vazio ou não possui registros válidos.');
    }

    const headerRow = rows[0].map((h) => h.toLowerCase().trim().replace(/['"]/g, ''));
    const format = this.detectFormat(headerRow);
    const items: ParsedImportItem[] = [];

    const getCol = (row: string[], colNames: string[]): string => {
      for (const name of colNames) {
        const idx = headerRow.indexOf(name);
        if (idx !== -1 && row[idx] !== undefined) {
          return row[idx].trim();
        }
      }
      return '';
    };

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 0 || row.every((c) => !c.trim())) continue;

      let title = '';
      let username = '';
      let password = '';
      let url = '';
      let notes = '';
      let totpSecret = '';
      let category: VaultCategory = 'LOGIN';

      switch (format) {
        case 'BITWARDEN':
          title = getCol(row, ['name', 'title']) || 'Sem Título';
          username = getCol(row, ['login_username', 'username']);
          password = getCol(row, ['login_password', 'password']);
          url = getCol(row, ['login_uri', 'url']);
          notes = getCol(row, ['notes']);
          totpSecret = getCol(row, ['login_totp', 'totp']);
          break;

        case 'ONE_PASSWORD':
          title = getCol(row, ['title', 'name']) || 'Sem Título';
          username = getCol(row, ['username', 'login']);
          password = getCol(row, ['password']);
          url = getCol(row, ['website', 'url', 'login_url']);
          notes = getCol(row, ['notes']);
          break;

        case 'CHROME':
          title = getCol(row, ['name', 'title']) || getCol(row, ['url']) || 'Credencial Chrome';
          username = getCol(row, ['username', 'login']);
          password = getCol(row, ['password']);
          url = getCol(row, ['url']);
          notes = getCol(row, ['note', 'notes']);
          break;

        case 'LASTPASS':
          title = getCol(row, ['name', 'title']) || 'Sem Título';
          username = getCol(row, ['username']);
          password = getCol(row, ['password']);
          url = getCol(row, ['url']);
          notes = getCol(row, ['extra', 'notes']);
          break;

        case 'GENERIC':
        default:
          title = getCol(row, ['title', 'name', 'serviço', 'servico']) || 'Sem Título';
          username = getCol(row, ['username', 'user', 'usuario', 'usuário', 'email', 'login']);
          password = getCol(row, ['password', 'senha', 'pass']);
          url = getCol(row, ['url', 'site', 'website', 'link']);
          notes = getCol(row, ['notes', 'notas', 'observações', 'observacoes', 'obs']);
          totpSecret = getCol(row, ['totp', '2fa', 'token', 'secret']);
          const catRaw = getCol(row, ['category', 'categoria']).toUpperCase();
          if (catRaw.includes('CARD') || catRaw.includes('CART')) category = 'CARD';
          else if (catRaw.includes('NOTE') || catRaw.includes('NOTA')) category = 'NOTE';
          else if (catRaw.includes('ID') || catRaw.includes('IDENT')) category = 'IDENTITY';
          break;
      }

      if (title || username || password) {
        items.push({
          title: title || 'Credencial Importada',
          username: username || '',
          password: password || '',
          url: url || '',
          notes: notes || undefined,
          category,
          totpSecret: totpSecret || undefined,
        });
      }
    }

    return { format, items };
  },

  /**
   * Importa e encripta todas as credenciais diretamente no cofre ativo do usuário.
   */
  async importItemsToVault(items: ParsedImportItem[]): Promise<{ importedCount: number }> {
    let count = 0;
    for (const item of items) {
      await VaultService.create({
        title: item.title,
        username: item.username,
        password: item.password,
        url: item.url,
        notes: item.notes,
        category: item.category || 'LOGIN',
        totpSecret: item.totpSecret,
      });
      count++;
    }

    const email = SessionService.getActiveUserEmail() || '';
    await StorageService.addAuditLog(
      email,
      'VAULT_IMPORTED',
      `Importação concluída: ${count} credenciais criptografadas Zero-Knowledge com sucesso.`
    );

    return { importedCount: count };
  },

  /**
   * Exporta todas as credenciais do cofre em formato CSV.
   * Exige reautenticação com a Senha Mestra para mitigar exfiltração não autorizada (A-5).
   */
  async exportVaultToCSV(masterPassword?: string): Promise<string> {
    const email = SessionService.getActiveUserEmail() || '';
    if (!email) {
      throw new Error('Sessão expirada ou não encontrada.');
    }

    if (!masterPassword) {
      throw new Error('Reautenticação obrigatória: informe sua Senha Mestra para exportar o cofre em formato CSV.');
    }

    const authRes = await SessionService.authenticateMaster(email, masterPassword);
    if (!authRes.success) {
      throw new Error(authRes.error || 'Senha Mestra incorreta. Exportação cancelada.');
    }

    const all = await VaultService.getAll();
    const headers = ['title', 'username', 'password', 'url', 'category', 'notes', 'totp_secret'];
    
    const escapeCSV = (val: string | undefined): string => {
      if (!val) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows: string[] = [headers.join(',')];

    for (const item of all) {
      const row = [
        escapeCSV(item.title),
        escapeCSV(item.username),
        escapeCSV(item._plaintextPassword),
        escapeCSV(item.url),
        escapeCSV(item.category || 'LOGIN'),
        escapeCSV(item._plaintextNotes),
        escapeCSV(item._plaintextTotpSecret),
      ];
      rows.push(row.join(','));
    }

    await StorageService.addAuditLog(email, 'BACKUP_EXPORTED', 'Exportação de credenciais em formato CSV efetuada após reautenticação.');

    return rows.join('\n');
  },
};
