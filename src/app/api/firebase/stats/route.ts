import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getCountFromServer, query, orderBy, limit, getDocs } from 'firebase/firestore';

interface CollectionStats {
  name: string;
  count: number;
  estimatedSize: number;
  lastUpdated: string;
}

interface FirebaseStats {
  totalCollections: number;
  totalDocuments: number;
  estimatedTotalSize: number;
  collections: CollectionStats[];
  lastChecked: string;
  servedFromCache?: boolean;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────
// Shared across all requests to this serverless function instance.
// TTL: 60 seconds — stats are informational and don't need second-by-second accuracy.
let cachedStats: FirebaseStats | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

// ─── Collections to measure ───────────────────────────────────────────────────
const COLLECTIONS = [
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

export async function GET(request: NextRequest) {
  try {
    // ── Serve from cache if still fresh ──────────────────────────────────────
    if (cachedStats && Date.now() < cacheExpiresAt) {
      console.log('📦 Stats served from cache (no Firestore reads)');
      return NextResponse.json({ ...cachedStats, servedFromCache: true });
    }

    console.log('🔍 Fetching Firebase database statistics with getCountFromServer...');

    const collectionStats: CollectionStats[] = [];
    let totalDocuments = 0;
    let estimatedTotalSize = 0;

    // Run all count queries in parallel — much faster and still only 1 read each
    await Promise.all(
      COLLECTIONS.map(async (collectionName) => {
        try {
          const colRef = collection(db, collectionName);

          // ✅ getCountFromServer = 1 read regardless of collection size
          const countSnapshot = await getCountFromServer(colRef);
          const count = countSnapshot.data().count;

          if (count > 0) {
            // Only fetch the last-updated doc for non-empty collections (1 read each)
            let lastUpdated = 'Unknown';
            try {
              const lastDocSnap = await getDocs(
                query(colRef, orderBy('updatedAt', 'desc'), limit(1))
              );
              if (!lastDocSnap.empty) {
                const raw = lastDocSnap.docs[0].data().updatedAt;
                lastUpdated = raw?.toDate?.()?.toLocaleDateString() ?? 'Unknown';
              }
            } catch {
              // updatedAt field may not exist in every collection — silently skip
            }

            const estimatedSize = count * 1024; // ~1 KB per document estimate

            collectionStats.push({ name: collectionName, count, estimatedSize, lastUpdated });
            totalDocuments += count;
            estimatedTotalSize += estimatedSize;
          }
        } catch (error) {
          console.warn(`⚠️ Could not analyze collection ${collectionName}:`, error);
        }
      })
    );

    // Sort largest first
    collectionStats.sort((a, b) => b.count - a.count);

    const stats: FirebaseStats = {
      totalCollections: collectionStats.length,
      totalDocuments,
      estimatedTotalSize,
      collections: collectionStats,
      lastChecked: new Date().toISOString(),
      servedFromCache: false,
    };

    // ── Populate cache ────────────────────────────────────────────────────────
    cachedStats = stats;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    console.log(`✅ Stats fetched: ${totalDocuments} docs across ${collectionStats.length} collections`);
    return NextResponse.json(stats);

  } catch (error) {
    console.error('❌ Error fetching Firebase stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Firebase statistics' },
      { status: 500 }
    );
  }
}
