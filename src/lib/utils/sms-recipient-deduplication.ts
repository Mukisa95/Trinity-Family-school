export interface SMSRecipientReviewItem {
  id: string;
  name: string;
  phone: string;
  className?: string;
  guardianLabel: string;
}

export interface SMSDuplicateGroup {
  matchKey: string;
  recipients: SMSRecipientReviewItem[];
}

export interface SMSDuplicateAnalysis {
  groups: SMSDuplicateGroup[];
  duplicateRecipientCount: number;
  defaultIncludedRecipientIds: string[];
}

/**
 * Phone numbers are compared using digits only so formatting differences such
 * as +256 709... and 0709... do not hide a shared guardian number.
 */
export function getPhoneMatchKey(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(-8) : null;
}

export function analyzeSMSRecipientDuplicates(
  recipients: SMSRecipientReviewItem[]
): SMSDuplicateAnalysis {
  const recipientsByKey = new Map<string, SMSRecipientReviewItem[]>();

  recipients.forEach((recipient) => {
    const matchKey = getPhoneMatchKey(recipient.phone);
    if (!matchKey) return;

    const matches = recipientsByKey.get(matchKey) ?? [];
    matches.push(recipient);
    recipientsByKey.set(matchKey, matches);
  });

  const groups = Array.from(recipientsByKey.entries())
    .filter(([, matches]) => matches.length > 1)
    .map(([matchKey, matches]) => ({ matchKey, recipients: matches }));

  // Keep the first occurrence in every group and flag only the repeated ones.
  const defaultExcludedIds = new Set(
    groups.flatMap((group) => group.recipients.slice(1).map((recipient) => recipient.id))
  );

  return {
    groups,
    duplicateRecipientCount: groups.reduce(
      (count, group) => count + group.recipients.length - 1,
      0
    ),
    defaultIncludedRecipientIds: recipients
      .filter((recipient) => !defaultExcludedIds.has(recipient.id))
      .map((recipient) => recipient.id),
  };
}
