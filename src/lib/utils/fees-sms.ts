import type { Class, Guardian, Pupil } from '@/types';
import type { PupilFeesInfo } from '@/lib/hooks/use-progressive-fees';
import type { SMSRequest, SMSResponse } from '@/lib/services/sms.service';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import { SMS_FIELDS, SMS_DOCUMENT_PREFIX, readSMSDocument, smsDocumentFields, smsDocumentNeedsFees, formatSMSTerm, smsFieldLabel, type SMSPart, type SMSFieldPart } from './sms-document';

export const FEES_SMS_FIELDS = SMS_FIELDS;
export type FeesSMSField = typeof FEES_SMS_FIELDS[number][0];
export type FeesSMSParents = 'first' | 'second' | 'both';
export const FEES_SMS_NAME_FORMATS = [
  ['all', 'All available names'], ['surname', 'Surname only'],
  ['first', 'First name only'], ['both', 'Surname + first name'],
] as const;
export const FEES_SMS_TEXT_CASES = [
  ['unchanged', 'As written'], ['upper', 'UPPERCASE'], ['lower', 'lowercase'],
  ['sentence', 'Sentence case'], ['title', 'Title Case'],
] as const;
export type FeesSMSNameFormat = typeof FEES_SMS_NAME_FORMATS[number][0];
export type FeesSMSTextCase = typeof FEES_SMS_TEXT_CASES[number][0];
export interface FeesSMSOptions {
  minimumBalance?: string;
  nameFormat?: FeesSMSNameFormat;
  nameCase?: FeesSMSTextCase;
  messageCase?: FeesSMSTextCase;
}

export function applyFeesSMSTextCase(text: string, mode: FeesSMSTextCase = 'unchanged'): string {
  if (mode === 'upper') return text.toUpperCase();
  if (mode === 'lower') return text.toLowerCase();
  if (mode === 'sentence') return text.toLowerCase().replace(/(^|[.!?]\s+|\n\s*)(\p{L})/gu, (_match, prefix: string, letter: string) => prefix + letter.toUpperCase());
  if (mode === 'title') return text.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_match, prefix: string, letter: string) => prefix + letter.toUpperCase());
  return text;
}

export function formatFeesSMSPupilName(pupil: Pick<Pupil, 'firstName' | 'lastName' | 'otherNames'>, format: FeesSMSNameFormat = 'all'): string {
  if (format === 'surname') return pupil.lastName?.trim() || '';
  if (format === 'first') return pupil.firstName?.trim() || '';
  if (format === 'both') return [pupil.lastName?.trim(), pupil.firstName?.trim()].filter(Boolean).join(' ');
  return formatPupilDisplayName(pupil);
}

export interface FeesSMSContext {
  pupils: Pupil[];
  classes: Class[];
  pupilFeesInfo: Record<string, PupilFeesInfo | undefined>;
  selectedFeeId?: string;
  feeItemName?: string;
  yearName?: string;
  termName?: string;
  termNumber?: number;
  allowFees?: boolean;
  isFeesLoading?: boolean;
  feesError?: string | null;
  recipientGuardians?: Record<string, Guardian[]>;
  manualNumbers?: string[];
}

export interface FeesSMSMessage {
  id: string;
  pupilNames: string[];
  phone: string;
  message: string;
  segments: number;
}

export function normalizeFeesSMSPhone(phone: string): string | null {
  const cleaned = phone.trim().replace(/[\s()\-]/g, '');
  const international = /^0\d{9}$/.test(cleaned) ? `+256${cleaned.slice(1)}`
    : /^256\d{9}$/.test(cleaned) ? `+${cleaned}`
      : /^[37]\d{8}$/.test(cleaned) ? `+256${cleaned}` : cleaned;
  return /^\+[1-9]\d{7,14}$/.test(international) ? international : null;
}

// GSM extension characters consume two units; Unicode uses shorter segments.
export function feesSMSSegments(message: string): number {
  if (!message) return 0;
  const basic = new Set(Array.from('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'));
  const extended = new Set(Array.from('\f^{}\\[~]|€'));
  let units = 0;
  for (const character of message) {
    if (basic.has(character)) units++;
    else if (extended.has(character)) units += 2;
    else return message.length <= 70 ? 1 : Math.ceil(message.length / 67);
  }
  return units <= 160 ? 1 : Math.ceil(units / 153);
}

