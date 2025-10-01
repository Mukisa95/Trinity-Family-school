import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc 
} from 'firebase/firestore';
import { 
  ref, 
  getDownloadURL 
} from 'firebase/storage';
import { db, storage } from '@/lib/firebase';

const COLLECTION_NAME = 'photos';
const STORAGE_PATH = 'school-photos';

interface PhotoDoc {
  id: string;
  fileName: string;
  category: string;
  url: string;
  title: string;
}

/**
 * Fix malformed photo URLs by regenerating proper Firebase Storage download URLs
 */
export async function fixPhotoUrls() {
  console.log('🔧 Starting photo URL migration...');
  
  try {
    // Get all photos from Firestore
    const photosCollection = collection(db, COLLECTION_NAME);
    const querySnapshot = await getDocs(photosCollection);
    
    console.log(`📸 Found ${querySnapshot.docs.length} photos to check`);
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const docSnap of querySnapshot.docs) {
      const photoData = docSnap.data() as PhotoDoc;
      const photoId = docSnap.id;
      
      try {
        // Check if URL is malformed (contains ?name= pattern)
        if (photoData.url && photoData.url.includes('?name=')) {
          console.log(`🔄 Fixing malformed URL for photo: ${photoData.title}`);
          
          // Reconstruct the storage path
          const filePath = `${STORAGE_PATH}/${photoData.category}/${photoData.fileName}`;
          const storageRef = ref(storage, filePath);
          
          // Get the correct download URL
          const newUrl = await getDownloadURL(storageRef);
          
          // Update the document with the correct URL
          const docRef = doc(db, COLLECTION_NAME, photoId);
          await updateDoc(docRef, {
            url: newUrl
          });
          
          console.log(`✅ Fixed URL for: ${photoData.title}`);
          fixedCount++;
        } else if (!photoData.url) {
          console.log(`⚠️  Photo missing URL: ${photoData.title}`);
          
          // Try to regenerate URL if fileName exists
          if (photoData.fileName && photoData.category) {
            const filePath = `${STORAGE_PATH}/${photoData.category}/${photoData.fileName}`;
            const storageRef = ref(storage, filePath);
            
            try {
              const newUrl = await getDownloadURL(storageRef);
              const docRef = doc(db, COLLECTION_NAME, photoId);
              await updateDoc(docRef, {
                url: newUrl
              });
              
              console.log(`✅ Generated missing URL for: ${photoData.title}`);
              fixedCount++;
            } catch (error) {
              console.log(`❌ Could not generate URL for: ${photoData.title}`, error);
              errorCount++;
            }
          }
        } else {
          console.log(`✓ URL looks good for: ${photoData.title}`);
        }
      } catch (error) {
        console.error(`❌ Error processing photo ${photoData.title}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n🎉 Photo URL migration completed!');
    console.log(`✅ Fixed: ${fixedCount} photos`);
    console.log(`❌ Errors: ${errorCount} photos`);
    console.log(`✓ Total processed: ${querySnapshot.docs.length} photos`);
    
    return {
      total: querySnapshot.docs.length,
      fixed: fixedCount,
      errors: errorCount
    };
    
  } catch (error) {
    console.error('❌ Failed to run photo URL migration:', error);
    throw error;
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  fixPhotoUrls()
    .then((result) => {
      console.log('Migration completed successfully:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
} 