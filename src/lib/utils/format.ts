
/**
 * Formats staff roles with proper articles and conjunctions
 * @param roles - Array of role strings or single role string
 * @returns Formatted role string with articles
 */
export function formatStaffRoles(roles: string[] | string | undefined): string {
  if (!roles) return 'Not specified';
  
  const roleArray = Array.isArray(roles) ? roles : [roles];
  
  if (roleArray.length === 0) return 'Not specified';
  if (roleArray.length === 1) {
    const role = roleArray[0];
    return getArticleForRole(role) + ' ' + role;
  }
  
  if (roleArray.length === 2) {
    const firstRole = getArticleForRole(roleArray[0]) + ' ' + roleArray[0];
    const secondRole = getArticleForRole(roleArray[1]) + ' ' + roleArray[1];
    return `${firstRole} and ${secondRole}`;
  }
  
  // For 3 or more roles
  const formattedRoles = roleArray.map(role => getArticleForRole(role) + ' ' + role);
  const lastRole = formattedRoles.pop();
  return `${formattedRoles.join(', ')} and ${lastRole}`;
}

/**
 * Gets the appropriate article for a role
 * @param role - The role string
 * @returns The article (a/an) for the role
 */
function getArticleForRole(role: string): string {
  if (!role) return 'a';
  
  const roleLower = role.toLowerCase();
  
  // Roles that start with vowel sounds
  const vowelSoundRoles = [
    'administrator', 'assistant', 'associate', 'executive', 'officer', 
    'organizer', 'operator', 'analyst', 'engineer', 'expert', 'editor',
    'instructor', 'inspector', 'investigator', 'interviewer', 'illustrator'
  ];
  
  // Check if role starts with a vowel or has a vowel sound
  const startsWithVowel = /^[aeiou]/i.test(roleLower);
  const hasVowelSound = vowelSoundRoles.some(vowelRole => roleLower.includes(vowelRole));
  
  return (startsWithVowel || hasVowelSound) ? 'an' : 'a';
}

