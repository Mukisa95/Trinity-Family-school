/**
 * Decode HTML entities in a string
 * This handles common HTML entities like &amp;, &lt;, &gt;, &quot;, &#39;, etc.
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  
  // Create a temporary element to leverage browser's HTML entity decoding
  // This works in both browser and React PDF rendering contexts
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
  };
  
  let decodedText = text;
  
  // Replace known entities
  for (const [entity, char] of Object.entries(entities)) {
    decodedText = decodedText.replace(new RegExp(entity, 'g'), char);
  }
  
  // Handle numeric entities (e.g., &#38; for &, &#x26; for &)
  decodedText = decodedText.replace(/&#(\d+);/g, (match, dec) => {
    return String.fromCharCode(dec);
  });
  
  decodedText = decodedText.replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  
  return decodedText;
}

/**
 * Clean subject name by decoding HTML entities and removing any unwanted prefixes/suffixes
 */
export function cleanSubjectName(name: string): string {
  if (!name) return name;
  
  // First decode HTML entities (converts &amp; to &)
  let cleaned = decodeHtmlEntities(name);
  
  // Then remove any leading or trailing '&' characters (with optional spaces)
  cleaned = cleaned.replace(/^&+\s*/, '');  // Remove from start
  cleaned = cleaned.replace(/\s*&+$/, '');  // Remove from end
  
  // Also trim any extra whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

