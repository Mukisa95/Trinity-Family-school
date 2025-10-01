import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';

interface CollectionStats {
  name: string;
  count: number;
  estimatedSize: number;
  lastUpdated: string;
  growthRate?: number;
}

interface FirebaseStats {
  totalCollections: number;
  totalDocuments: number;
  estimatedTotalSize: number;
  collections: CollectionStats[];
  lastChecked: string;
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching Firebase database statistics...');
    
    const collections = [
      'pupils',
      'staff',
      'classes',
      'academicYears',
      'feeStructures',
      'payments',
      'families',
      'users',
      'schoolSettings',
      'smsTemplates',
      'notifications',
      'exams',
      'subjects',
      'requirements',
      'uniforms',
      'events',
      'attendance',
      'banking',
      'pupilSnapshots',
      'discounts',
      'accessLevels',
      'dutyService',
      'procurement',
      'commentary',
      'pleResults'
    ];

    const collectionStats: CollectionStats[] = [];
    let totalDocuments = 0;
    let estimatedTotalSize = 0;

    for (const collectionName of collections) {
      try {
        console.log(`📊 Analyzing collection: ${collectionName}`);
        
        // Get total count
        const collectionRef = collection(db, collectionName);
        const snapshot = await getDocs(collectionRef);
        const count = snapshot.size;
        
        if (count > 0) {
          // Estimate size (rough calculation: average document ~1KB)
          const estimatedSize = count * 1024; // 1KB per document estimate
          
          // Get last updated document
          const lastDocQuery = query(
            collectionRef, 
            orderBy('updatedAt', 'desc'), 
            limit(1)
          );
          const lastDocSnapshot = await getDocs(lastDocQuery);
          const lastUpdated = lastDocSnapshot.empty 
            ? 'Unknown' 
            : lastDocSnapshot.docs[0].data().updatedAt?.toDate?.()?.toLocaleDateString() || 'Unknown';

          collectionStats.push({
            name: collectionName,
            count,
            estimatedSize,
            lastUpdated
          });

          totalDocuments += count;
          estimatedTotalSize += estimatedSize;
        }
      } catch (error) {
        console.warn(`⚠️ Could not analyze collection ${collectionName}:`, error);
      }
    }

    // Sort by document count
    collectionStats.sort((a, b) => b.count - a.count);

    const stats: FirebaseStats = {
      totalCollections: collectionStats.length,
      totalDocuments,
      estimatedTotalSize,
      collections: collectionStats,
      lastChecked: new Date().toISOString()
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('❌ Error fetching Firebase stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Firebase statistics' },
      { status: 500 }
    );
  }
}
