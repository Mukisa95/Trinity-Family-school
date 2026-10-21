/** Shared print language for registers, collection lists and statements. */
export const LIST_DOCUMENT = {
  ink: '#222222', muted: '#555555', rule: '#666666', grid: '#dddddd',
  heading: '#f1f1f1', alternate: '#f8f8f8', margin: 28.35,
} as const;

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
  merge('page', { padding: 28.35, paddingTop: 28.35, paddingBottom: 48, paddingHorizontal: 28.35, fontFamily: 'Helvetica', color: LIST_DOCUMENT.ink });
  merge('table', { borderRadius: '0pt', borderWidth: .6, borderColor: LIST_DOCUMENT.rule, borderStyle: 'solid', marginBottom: 10, marginTop: 0 });
  for (const key of ['tableHeader', 'tableColHeader', 'headerRow']) merge(key, {
    backgroundColor: LIST_DOCUMENT.heading, color: LIST_DOCUMENT.ink, borderRadius: '0pt',
    borderTopLeftRadius: 0, borderTopRightRadius: 0, borderColor: LIST_DOCUMENT.rule,
    borderWidth: .3, borderBottomWidth: .6,
  });
  merge('tableColHeader', { padding: 5 });
  for (const key of ['headerCell', 'tableCellHeader', 'headerCellText', 'headerText']) merge(key, { color: LIST_DOCUMENT.ink, fontSize: 8, fontWeight: 'bold', padding: 0, paddingVertical: 0 });
  for (const key of ['tableRow', 'tableRowBreakable']) merge(key, { minHeight: 22 });
  for (const key of ['tableRow', 'tableRowBreakable', 'tableRowAlt', 'row']) merge(key, { borderBottom: '0.3 solid #dddddd' });
  for (const key of ['tableRowEven', 'tableRowAlt', 'altRow']) merge(key, { backgroundColor: LIST_DOCUMENT.alternate });
  for (const key of ['tableCol', 'cell']) merge(key, { borderColor: LIST_DOCUMENT.grid, borderWidth: .3, padding: 5 });
  for (const key of ['studentInfoCol', 'academicInfoCol', 'personalInfoCol']) merge(key, { borderRight: '0.3 solid #dddddd' });
  for (const key of ['tableCell', 'combinedCell']) merge(key, { fontSize: 9, color: LIST_DOCUMENT.ink, lineHeight: 1.25 });
  for (const key of ['tableCellSmall', 'guardianInfo', 'siblingInfo', 'secondaryText']) merge(key, { fontSize: 8, color: LIST_DOCUMENT.muted });
  for (const key of ['filterInfo', 'classInfoContainer', 'accountInfo', 'summary']) merge(key, {
    backgroundColor: LIST_DOCUMENT.alternate, borderRadius: '0pt', border: '0.3 solid #dddddd',
    borderLeftWidth: .3, padding: 7, fontSize: 8, marginBottom: 10,
  });
  for (const key of Object.keys(input).filter(key => key.startsWith('status') || ['codeChip', 'emergencyTag'].includes(key))) merge(key, {
    color: LIST_DOCUMENT.ink, backgroundColor: 'transparent', borderWidth: '0pt', borderRadius: '0pt',
  });
  for (const key of ['pupilPhoto', 'photoPlaceholder']) merge(key, { borderRadius: 1 });
  return result;
}
