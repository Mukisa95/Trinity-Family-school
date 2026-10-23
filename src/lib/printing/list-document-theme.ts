/** Shared print language for registers, collection lists and statements. */
export const LIST_DOCUMENT = {
  ink: '#222222', muted: '#555555', rule: '#666666', grid: '#dddddd',
  heading: '#222222', alternate: '#f1f2f3', margin: 72 / 2.54,
  bodyFontSize: 11.3, detailFontSize: 9.5,
} as const;

/** Approved compact table density. Document headings, page width and footers stay unchanged. */
export const LIST_TABLE = {
  scale: .8, bodyFontSize: 9.04, detailFontSize: 7.6,
  cellPaddingMm: 1.6, blankRowHeightMm: 6.64,
} as const;

const TABLE_STYLE_KEYS = new Set([
  'headerRow', 'headerCell', 'headerCellText', 'headerText', 'cell', 'lastCell', 'altRow',
  'studentInfoCol', 'academicInfoCol', 'personalInfoCol', 'contactInfoCol',
  'primaryText', 'secondaryText', 'tertiaryText', 'accentText', 'combinedCell',
  'guardianInfo', 'siblingInfo', 'compactText', 'cellText', 'nameText', 'idText',
  'codeChip', 'emergencyTag', 'currencyText', 'summaryRow', 'placeholderInitial',
  'photo', 'pupilPhoto', 'photoPlaceholder', 'photoContainer',
]);
const TABLE_SIZE_PROPERTIES = new Set([
  'fontSize', 'height', 'minHeight', 'minPresenceAhead',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'paddingHorizontal', 'paddingVertical',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'marginHorizontal', 'marginVertical',
]);

export function listDocumentCopyright(schoolName = 'Trinity Family School', year = new Date().getFullYear()) {
  return `${schoolName.trim() || 'Trinity Family School'} Management System (c) ${year}`;
}

export function listSchoolHeading(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ').toUpperCase();
  if (/^TRINITY FAMILY(?: SCHOOL[S]?| NUR.*| PRIMARY.*)?$/.test(normalized)) {
    return { name: 'TRINITY FAMILY', subtitle: 'NURSERY AND PRIMARY SCHOOL' };
  }
  const match = normalized.match(/^(.+?)\s+((?:NURSERY|PRIMARY|SECONDARY|JUNIOR|SENIOR)\b.*)$/);
  return { name: match?.[1] || normalized, subtitle: match?.[2] || '' };
}

/** Adapt existing column layouts without changing their data or selected fields. */
export function listDocumentStyles<T extends Record<string, any>>(input: T): T {
  const result = { ...input };
  const merge = (key: string, value: Record<string, any>) => {
    if (key in result) result[key as keyof T] = { ...result[key], ...value };
  };
  // The footer stays inside the same 1 cm boundary; reserve space above it for flowing rows.
  merge('page', { padding: LIST_DOCUMENT.margin, paddingTop: LIST_DOCUMENT.margin, paddingBottom: LIST_DOCUMENT.margin + 30, paddingHorizontal: LIST_DOCUMENT.margin, fontSize: LIST_DOCUMENT.bodyFontSize, fontFamily: 'Helvetica', color: LIST_DOCUMENT.ink });
  for (const key of Object.keys(input)) {
    if (key !== 'page' && typeof input[key]?.fontSize === 'number' && input[key].fontSize < LIST_DOCUMENT.detailFontSize) merge(key, { fontSize: LIST_DOCUMENT.detailFontSize });
  }
  // Borders belong to rows/cells: an outer border on a wrapped View extends into the footer.
  merge('table', { borderRadius: '0pt', borderWidth: '0pt', borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0, marginBottom: 10, marginTop: 0 });
  for (const key of ['tableHeader', 'tableColHeader', 'headerRow']) merge(key, {
    backgroundColor: LIST_DOCUMENT.heading, color: '#ffffff', borderRadius: '0pt',
    borderTopLeftRadius: 0, borderTopRightRadius: 0, borderColor: LIST_DOCUMENT.rule,
    borderWidth: .3, borderBottomWidth: .6,
  });
  merge('tableColHeader', { padding: 5 });
  for (const key of ['headerCell', 'tableCellHeader', 'headerCellText', 'headerText']) merge(key, { color: '#ffffff', fontSize: 9.5, fontWeight: 'bold', padding: 0, paddingVertical: 0 });
  for (const key of ['tableRow', 'tableRowBreakable']) merge(key, { minHeight: 22 });
  for (const key of ['tableRow', 'tableRowBreakable', 'tableRowAlt', 'row']) merge(key, { borderBottom: '0.3 solid #dddddd', borderLeft: '0.3 solid #dddddd', borderRight: '0.3 solid #dddddd' });
  for (const key of ['tableRowEven', 'tableRowAlt', 'altRow']) merge(key, { backgroundColor: LIST_DOCUMENT.alternate });
  for (const key of ['tableCol', 'cell']) merge(key, { borderColor: LIST_DOCUMENT.grid, borderWidth: .3, padding: 5 });
  for (const key of ['studentInfoCol', 'academicInfoCol', 'personalInfoCol']) merge(key, { borderRight: '0.3 solid #dddddd' });
  for (const key of ['tableCell', 'combinedCell', 'cellText', 'nameText']) merge(key, { fontSize: LIST_DOCUMENT.bodyFontSize, color: LIST_DOCUMENT.ink, lineHeight: 1.25 });
  for (const key of ['tableCellSmall', 'guardianInfo', 'siblingInfo', 'secondaryText', 'compactText']) merge(key, { fontSize: LIST_DOCUMENT.detailFontSize, color: LIST_DOCUMENT.muted });
  for (const key of ['filterInfo', 'classInfoContainer', 'accountInfo', 'summary']) merge(key, {
    backgroundColor: LIST_DOCUMENT.alternate, borderRadius: '0pt', border: '0.3 solid #dddddd',
    borderLeftWidth: .3, padding: 7, fontSize: LIST_DOCUMENT.detailFontSize, marginBottom: 10,
  });
  for (const key of Object.keys(input).filter(key => key.startsWith('status') || ['codeChip', 'emergencyTag'].includes(key))) merge(key, {
    color: LIST_DOCUMENT.ink, backgroundColor: 'transparent', borderWidth: '0pt', borderRadius: '0pt',
  });
  for (const key of ['pupilPhoto', 'photoPlaceholder']) merge(key, { borderRadius: 1 });
  for (const key of Object.keys(result)) {
    const isTable = TABLE_STYLE_KEYS.has(key) || /^table(?:Header|Col|Cell|Row)/.test(key)
      || /^col(?:\d|[A-Z])/.test(key) || key.startsWith('status') || (key === 'row' && 'headerRow' in result);
    if (!isTable) continue;
    const style: Record<string, any> = { ...result[key] };
    if (['tableHeader', 'tableColHeader', 'headerRow'].includes(key)) style.fontSize ??= LIST_DOCUMENT.detailFontSize;
    else if (/^tableRow/.test(key) || ['row', 'cell', 'tableCol', 'summaryRow'].includes(key)) style.fontSize ??= LIST_DOCUMENT.bodyFontSize;
    for (const property of Object.keys(style)) {
      const isPhotoWidth = property === 'width' && ['photo', 'pupilPhoto', 'photoPlaceholder'].includes(key);
      if ((TABLE_SIZE_PROPERTIES.has(property) || isPhotoWidth) && typeof style[property] === 'number') {
        style[property] = Math.round(style[property] * LIST_TABLE.scale * 1000) / 1000;
      }
    }
    result[key as keyof T] = style as T[keyof T];
  }
  return result;
}
