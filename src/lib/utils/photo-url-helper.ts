/**
 * Helper functions for handling photo URLs and fixing malformed URLs
 */

/**
 * Fixes malformed Firebase Storage URLs
 * Converts: https://firebasestorage.googleapis.com/v0/b/bucket/o?name=path
 * To: https://firebasestorage.googleapis.com/v0/b/bucket/o/encoded-path?alt=media
 */
export function sanitizePhotoUrl(url: string): string {
  if (!url) return '';
  
  try {
    // If URL contains ?name= pattern, it's malformed
    if (url.includes('?name=')) {
      console.log('🔧 Fixing malformed URL:', url);
      
      // Extract the bucket and file path
      const match = url.match(/https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^\/]+)\/o\?name=(.+)/);
      
      if (match) {
        const bucket = match[1];
        const filePath = decodeURIComponent(match[2]);
        
        // Construct proper URL format
        const encodedPath = encodeURIComponent(filePath);
        const fixedUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;
        
        console.log('✅ Fixed URL:', fixedUrl);
        return fixedUrl;
      }
    }
    
    // If URL is already correct or unrecognized format, return as-is
    return url;
  } catch (error) {
    console.error('Error sanitizing photo URL:', error);
    return url;
  }
}

/**
 * Validates if a photo URL is properly formatted
 */
export function isValidPhotoUrl(url: string): boolean {
  if (!url) return false;
  
  // Check for malformed URLs
  if (url.includes('?name=')) {
    return false;
  }
  
  // Check for valid Firebase Storage URL format
  const firebasePattern = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^\/]+\/o\/[^?]+\?alt=media/;
  
  return firebasePattern.test(url) || url.startsWith('data:') || url.startsWith('blob:');
}

/**
 * Gets a safe photo URL with fallback
 */
export function getSafePhotoUrl(photo: { url?: string; title?: string }, fallback?: string): string {
  if (!photo.url) {
    return fallback || '';
  }
  
  const sanitizedUrl = sanitizePhotoUrl(photo.url);
  
  if (!isValidPhotoUrl(sanitizedUrl)) {
    console.warn(`Invalid photo URL for "${photo.title}":`, photo.url);
    return fallback || '';
  }
  
  return sanitizedUrl;
} 