export function buildFeesSMSPreview(template: string, parents: FeesSMSParents, context: FeesSMSContext, options: FeesSMSOptions = {}) {
  const messages: FeesSMSMessage[] = [];
  const document = readSMSDocument(template);
  const issues = new Set<string>(document.issues);
  const skipped: string[] = [], excluded: string[] = [], manualSkipped: string[] = [];
  const minimumBalance = options.minimumBalance?.trim() ? Number(options.minimumBalance) : undefined;
  if (minimumBalance !== undefined && (!Number.isSafeInteger(minimumBalance) || minimumBalance < 0)) issues.add('Enter a whole balance threshold of zero or more.');
  const fields = smsDocumentFields(document.parts);
  const needsMoney = minimumBalance !== undefined || smsDocumentNeedsFees(document.parts);
  if (context.allowFees === false && needsMoney) issues.add('Fee fields and balance conditions are available only on Fees Collection. Remove them from this message.');
  if (!template.trim() || !document.parts.length) issues.add('Enter a message.');
  if (needsMoney && context.isFeesLoading) issues.add('Wait for fee calculations to finish before reviewing amounts.');
  if (needsMoney && context.feesError) issues.add('Fee calculations could not be completed. Reload the fees before including amounts.');
  const matching = new Map<string, FeesSMSMessage>();
  const money = (amount: number | undefined, mode = 'currency') => amount !== undefined && Number.isFinite(amount)
    ? (mode === 'currency' ? 'Shs. ' : '') + (mode === 'plain' ? String(amount) : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)) : '';
  const renderField = (part: SMSFieldPart, pupil?: Pupil, guardian?: Guardian): string => {
    const { field, format } = part;
    const info = pupil ? context.pupilFeesInfo[pupil.id] : undefined;
    const fee = context.selectedFeeId ? info?.applicableFees.find(item => item.feeStructureId === context.selectedFeeId) : undefined;
    const pupilClass = context.classes.find(item => item.id === pupil?.classId);
    let value = '';
    switch (field) {
      case 'pupil_name': value = pupil ? formatFeesSMSPupilName(pupil, format.name || options.nameFormat) : ''; break;
      case 'guardian_name':
        value = guardian ? format.name === 'surname' ? guardian.lastName || '' : format.name === 'first' ? guardian.firstName || ''
          : (format.name === 'both' ? [guardian.lastName, guardian.firstName] : [guardian.firstName, guardian.lastName]).filter(Boolean).join(' ') : ''; break;
      case 'class': value = format.class === 'code' ? pupilClass?.code || '' : format.class === 'both'
        ? (pupilClass?.name && pupilClass.code ? `${pupilClass.name} (${pupilClass.code})` : '') : pupilClass?.name || ''; break;
      case 'admission_number': value = pupil?.admissionNumber || ''; break;
      case 'schoolpay_code': value = pupil?.payCode || ''; break;
      case 'fee_item': value = context.selectedFeeId ? context.feeItemName || fee?.name || '' : 'all fees'; break;
      case 'total_fees': value = money(context.selectedFeeId ? fee?.amount : info?.totalFees, format.amount); break;
      case 'amount_paid': value = money(context.selectedFeeId ? fee?.paid : info?.totalPaid, format.amount); break;
      case 'balance': value = money(context.selectedFeeId ? fee?.balance : info?.balance, format.amount); break;
      case 'term': value = formatSMSTerm(context.termName || '', format.term, context.termNumber); break;
      case 'year': value = format.year === 'numbers' ? (context.yearName?.match(/\d{4}/g) || []).join('/') : context.yearName || ''; break;
    }
    if (!value && !format.omitIfMissing) issues.add(`${pupil ? formatPupilDisplayName(pupil) : 'Manual number'}: missing ${smsFieldLabel(field)}.`);
    if (value && format.label) value = `${smsFieldLabel(field)}: ${value}`;
    return applyFeesSMSTextCase(value, format.textCase || (field === 'pupil_name' ? options.nameCase : 'unchanged'));
  };
  const render = (parts: SMSPart[], pupil?: Pupil, guardian?: Guardian): string => parts.map(part => {
    if (part.type === 'text') return part.text;
    if (part.type === 'field') return renderField(part, pupil, guardian);
    const info = pupil ? context.pupilFeesInfo[pupil.id] : undefined;
    const balance = context.selectedFeeId ? info?.applicableFees.find(fee => fee.feeStructureId === context.selectedFeeId)?.balance : info?.balance;
    if (balance === undefined || !Number.isFinite(balance)) {
      issues.add(`${pupil ? formatPupilDisplayName(pupil) : 'Manual number'}: balance is unavailable for the conditional text.`);
      return '';
    }
    return balance > 0 ? render(part.children, pupil, guardian) : '';
  }).join('');
  const addMessage = (phone: string, pupilName: string, text: string) => {
    const message = applyFeesSMSTextCase(text.trim(), options.messageCase);
    if (!message) { skipped.push(`${pupilName}: the message is empty after applying its conditions.`); return; }
    const key = JSON.stringify([phone, message]);
    const existing = matching.get(key);
    if (existing) { if (!existing.pupilNames.includes(pupilName)) existing.pupilNames.push(pupilName); return; }
    const item = { id: key, pupilNames: [pupilName], phone, message, segments: feesSMSSegments(message) };
    messages.push(item);
    matching.set(key, item);
  };
  for (const pupil of context.pupils) {
    const pupilName = formatPupilDisplayName(pupil);
    const guardians = context.recipientGuardians?.[pupil.id] ?? (parents === 'both' ? pupil.guardians?.slice(0, 2) : [pupil.guardians?.[parents === 'first' ? 0 : 1]]);
    if (!(guardians || []).some(guardian => guardian?.phone && normalizeFeesSMSPhone(guardian.phone))) {
      skipped.push(`${pupilName}: no valid phone number for the selected parent option.`); continue;
    }
    if (minimumBalance !== undefined) {
      const info = context.pupilFeesInfo[pupil.id];
      const balance = context.selectedFeeId ? info?.applicableFees.find(item => item.feeStructureId === context.selectedFeeId)?.balance : info?.balance;
      if (balance === undefined || !Number.isFinite(balance)) { issues.add(`${pupilName}: balance is unavailable for the exclusion check.`); continue; }
      if (balance < minimumBalance) { excluded.push(`${pupilName}: balance ${money(balance)} is below ${money(minimumBalance)}.`); continue; }
    }
    const pupilPhones = new Set<string>();
    for (const guardian of guardians || []) {
      const phone = guardian?.phone ? normalizeFeesSMSPhone(guardian.phone) : null;
      if (!guardian || !phone || pupilPhones.has(phone)) continue;
      pupilPhones.add(phone);
      addMessage(phone, pupilName, render(document.parts, pupil, guardian));
    }
  }
  for (const number of context.manualNumbers || []) {
    const phone = normalizeFeesSMSPhone(number);
    if (!phone) { manualSkipped.push(`${number}: invalid phone number.`); continue; }
    if (minimumBalance !== undefined || document.parts.some(part => part.type === 'balance') || fields.some(field => !['term', 'year', 'fee_item'].includes(field))) {
      manualSkipped.push(`${number}: no pupil is linked for personalised fields or balance exclusions.`); continue;
    }
    addMessage(phone, 'Manual number', render(document.parts));
  }
  if (!messages.length && !issues.size) issues.add(excluded.length || manualSkipped.length ? 'No messages remain. Check the exclusions and recipient details.' : 'No valid recipients match this selection.');
  const scope = [
    `${context.pupils.length} filtered pupils`,
    context.allowFees === false ? '' : context.selectedFeeId ? context.feeItemName || 'Selected fee' : 'All fees',
    context.termName, context.yearName,
    minimumBalance !== undefined && Number.isFinite(minimumBalance) && minimumBalance >= 0 ? `Balance at least ${money(minimumBalance)}` : '',
    context.manualNumbers?.length ? `${context.manualNumbers.length} manual ${context.manualNumbers.length === 1 ? 'number' : 'numbers'}` : '',
  ].filter(Boolean).join(' · ');
  // Invalid documents must never reach the sending flow, including after restoring a saved draft.
  return { messages: issues.size ? [] : messages, issues: [...issues], skipped, excluded, manualSkipped, scope, segments: issues.size ? 0 : messages.reduce((sum, item) => sum + item.segments, 0) };
}

