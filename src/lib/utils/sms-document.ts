/** Private storage format. The composer renders these parts as text and protected chips. */
export const SMS_DOCUMENT_PREFIX = 'trinity-sms-v1:';
export const SMS_FIELDS = [
  ['pupil_name', 'Pupil name'], ['guardian_name', 'Guardian name'], ['class', 'Class'],
  ['admission_number', 'Admission number'], ['schoolpay_code', 'SchoolPay code'],
  ['fee_item', 'Fee item'], ['total_fees', 'Total fees'], ['amount_paid', 'Amount paid'],
  ['balance', 'Balance'], ['term', 'Term'], ['year', 'Year'],
] as const;
export type SMSField = typeof SMS_FIELDS[number][0];
export type SMSCase = 'unchanged' | 'upper' | 'lower' | 'sentence' | 'title';
export interface SMSFieldFormat {
  textCase?: SMSCase;
  name?: 'all' | 'surname' | 'first' | 'both';
  class?: 'name' | 'code' | 'both';
  term?: 'original' | 'words' | 'number' | 'short';
  amount?: 'currency' | 'number' | 'plain';
  label?: boolean;
  year?: 'original' | 'numbers';
  omitIfMissing?: boolean;
}
export type SMSPart =
  | { type: 'text'; text: string }
  | { type: 'field'; id: string; field: SMSField; format: SMSFieldFormat }
  | { type: 'balance'; id: string; children: SMSPart[] };
export type SMSFieldPart = Extract<SMSPart, { type: 'field' }>;
export const SMS_FEE_FIELDS = new Set<SMSField>(['fee_item', 'total_fees', 'amount_paid', 'balance']);
export const smsFieldLabel = (field: SMSField) => SMS_FIELDS.find(([key]) => key === field)?.[1] || field;

export function normaliseSMSParts(parts: SMSPart[]): SMSPart[] {
  const result: SMSPart[] = [];
  for (const part of parts) {
    const current = part.type === 'balance' ? { ...part, children: normaliseSMSParts(part.children) } : part;
    if (current.type === 'text' && !current.text) continue;
    if (current.type === 'balance' && !current.children.length) continue;
    const previous = result[result.length - 1];
    if (current.type === 'text' && previous?.type === 'text') previous.text += current.text;
    else result.push({ ...current });
  }
  return result;
}

export function writeSMSDocument(parts: SMSPart[]): string {
  const cleaned = normaliseSMSParts(parts);
  return cleaned.every(part => part.type === 'text')
    ? cleaned.map(part => part.type === 'text' ? part.text : '').join('')
    : SMS_DOCUMENT_PREFIX + JSON.stringify(cleaned);
}

export function readSMSDocument(value: string): { parts: SMSPart[]; issues: string[] } {
  if (value.startsWith(SMS_DOCUMENT_PREFIX)) {
    try {
      const raw: unknown = JSON.parse(value.slice(SMS_DOCUMENT_PREFIX.length));
      let count = 0;
      const ids = new Set<string>();
      const issues = new Set<string>();
      const validFormat = (format: Record<string, unknown>) => Object.entries(format).every(([key, option]) => {
        const choices: Record<string, unknown[]> = {
          textCase: ['unchanged', 'upper', 'lower', 'sentence', 'title'], name: ['all', 'surname', 'first', 'both'],
          class: ['name', 'code', 'both'], term: ['original', 'words', 'number', 'short'], amount: ['currency', 'number', 'plain'],
          label: [true, false], year: ['original', 'numbers'], omitIfMissing: [true, false],
        };
        return choices[key]?.includes(option);
      });
      const parse = (items: unknown, depth: number): SMSPart[] => {
        if (!Array.isArray(items) || depth > 8) throw new Error('Invalid message');
        return items.map((part: unknown): SMSPart => {
          if (++count > 2000 || !part || typeof part !== 'object') throw new Error('Invalid part');
          const p = part as Record<string, unknown>;
          if (p.type === 'text' && typeof p.text === 'string' && p.text.length <= 100000) {
            if (/[{}]/.test(p.text)) issues.add('Remove the typed automatic field and insert it using Customisation.');
            return { type: 'text', text: p.text };
          }
          if (typeof p.id !== 'string' || !p.id || p.id.length > 120 || ids.has(p.id)) throw new Error('Invalid identifier');
          ids.add(p.id);
          if (p.type === 'balance') return { type: 'balance', id: p.id, children: parse(p.children, depth + 1) };
          if (p.type === 'field' && SMS_FIELDS.some(([key]) => key === p.field) && p.format && typeof p.format === 'object' && !Array.isArray(p.format) && validFormat(p.format as Record<string, unknown>)) {
            return { type: 'field', id: p.id, field: p.field as SMSField, format: p.format as SMSFieldFormat };
          }
          throw new Error('Invalid field');
        });
      };
      const parts = normaliseSMSParts(parse(raw, 0));
      return { parts, issues: [...issues] };
    } catch {
      return { parts: [], issues: ['This saved message could not be read. Restore it or compose it again before sending.'] };
    }
  }
  // Existing saved templates remain usable, but their placeholders become chips.
  const parts: SMSPart[] = [];
  const issues: string[] = [];
  let end = 0;
  for (const match of value.matchAll(/\{([^{}]+)\}/g)) {
    const index = match.index!;
    if (index > end) parts.push({ type: 'text', text: value.slice(end, index) });
    const field = match[1];
    if (SMS_FIELDS.some(([key]) => key === field)) parts.push({ type: 'field', id: `legacy-${index}-${field}`, field: field as SMSField, format: {} });
    else { parts.push({ type: 'text', text: match[0] }); issues.push('An automatic field is not recognised. Remove it before sending.'); }
    end = index + match[0].length;
  }
  if (end < value.length) parts.push({ type: 'text', text: value.slice(end) });
  if (/[{}]/.test(value.replace(/\{[^{}]+\}/g, ''))) issues.push('An automatic field is incomplete. Remove it or insert it again.');
  return { parts, issues };
}

export function smsDocumentText(value: string): string {
  const text = (parts: SMSPart[]): string => parts.map(part => part.type === 'text' ? part.text : part.type === 'field' ? smsFieldLabel(part.field) : text(part.children)).join('');
  return text(readSMSDocument(value).parts);
}

export function smsDocumentHasFields(value: string): boolean {
  return readSMSDocument(value).parts.some(part => part.type !== 'text');
}

export function smsDocumentNeedsFees(parts: SMSPart[]): boolean {
  return parts.some(part => part.type === 'balance' || (part.type === 'field' && SMS_FEE_FIELDS.has(part.field)));
}

export function smsDocumentFields(parts: SMSPart[]): SMSField[] {
  return parts.flatMap(part => part.type === 'field' ? [part.field] : part.type === 'balance' ? smsDocumentFields(part.children) : []);
}

export function formatSMSTerm(original: string, mode: SMSFieldFormat['term'], termNumber?: number): string {
  if (!mode || mode === 'original') return original;
  const words = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const found = original.match(/\b([1-9])\b/)?.[1];
  const number = (found ? Number(found) : words.findIndex(word => new RegExp(`\\b${word}\\b`, 'i').test(original)) + 1) || termNumber;
  if (!number || number > 9) return original;
  return mode === 'words' ? `Term ${words[number - 1]}` : mode === 'short' ? `T ${number}` : `Term ${number}`;
}
