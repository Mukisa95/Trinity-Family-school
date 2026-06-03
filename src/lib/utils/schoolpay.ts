type IdentifierLike = {
  idType?: string | null;
  idValue?: string | null;
};

type PupilLike = {
  schoolPayCode?: string | null;
  schoolPayPaymentCode?: string | null;
  paymentCode?: string | null;
  payCode?: string | null;
  additionalIdentifiers?: IdentifierLike[] | null;
};

export function getSchoolPayCode(pupil?: PupilLike | null): string {
  if (!pupil) return '';

  const directPayCode = `${pupil.schoolPayCode || pupil.schoolPayPaymentCode || pupil.paymentCode || pupil.payCode || ''}`.trim();
  if (directPayCode) return directPayCode;

  const identifierPayCode = pupil.additionalIdentifiers?.find((identifier) =>
    `${identifier?.idType || ''}`.toLowerCase().includes('pay code')
  )?.idValue;

  return `${identifierPayCode || ''}`.trim();
}
