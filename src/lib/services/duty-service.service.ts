import { db } from '@/lib/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp,
  limit,
  startAfter,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import type { 
  PrefectoralPost,
  PostAssignment,
  DutyRota,
  DutyAssignment,
  DutyAssessment,
  Poll,
  PerformanceRanking,
  CreatePrefectoralPostData,
  UpdatePrefectoralPostData,
  CreatePostAssignmentData,
  CreateDutyRotaData,
  UpdateDutyRotaData,
  CreateDutyAssignmentData,
  CreateBulkDutyAssignmentData,
  CreatePollData,
  CreatePerformanceRankingData,
  DutyServiceFilters,
  DutyServiceStats,
  PrefectoralPostWithAssignments,
  DutyRotaWithAssignments
} from '@/types/duty-service';

// Collection names
const PREFECTORAL_POSTS_COLLECTION = 'prefectoralPosts';
const POST_ASSIGNMENTS_COLLECTION = 'postAssignments';
const DUTY_ROTAS_COLLECTION = 'dutyRotas';
const DUTY_ASSIGNMENTS_COLLECTION = 'dutyAssignments';
const DUTY_ASSESSMENTS_COLLECTION = 'dutyAssessments';
const POLLS_COLLECTION = 'polls';
const PERFORMANCE_RANKINGS_COLLECTION = 'performanceRankings';

export class DutyServiceService {
  // ===== UTILITY METHODS =====
  
