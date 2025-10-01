// Core Types
export type DutyServiceModule = 'prefectoral' | 'duty_management' | 'duty_assessment' | 'operations' | 'collage';

export type PositionOfHonour = 1 | 2 | 3 | 4 | 5; // 1 = Highest rank
export type ReignDuration = 'termly' | 'yearly' | 'custom';
export type DutyFrequency = 'one_time' | 'daily' | 'weekly' | 'monthly' | 'termly' | 'yearly';
export type TeamType = 'staff' | 'prefects' | 'pupils';
export type PollType = 'best_prefect' | 'best_staff' | 'best_pupil';
export type RankingPeriod = 'weekly' | 'monthly' | 'termly' | 'yearly';

// Prefectoral Management Types
export interface PrefectoralPost {
  id: string;
  postName: string;
  positionOfHonour: PositionOfHonour;
  reignDuration: ReignDuration;
  allowance?: number;
  isActive: boolean;
  academicYearId: string;
  termId?: string;
  customStartDate?: string;
  customEndDate?: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
}

export interface PostAssignment {
  id: string;
  postId: string;
  pupilId: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  performanceRating?: number;
  notes?: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
}

// Duty Management Types
export interface DutyRota {
  id: string;
  dutyName: string;
  teamsInvolved: TeamType[];
  frequency: DutyFrequency;
  startDate: string;
  endDate: string;
  allowances: Record<TeamType, number>;
  isActive: boolean;
  academicYearId: string;
  termId?: string;
  isMarked?: boolean; // New field for marked duty rotas
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
}

export interface DutyAssignment {
  id: string;
  rotaId: string;
  memberId: string;
  memberType: TeamType;
  startDate: string;
  endDate: string;
  isSupervisor: boolean;
  isActive: boolean;
  performanceRating?: number;
  notes?: string;
  service?: string; // Description of what the member/team will be doing
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
}

// Duty Assessment Types
export interface DutyAssessment {
  id: string;
  rotaId: string;
  assessmentDate: string;
  assessorId: string;
  assessorType: TeamType;
  ratings: Array<{
    memberId: string;
    memberType: TeamType;
    rating: number;
    comments?: string;
  }>;
  overallRating: number;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

// Operations Types
export interface Poll {
  id: string;
  pollType: PollType;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  voters: Array<{
    voterId: string;
    voterType: TeamType;
    votedFor: string;
    votedAt: string;
  }>;
  results: Array<{
    candidateId: string;
    candidateType: TeamType;
    votes: number;
    percentage: number;
  }>;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
}

// Collage Types
export interface PerformanceRanking {
  id: string;
  rankingPeriod: RankingPeriod;
  startDate: string;
  endDate: string;
  rankings: Array<{
    memberId: string;
    memberType: TeamType;
    totalScore: number;
    averageRating: number;
    pollsWon: number;
    dutiesCompleted: number;
    rank: number;
  }>;
  createdAt: string;
  updatedAt?: string;
}

// Create/Update Data Types
export type CreatePrefectoralPostData = Omit<PrefectoralPost, 'id' | 'createdAt' | 'createdBy' | 'updatedAt'>;
export type UpdatePrefectoralPostData = Partial<Omit<PrefectoralPost, 'id' | 'createdAt' | 'createdBy'>>;
export type CreatePostAssignmentData = Omit<PostAssignment, 'id' | 'createdAt' | 'createdBy' | 'updatedAt'>;
export type CreateDutyRotaData = Omit<DutyRota, 'id' | 'createdAt' | 'createdBy' | 'updatedAt'>;
export type UpdateDutyRotaData = Partial<Omit<DutyRota, 'id' | 'createdAt' | 'createdBy'>>;
export type CreateDutyAssignmentData = Omit<DutyAssignment, 'id' | 'createdAt' | 'createdBy' | 'updatedAt'>;
export type CreateBulkDutyAssignmentData = {
  rotaId: string;
  periodNumber: number;
  service?: string; // Service description for the entire bulk assignment
  assignments: Array<{
    memberId: string;
    memberType: TeamType;
    isSupervisor: boolean;
  }>;
};
export type CreatePollData = Omit<Poll, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'voters' | 'results'>;
export type CreatePerformanceRankingData = Omit<PerformanceRanking, 'id' | 'createdAt' | 'updatedAt'>;

// Enhanced types with related data
export interface PrefectoralPostWithAssignments extends PrefectoralPost {
  assignments: PostAssignment[];
  currentAssignment?: PostAssignment;
}

export interface DutyRotaWithAssignments extends DutyRota {
  assignments: DutyAssignment[];
  currentAssignments: DutyAssignment[];
}

export interface PollWithResults extends Poll {
  totalVotes: number;
  isVotingOpen: boolean;
  winner?: {
    candidateId: string;
    candidateType: TeamType;
    votes: number;
    percentage: number;
  };
}

// Timeline and Period Types
export interface DutyPeriod {
  periodNumber: number;
  startDate: string;
  endDate: string;
  periodName: string; // e.g., "Week 1", "Week 2", "Term 1", etc.
  assignments: DutyAssignment[];
  isCompleted: boolean;
  isCurrent: boolean;
  isUpcoming: boolean;
}

export interface DutyTimeline {
  rotaId: string;
  rotaName: string;
  frequency: DutyFrequency;
  periods: DutyPeriod[];
  totalPeriods: number;
  completedPeriods: number;
  currentPeriod?: DutyPeriod;
  upcomingPeriods: DutyPeriod[];
}

// Utility types for filtering and searching
export interface DutyServiceFilters {
  academicYearId?: string;
  termId?: string;
  isActive?: boolean;
  teamType?: TeamType;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

export interface DutyServiceStats {
  totalPosts: number;
  activePosts: number;
  totalRotas: number;
  activeRotas: number;
  totalAssignments: number;
  activeAssignments: number;
  totalPolls: number;
  activePolls: number;
  totalRankings: number;
}