export type FeesSMSPreview = ReturnType<typeof buildFeesSMSPreview>;

export function usesSMSCustomisation(message: string, options: FeesSMSOptions): boolean {
  return message.startsWith(SMS_DOCUMENT_PREFIX) || /[{}]/.test(message) || Boolean(options.minimumBalance?.trim()) ||
    Boolean(options.nameFormat && options.nameFormat !== 'all') ||
    Boolean(options.nameCase && options.nameCase !== 'unchanged') ||
    Boolean(options.messageCase && options.messageCase !== 'unchanged');
}

export interface FeesSMSDelivery {
  id: string;
  status: 'sent' | 'review';
  detail: string;
}

/** Stop on an uncertain/partial response. Only untouched messages can be continued. */
export async function sendFeesSMSMessages(
  messages: FeesSMSMessage[],
  sentBy: string,
  send: (request: SMSRequest) => Promise<SMSResponse>,
  onResult: (result: FeesSMSDelivery) => void,
) {
  for (const item of messages) {
    try {
      const response = await send({ message: item.message, recipients: [item.phone], sentBy });
      const complete = response.success && response.recipientCount === 1 &&
        (!response.details || (response.details.successful === 1 && response.details.failed === 0 && !response.details.blocked));
      onResult({ id: item.id, status: complete ? 'sent' : 'review', detail: complete ? 'Accepted by SMS service' : response.message || 'Check SMS history before trying this message again.' });
      if (!complete) return;
    } catch {
      onResult({ id: item.id, status: 'review', detail: 'Delivery is unconfirmed. Check SMS history before trying this message again.' });
      return;
    }
  }
}
