import { Gender } from '@/types';

/**
 * Replace gender placeholders in comments based on pupil gender.
 *
 * Supported placeholders (case-sensitive as written):
 *  [He/She]   → He / She
 *  [he/she]   → he / she
 *  [His/Her]  → His / Her
 *  [his/her]  → his / her
 *  [Him/Her]  → Him / Her
 *  [him/her]  → him / her
 *  [Himself/Herself] → Himself / Herself
 *  [himself/herself] → himself / herself
 */
export function adjustCommentForGender(comment: string, gender: Gender): string {
  if (!gender || gender === '') return comment;

  const isMale = gender === 'Male';

  return comment
    .replace(/\[He\/She\]/g, isMale ? 'He' : 'She')
    .replace(/\[She\/He\]/g, isMale ? 'He' : 'She')
    .replace(/\[he\/she\]/g, isMale ? 'he' : 'she')
    .replace(/\[she\/he\]/g, isMale ? 'he' : 'she')
    .replace(/\[His\/Her\]/g, isMale ? 'His' : 'Her')
    .replace(/\[Her\/His\]/g, isMale ? 'His' : 'Her')
    .replace(/\[his\/her\]/g, isMale ? 'his' : 'her')
    .replace(/\[her\/his\]/g, isMale ? 'his' : 'her')
    .replace(/\[Him\/Her\]/g, isMale ? 'Him' : 'Her')
    .replace(/\[Her\/Him\]/g, isMale ? 'Him' : 'Her')
    .replace(/\[him\/her\]/g, isMale ? 'him' : 'her')
    .replace(/\[her\/him\]/g, isMale ? 'him' : 'her')
    .replace(/\[Himself\/Herself\]/g, isMale ? 'Himself' : 'Herself')
    .replace(/\[Herself\/Himself\]/g, isMale ? 'Himself' : 'Herself')
    .replace(/\[himself\/herself\]/g, isMale ? 'himself' : 'herself')
    .replace(/\[herself\/himself\]/g, isMale ? 'himself' : 'herself');
}