  /**
   * Filter out undefined values from an object to make it Firebase-compatible
   */
  private static filterUndefinedValues(obj: any): any {
    const filtered: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }
    return filtered;
  }

  // ===== PREFECTORAL MANAGEMENT =====
  
  static async createPrefectoralPost(data: CreatePrefectoralPostData): Promise<string> {
    try {
      const postsRef = collection(db, PREFECTORAL_POSTS_COLLECTION);
      const postData = this.filterUndefinedValues({
        ...data,
        isActive: true,
        createdAt: serverTimestamp()
      });
      const docRef = await addDoc(postsRef, postData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating prefectoral post:', error);
      throw error;
    }
  }

  static async getPrefectoralPosts(academicYearId?: string): Promise<PrefectoralPost[]> {
    try {
      const postsRef = collection(db, PREFECTORAL_POSTS_COLLECTION);
      let q;
      
      if (academicYearId) {
        q = query(postsRef, where('academicYearId', '==', academicYearId));
      } else {
        q = query(postsRef);
      }
      
      const snapshot = await getDocs(q);
      const posts = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined
        } as PrefectoralPost;
      });
      
      // Sort by positionOfHonour in ascending order in JavaScript
      return posts.sort((a, b) => a.positionOfHonour - b.positionOfHonour);
    } catch (error) {
      console.error('Error getting prefectoral posts:', error);
      return [];
    }
  }

  static async getPrefectoralPostById(id: string): Promise<PrefectoralPost | null> {
    try {
      const docRef = doc(db, PREFECTORAL_POSTS_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined
        } as PrefectoralPost;
      }
      return null;
    } catch (error) {
      console.error('Error getting prefectoral post by ID:', error);
      return null;
    }
  }

  static async updatePrefectoralPost(id: string, data: UpdatePrefectoralPostData): Promise<void> {
    try {
      const docRef = doc(db, PREFECTORAL_POSTS_COLLECTION, id);
      await updateDoc(docRef, this.filterUndefinedValues({
        ...data,
        updatedAt: serverTimestamp()
      }));
    } catch (error) {
      console.error('Error updating prefectoral post:', error);
      throw error;
    }
  }

  static async deletePrefectoralPost(id: string): Promise<void> {
    try {
      const docRef = doc(db, PREFECTORAL_POSTS_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting prefectoral post:', error);
      throw error;
    }
  }

  static async assignPupilToPost(data: CreatePostAssignmentData): Promise<string> {
    try {
      const assignmentsRef = collection(db, POST_ASSIGNMENTS_COLLECTION);
      const assignmentData = this.filterUndefinedValues({
        ...data,
        isActive: true,
        createdAt: serverTimestamp()
      });
      const docRef = await addDoc(assignmentsRef, assignmentData);
      return docRef.id;
    } catch (error) {
      console.error('Error assigning pupil to post:', error);
      throw error;
    }
  }

  static async getPostAssignments(postId?: string): Promise<PostAssignment[]> {
    try {
      const assignmentsRef = collection(db, POST_ASSIGNMENTS_COLLECTION);
      let q;
      
      if (postId) {
        q = query(assignmentsRef, where('postId', '==', postId));
      } else {
        q = query(assignmentsRef);
      }
      
      const snapshot = await getDocs(q);
      const assignments = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined
        } as PostAssignment;
      });
      
      // Sort by startDate in descending order in JavaScript
      return assignments.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    } catch (error) {
      console.error('Error getting post assignments:', error);
      return [];
    }
  }

  // ===== DUTY MANAGEMENT =====
  
  static async createDutyRota(data: CreateDutyRotaData): Promise<string> {
    try {
      const rotasRef = collection(db, DUTY_ROTAS_COLLECTION);
      const rotaData = this.filterUndefinedValues({
        ...data,
        isActive: true,
        isMarked: data.isMarked || false,
        createdAt: serverTimestamp()
      });
      const docRef = await addDoc(rotasRef, rotaData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating duty rota:', error);
      throw error;
    }
  }

  static async getDutyRotas(academicYearId?: string): Promise<DutyRota[]> {
    try {
      const rotasRef = collection(db, DUTY_ROTAS_COLLECTION);
      let q;
      
      if (academicYearId) {
        q = query(rotasRef, where('academicYearId', '==', academicYearId));
      } else {
        q = query(rotasRef);
      }
      
      const snapshot = await getDocs(q);
      const rotas = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined
        } as DutyRota;
      });
      
      // Sort by dutyName in ascending order in JavaScript
      return rotas.sort((a, b) => a.dutyName.localeCompare(b.dutyName));
    } catch (error) {
      console.error('Error getting duty rotas:', error);
      return [];
    }
  }

  static async getDutyRotaById(id: string): Promise<DutyRota | null> {
    try {
      const docRef = doc(db, DUTY_ROTAS_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined
        } as DutyRota;
      }
      return null;
    } catch (error) {
      console.error('Error getting duty rota by ID:', error);
      return null;
    }
  }

  static async updateDutyRota(id: string, data: UpdateDutyRotaData): Promise<void> {
    try {
      const docRef = doc(db, DUTY_ROTAS_COLLECTION, id);
      await updateDoc(docRef, this.filterUndefinedValues({
        ...data,
        updatedAt: serverTimestamp()
      }));
    } catch (error) {
      console.error('Error updating duty rota:', error);
      throw error;
    }
  }

  static async deleteDutyRota(id: string): Promise<void> {
    try {
      const docRef = doc(db, DUTY_ROTAS_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting duty rota:', error);
      throw error;
    }
  }

  // ===== DUTY ASSESSMENT =====
  
  static async assignMemberToDuty(data: CreateDutyAssignmentData): Promise<string> {
    try {
      const assignmentsRef = collection(db, DUTY_ASSIGNMENTS_COLLECTION);
      const assignmentData = this.filterUndefinedValues({
        ...data,
        isActive: true,
        createdAt: serverTimestamp()
      });
      const docRef = await addDoc(assignmentsRef, assignmentData);
      return docRef.id;
    } catch (error) {
      console.error('Error assigning member to duty:', error);
      throw error;
    }
  }

  static async getDutyAssignments(rotaId?: string): Promise<DutyAssignment[]> {
    try {
      const assignmentsRef = collection(db, DUTY_ASSIGNMENTS_COLLECTION);
      let q;
      
      if (rotaId) {
        q = query(assignmentsRef, where('rotaId', '==', rotaId));
      } else {
        q = query(assignmentsRef);
      }
      
      const snapshot = await getDocs(q);
      const assignments = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined
        } as DutyAssignment;
      });
      
      // Sort by startDate in descending order in JavaScript
      return assignments.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    } catch (error) {
      console.error('Error getting duty assignments:', error);
      return [];
    }
  }

  static async updateDutyAssignment(id: string, data: Partial<DutyAssignment>): Promise<void> {
    try {
      const docRef = doc(db, DUTY_ASSIGNMENTS_COLLECTION, id);
      await updateDoc(docRef, this.filterUndefinedValues({
        ...data,
        updatedAt: serverTimestamp()
      }));
    } catch (error) {
      console.error('Error updating duty assignment:', error);
      throw error;
    }
  }

  static async deleteDutyAssignment(id: string): Promise<void> {
    try {
      const docRef = doc(db, DUTY_ASSIGNMENTS_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting duty assignment:', error);
      throw error;
    }
  }

  static async deletePostAssignment(id: string): Promise<void> {
    try {
      const docRef = doc(db, POST_ASSIGNMENTS_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting post assignment:', error);
      throw error;
    }
  }

  // ===== OPERATIONS =====
  
  static async createPoll(data: CreatePollData): Promise<string> {
    try {
      const pollsRef = collection(db, POLLS_COLLECTION);
      const pollData = this.filterUndefinedValues({
        ...data,
        isActive: true,
        voters: [],
        results: [],
        createdAt: serverTimestamp()
      });
      const docRef = await addDoc(pollsRef, pollData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating poll:', error);
      throw error;
    }
  }

  static async getPolls(academicYearId?: string): Promise<Poll[]> {
    try {
      const pollsRef = collection(db, POLLS_COLLECTION);
      let q;
      
      if (academicYearId) {
        q = query(pollsRef, where('academicYearId', '==', academicYearId));
      } else {
        q = query(pollsRef);
      }
      
      const snapshot = await getDocs(q);
      const polls = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined
        } as Poll;
      });
      
      // Sort by createdAt in descending order in JavaScript
      return polls.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error getting polls:', error);
      return [];
    }
  }

  static async voteInPoll(pollId: string, voterId: string, voterType: string, votedFor: string): Promise<void> {
    try {
      const docRef = doc(db, POLLS_COLLECTION, pollId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const poll = docSnap.data() as Poll;
        const newVoter = {
          voterId,
          voterType,
          votedFor,
          votedAt: new Date().toISOString()
        };
        
        const updatedVoters = [...poll.voters, newVoter];
        
        // Calculate results
        const voteCounts: Record<string, number> = {};
        updatedVoters.forEach(voter => {
          voteCounts[voter.votedFor] = (voteCounts[voter.votedFor] || 0) + 1;
        });
        
        const totalVotes = updatedVoters.length;
        const results = Object.entries(voteCounts).map(([candidateId, votes]) => ({
          candidateId,
          candidateType: 'staff' as const, // This should be determined from the candidate data
          votes,
          percentage: (votes / totalVotes) * 100
        }));
        
        await updateDoc(docRef, {
          voters: updatedVoters,
          results,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error voting in poll:', error);
      throw error;
    }
  }

  // ===== COLLAGE =====
  
  static async createPerformanceRanking(data: CreatePerformanceRankingData): Promise<string> {
    try {
      const rankingsRef = collection(db, PERFORMANCE_RANKINGS_COLLECTION);
      const rankingData = this.filterUndefinedValues({
        ...data,
        createdAt: serverTimestamp()
      });
      const docRef = await addDoc(rankingsRef, rankingData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating performance ranking:', error);
      throw error;
    }
  }

  static async getPerformanceRankings(period?: string): Promise<PerformanceRanking[]> {
    try {
      const rankingsRef = collection(db, PERFORMANCE_RANKINGS_COLLECTION);
      let q;
      
      if (period) {
        q = query(rankingsRef, where('rankingPeriod', '==', period));
      } else {
        q = query(rankingsRef);
      }
      
      const snapshot = await getDocs(q);
      const rankings = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined
        } as PerformanceRanking;
      });
      
      // Sort by createdAt in descending order in JavaScript
      return rankings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error getting performance rankings:', error);
      return [];
    }
  }

  // ===== UTILITY METHODS =====

  static async getDutyServiceStats(academicYearId?: string): Promise<DutyServiceStats> {
    try {
      const [posts, rotas, assignments, polls, rankings] = await Promise.all([
        this.getPrefectoralPosts(academicYearId),
        this.getDutyRotas(academicYearId),
        this.getDutyAssignments(),
        this.getPolls(academicYearId),
        this.getPerformanceRankings()
      ]);

      return {
        totalPosts: posts.length,
        activePosts: posts.filter(p => p.isActive).length,
        totalRotas: rotas.length,
        activeRotas: rotas.filter(r => r.isActive).length,
        totalAssignments: assignments.length,
        activeAssignments: assignments.filter(a => a.isActive).length,
        totalPolls: polls.length,
        activePolls: polls.filter(p => p.isActive).length,
        totalRankings: rankings.length
      };
    } catch (error) {
      console.error('Error getting duty service stats:', error);
      return {
        totalPosts: 0,
        activePosts: 0,
        totalRotas: 0,
        activeRotas: 0,
        totalAssignments: 0,
        activeAssignments: 0,
        totalPolls: 0,
        activePolls: 0,
        totalRankings: 0
      };
    }
  }

  static async getPrefectoralPostWithAssignments(id: string): Promise<PrefectoralPostWithAssignments | null> {
    try {
      const [post, assignments] = await Promise.all([
        this.getPrefectoralPostById(id),
        this.getPostAssignments(id)
      ]);

      if (!post) return null;

      const currentAssignment = assignments.find(a => a.isActive);

      return {
        ...post,
        assignments,
        currentAssignment
      };
    } catch (error) {
      console.error('Error getting prefectoral post with assignments:', error);
      return null;
    }
  }

  static async getDutyRotaWithAssignments(id: string): Promise<DutyRotaWithAssignments | null> {
    try {
      const [rota, assignments] = await Promise.all([
        this.getDutyRotaById(id),
        this.getDutyAssignments(id)
      ]);

      if (!rota) return null;

      const currentAssignments = assignments.filter(a => a.isActive);

      return {
        ...rota,
        assignments,
        currentAssignments
      };
    } catch (error) {
      console.error('Error getting duty rota with assignments:', error);
      return null;
    }
  }

  // ===== TIMELINE METHODS =====

  static generateDutyTimeline(rota: DutyRota, assignments: DutyAssignment[]): DutyTimeline {
    const periods: DutyPeriod[] = [];
    const startDate = new Date(rota.startDate);
    const endDate = new Date(rota.endDate);
    const currentDate = new Date();
    
    let periodNumber = 1;
    let currentPeriodStart = new Date(startDate);

    while (currentPeriodStart < endDate) {
      let periodEnd: Date;
      let periodName: string;

      switch (rota.frequency) {
        case 'daily':
          periodEnd = new Date(currentPeriodStart);
          periodEnd.setDate(periodEnd.getDate());
          periodName = `Day ${periodNumber}`;
          break;
        case 'weekly':
          periodEnd = new Date(currentPeriodStart);
          periodEnd.setDate(periodEnd.getDate() + 6);
          periodName = `Week ${periodNumber}`;
          break;
        case 'monthly':
          periodEnd = new Date(currentPeriodStart);
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          periodEnd.setDate(periodEnd.getDate() - 1);
          periodName = `Month ${periodNumber}`;
          break;
        case 'termly':
          periodEnd = new Date(endDate);
          periodName = `Term ${periodNumber}`;
          break;
        case 'yearly':
          periodEnd = new Date(endDate);
          periodName = `Year ${periodNumber}`;
          break;
        default:
          periodEnd = new Date(currentPeriodStart);
          periodName = `Period ${periodNumber}`;
      }

      // Ensure period doesn't exceed the overall end date
      if (periodEnd > endDate) {
        periodEnd = new Date(endDate);
      }

      const periodStartStr = currentPeriodStart.toISOString().split('T')[0];
      const periodEndStr = periodEnd.toISOString().split('T')[0];

      // Find assignments for this period
      const periodAssignments = assignments.filter(assignment => 
        assignment.rotaId === rota.id &&
        assignment.startDate <= periodEndStr &&
        assignment.endDate >= periodStartStr
      );

      const isCompleted = periodEnd < currentDate;
      const isCurrent = currentPeriodStart <= currentDate && currentDate <= periodEnd;
      const isUpcoming = currentPeriodStart > currentDate;

      periods.push({
        periodNumber,
        startDate: periodStartStr,
        endDate: periodEndStr,
        periodName,
        assignments: periodAssignments,
        isCompleted,
        isCurrent,
        isUpcoming
      });

      // Move to next period
      if (rota.frequency === 'termly' || rota.frequency === 'yearly') {
        break; // Only one period for termly/yearly
      }
      
      currentPeriodStart = new Date(periodEnd);
      currentPeriodStart.setDate(currentPeriodStart.getDate() + 1);
      periodNumber++;
    }

    const completedPeriods = periods.filter(p => p.isCompleted).length;
    const currentPeriod = periods.find(p => p.isCurrent);
    const upcomingPeriods = periods.filter(p => p.isUpcoming);

    return {
      rotaId: rota.id,
      rotaName: rota.dutyName,
      frequency: rota.frequency,
      periods,
      totalPeriods: periods.length,
      completedPeriods,
      currentPeriod,
      upcomingPeriods
    };
  }

  static async getDutyTimeline(rotaId: string): Promise<DutyTimeline> {
    try {
      const [rota, assignments] = await Promise.all([
        this.getDutyRotaById(rotaId),
        this.getDutyAssignments()
      ]);

      if (!rota) {
        throw new Error('Duty rota not found');
      }

      const rotaAssignments = assignments.filter(a => a.rotaId === rotaId);
      return this.generateDutyTimeline(rota, rotaAssignments);
    } catch (error) {
      console.error('Error getting duty timeline:', error);
      throw error;
    }
  }

  static async createBulkDutyAssignment(data: CreateBulkDutyAssignmentData): Promise<string[]> {
    try {
      const rota = await this.getDutyRotaById(data.rotaId);
      if (!rota) {
        throw new Error('Duty rota not found');
      }

      const timeline = await this.getDutyTimeline(data.rotaId);
      const targetPeriod = timeline.periods.find(p => p.periodNumber === data.periodNumber);
      
      if (!targetPeriod) {
        throw new Error('Period not found');
      }

      const assignmentIds: string[] = [];
      
             for (const assignmentData of data.assignments) {
         const assignmentId = await this.assignMemberToDuty({
           rotaId: data.rotaId,
           memberId: assignmentData.memberId,
           memberType: assignmentData.memberType,
           startDate: targetPeriod.startDate,
           endDate: targetPeriod.endDate,
           isSupervisor: assignmentData.isSupervisor,
           service: data.service,
         });
         assignmentIds.push(assignmentId);
       }

      return assignmentIds;
    } catch (error) {
      console.error('Error creating bulk duty assignment:', error);
      throw error;
    }
  }
}
