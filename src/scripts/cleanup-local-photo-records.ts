import { 
  collection, 
  getDocs, 
  doc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { bumpPhotosRevisionInBatch } from '@/lib/services/dashboard-cache-revisions.service';

const COLLECTION_NAME = 'photos';

interface PhotoDoc {
  id: string;
  url: string;
  title: string;
  storageType?: string;
}

/**
 * Clean up database records for local photos that have been deleted from file system
 */
export async function cleanupLocalPhotoRecords() {
  console.log('🧹 Starting cleanup of local photo database records...');
  
  try {
    // Get all photos from Firestore
    const photosCollection = collection(db, COLLECTION_NAME);
    const querySnapshot = await getDocs(photosCollection);
    
    console.log(`📸 Found ${querySnapshot.docs.length} photo records to check`);
    
    let deletedCount = 0;
    let errorCount = 0;
    let keptCount = 0;
    const localPhotoRefs: ReturnType<typeof doc>[] = [];
    
    for (const docSnap of querySnapshot.docs) {
      const photoData = docSnap.data() as PhotoDoc;
      const photoId = docSnap.id;
      
      try {
        // Check if this is a local storage photo (URL starts with /uploads/photos/)
        if (photoData.url && photoData.url.startsWith('/uploads/photos/')) {
          console.log(`🗑️  Deleting local photo record: ${photoData.title}`);
          
          const docRef = doc(db, COLLECTION_NAME, photoId);
          localPhotoRefs.push(docRef);
          deletedCount++;
        } else if (photoData.url && photoData.url.includes('cloudinary.com')) {
          console.log(`☁️  Keeping Cloudinary photo: ${photoData.title}`);
          keptCount++;
        } else if (photoData.url && photoData.url.includes('firebasestorage.googleapis.com')) {
          console.log(`🔥 Keeping Firebase Storage photo: ${photoData.title}`);
          keptCount++;
        } else {
          console.log(`❓ Unknown photo type: ${photoData.title} - ${photoData.url}`);
          keptCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing photo ${photoData.title}:`, error);
        errorCount++;
      }
    }

    // Each chunk leaves room for the two revision writes. Every deletion and
    // its cache invalidation signal therefore become visible atomically.
    for (let offset = 0; offset < localPhotoRefs.length; offset += 498) {
      const batch = writeBatch(db);
      localPhotoRefs.slice(offset, offset + 498).forEach(photoRef => batch.delete(photoRef));
      bumpPhotosRevisionInBatch(batch);
      await batch.commit();
    }
    
    console.log('\n🎉 Local photo cleanup completed!');
    console.log(`🗑️  Deleted: ${deletedCount} local photo records`);
    console.log(`☁️  Kept: ${keptCount} cloud photos`);
    console.log(`❌ Errors: ${errorCount} photos`);
    console.log(`📊 Total processed: ${querySnapshot.docs.length} photos`);
    
    return {
      total: querySnapshot.docs.length,
      deleted: deletedCount,
      kept: keptCount,
      errors: errorCount
    };
    
  } catch (error) {
    console.error('❌ Failed to run local photo cleanup:', error);
    throw error;
  }
}

// Run the cleanup if this script is executed directly
if (require.main === module) {
  cleanupLocalPhotoRecords()
    .then((result) => {
      console.log('✅ Cleanup completed successfully:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    });
}
