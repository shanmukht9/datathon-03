/**
 * @fileoverview Global React context for CivicPriority application state.
 *
 * Manages:
 * - Citizen reports
 * - Canonical issues
 * - Loaded location evidence (from API)
 * - Current user role and identity
 * - Dashboard stats
 */

'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
  ReactNode,
} from 'react';
import {
  CitizenReport,
  CanonicalIssue,
  LocationEvidence,
  DashboardStats,
  Department,
  WorkerAssignment,
  CaseEvent,
  CaseStatus,
  ResolutionEvidence,
} from '@/lib/types';
import {
  getAllReports,
  getAllIssues,
  saveReport,
  saveIssue,
  updateIssue,
  updateReport,
  generateIssueId,
  generateReportId,
} from '@/lib/persistence';
import { findDuplicate, linkReportToIssue } from '@/lib/dedupEngine';
import { SEED_ISSUES, SEED_REPORTS, DEMO_WORKERS } from '@/lib/seedData';

// ─── State shape ──────────────────────────────────────────────────────────

export type UserRole = 'citizen' | 'officer' | 'worker' | null;

export interface AppUser {
  role: UserRole;
  userId: string;
  department?: Department;
}

export interface AppState {
  user: AppUser;
  reports: CitizenReport[];
  issues: CanonicalIssue[];
  evidence: Record<string, LocationEvidence>; // locationId → evidence
  workers: WorkerAssignment[];
  dashboardStats: DashboardStats | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
}

const initialState: AppState = {
  user: { role: null, userId: '' },
  reports: [],
  issues: [],
  evidence: {},
  workers: DEMO_WORKERS,
  dashboardStats: null,
  loading: false,
  initialized: false,
  error: null,
};

// ─── Actions ──────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_USER'; user: AppUser }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'INITIALIZE'; reports: CitizenReport[]; issues: CanonicalIssue[] }
  | { type: 'ADD_REPORT'; report: CitizenReport; issue: CanonicalIssue }
  | { type: 'UPDATE_ISSUE'; issue: CanonicalIssue }
  | { type: 'UPDATE_REPORT'; report: CitizenReport }
  | { type: 'SET_EVIDENCE'; evidence: Record<string, LocationEvidence> }
  | { type: 'SET_DASHBOARD_STATS'; stats: DashboardStats }
  | { type: 'UPDATE_WORKER'; worker: WorkerAssignment };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.user };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'INITIALIZE':
      return {
        ...state,
        reports: action.reports,
        issues: action.issues,
        initialized: true,
        loading: false,
      };
    case 'ADD_REPORT': {
      const existingIssueIdx = state.issues.findIndex(
        (i) => i.issueId === action.issue.issueId
      );
      const updatedIssues =
        existingIssueIdx >= 0
          ? state.issues.map((i) =>
              i.issueId === action.issue.issueId ? action.issue : i
            )
          : [...state.issues, action.issue];
      return {
        ...state,
        reports: [...state.reports, action.report],
        issues: updatedIssues,
      };
    }
    case 'UPDATE_ISSUE':
      return {
        ...state,
        issues: state.issues.map((i) =>
          i.issueId === action.issue.issueId ? action.issue : i
        ),
      };
    case 'UPDATE_REPORT':
      return {
        ...state,
        reports: state.reports.map((r) =>
          r.reportId === action.report.reportId ? action.report : r
        ),
      };
    case 'SET_EVIDENCE':
      return { ...state, evidence: action.evidence };
    case 'SET_DASHBOARD_STATS':
      return { ...state, dashboardStats: action.stats };
    case 'UPDATE_WORKER':
      return {
        ...state,
        workers: state.workers.map((w) =>
          w.workerId === action.worker.workerId ? action.worker : w
        ),
      };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  setUser: (user: AppUser) => void;
  submitReport: (
    data: Omit<CitizenReport, 'reportId' | 'status' | 'canonicalIssueId' | 'submittedAt'>
  ) => Promise<{ reportId: string; issueId: string; isDuplicate: boolean }>;
  assignIssue: (issueId: string, workerId: string) => Promise<void>;
  updateIssueStatus: (issueId: string, status: CaseStatus, note?: string, actorId?: string, actorRole?: CaseEvent['actorRole']) => Promise<void>;
  submitResolutionEvidence: (issueId: string, evidence: ResolutionEvidence) => Promise<void>;
  verifyResolution: (issueId: string, officerId: string, accepted: boolean, note?: string) => Promise<void>;
  refreshFromDB: () => Promise<void>;
  loadEvidenceData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────

/** Compute dashboard stats from current state */
function computeDashboardStats(
  reports: CitizenReport[],
  issues: CanonicalIssue[],
  evidenceMap: Record<string, LocationEvidence>
): DashboardStats {
  const totalLocations = Object.keys(evidenceMap).length;
  const totalIncidents = Object.values(evidenceMap).reduce(
    (s, e) => s + e.totalIncidents,
    0
  );
  const totalComplaints = Object.values(evidenceMap).reduce(
    (s, e) => s + e.totalComplaints,
    0
  );
  const openIssues = issues.filter(
    (i) => i.status !== 'Resolved'
  ).length;
  const newCitizenReports = reports.filter(
    (r) => !r.isSeeded && r.status === 'Reported'
  ).length;
  const duplicateLinkedCount = issues.reduce(
    (s, i) => s + Math.max(0, i.reportCount - 1),
    0
  );
  const highPriorityLocations = issues.filter(
    (i) => i.priority.band === 'Critical' || i.priority.band === 'High'
  ).length;

  const departmentCounts = {} as DashboardStats['departmentCounts'];
  for (const issue of issues) {
    departmentCounts[issue.department] = (departmentCounts[issue.department] ?? 0) + 1;
  }

  const oneDayAgo = Date.now() - 24 * 3600000;
  const resolvedToday = issues.filter(
    (i) => i.status === 'Resolved' && new Date(i.lastReportedAt).getTime() > oneDayAgo
  ).length;

  return {
    totalLocations,
    totalIncidents,
    totalComplaints,
    openIssues,
    newCitizenReports,
    duplicateLinkedCount,
    highPriorityLocations,
    departmentCounts,
    resolvedToday,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  /** Initialize from IndexedDB + seed data on first load */
  const refreshFromDB = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const [dbReports, dbIssues] = await Promise.all([
        getAllReports(),
        getAllIssues(),
      ]);

      // Merge seed data with DB data (seeds only if not already present)
      const allIssueIds = new Set(dbIssues.map((i) => i.issueId));
      const seedIssuesToAdd = SEED_ISSUES.filter((s) => !allIssueIds.has(s.issueId));
      for (const seed of seedIssuesToAdd) {
        await saveIssue(seed);
      }

      const allReportIds = new Set(dbReports.map((r) => r.reportId));
      const seedReportsToAdd = SEED_REPORTS.filter((r) => !allReportIds.has(r.reportId));
      for (const seed of seedReportsToAdd) {
        await saveReport(seed);
      }

      const [finalReports, finalIssues] = await Promise.all([
        getAllReports(),
        getAllIssues(),
      ]);

      dispatch({ type: 'INITIALIZE', reports: finalReports, issues: finalIssues });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: String(err) });
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  }, []);

  /** Load aggregated evidence from the API route */
  const loadEvidenceData = useCallback(async () => {
    try {
      const res = await fetch('/api/evidence');
      if (!res.ok) return;
      const data = await res.json() as { evidence: Record<string, LocationEvidence> };
      dispatch({ type: 'SET_EVIDENCE', evidence: data.evidence });
    } catch {
      // Evidence loading is non-critical; app still functions without it
    }
  }, []);

  useEffect(() => {
    refreshFromDB();
    loadEvidenceData();
  }, [refreshFromDB, loadEvidenceData]);

  // Recompute dashboard stats whenever data changes
  useEffect(() => {
    if (!state.initialized) return;
    const stats = computeDashboardStats(state.reports, state.issues, state.evidence);
    dispatch({ type: 'SET_DASHBOARD_STATS', stats });
  }, [state.reports, state.issues, state.evidence, state.initialized]);

  const setUser = useCallback((user: AppUser) => {
    dispatch({ type: 'SET_USER', user });
  }, []);

  /** Submit a new citizen report, applying duplicate detection */
  const submitReport = useCallback(
    async (
      data: Omit<CitizenReport, 'reportId' | 'status' | 'canonicalIssueId' | 'submittedAt'>
    ): Promise<{ reportId: string; issueId: string; isDuplicate: boolean }> => {
      const reportId = generateReportId();
      const submittedAt = new Date().toISOString();

      const report: CitizenReport = {
        ...data,
        reportId,
        submittedAt,
        status: 'Reported',
        canonicalIssueId: null,
      };

      // Duplicate detection
      const dupResult = findDuplicate(report, state.issues);

      let canonicalIssue: CanonicalIssue;
      let isDuplicate = false;

      if (dupResult.matched && dupResult.canonicalIssueId) {
        // Link to existing canonical issue
        isDuplicate = true;
        const existing = state.issues.find(
          (i) => i.issueId === dupResult.canonicalIssueId
        )!;
        canonicalIssue = linkReportToIssue(existing, report);

        // Add duplicate_linked event
        const event: CaseEvent = {
          eventId: `EVT-${reportId}-dup`,
          issueId: canonicalIssue.issueId,
          type: 'duplicate_linked',
          timestamp: submittedAt,
          actorId: reportId,
          actorRole: 'system',
          description: `Report ${reportId} linked as duplicate (${dupResult.distanceMeters?.toFixed(0)}m, ${dupResult.timeDeltaHours?.toFixed(1)}h window).`,
        };
        canonicalIssue = { ...canonicalIssue, events: [...canonicalIssue.events, event] };

        report.canonicalIssueId = canonicalIssue.issueId;
        report.status = canonicalIssue.status;
      } else {
        // Create new canonical issue
        const issueId = generateIssueId();
        const event: CaseEvent = {
          eventId: `EVT-${issueId}-created`,
          issueId,
          type: 'created',
          timestamp: submittedAt,
          actorId: reportId,
          actorRole: 'citizen',
          description: `Issue created from report ${reportId}.`,
        };

        canonicalIssue = {
          issueId,
          locationId: data.locationId,
          latitude: data.latitude,
          longitude: data.longitude,
          category: data.category,
          title: `${data.category.replace('_', ' ')} issue at (${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)})`,
          description: data.description,
          severity: data.severity,
          status: 'Reported',
          department: (await import('@/lib/priorityEngine')).suggestDepartment(data.category),
          assignedWorkerId: null,
          reportIds: [reportId],
          reportCount: 1,
          firstReportedAt: submittedAt,
          lastReportedAt: submittedAt,
          priority: {
            total: 0,
            severityScore: 0,
            frequencyScore: 0,
            localContextScore: 0,
            vulnerabilityScore: 0,
            unresolvedHistoryScore: 0,
            citizenReportBonus: 0,
            components: [],
            band: 'Low',
            primaryReason: 'Priority not yet calculated.',
            modelUnresolvedProb: null,
          },
          events: [event],
          resolutionEvidence: null,
          isSeeded: false,
        };
        report.canonicalIssueId = issueId;
      }

      // Persist
      await saveReport(report);
      await saveIssue(canonicalIssue);

      dispatch({ type: 'ADD_REPORT', report, issue: canonicalIssue });

      return { reportId, issueId: canonicalIssue.issueId, isDuplicate };
    },
    [state.issues]
  );

  const assignIssue = useCallback(
    async (issueId: string, workerId: string) => {
      const issue = state.issues.find((i) => i.issueId === issueId);
      if (!issue) return;

      const worker = state.workers.find((w) => w.workerId === workerId);
      const event: CaseEvent = {
        eventId: `EVT-${issueId}-assign-${Date.now()}`,
        issueId,
        type: 'assigned',
        timestamp: new Date().toISOString(),
        actorId: state.user.userId || 'officer',
        actorRole: 'officer',
        description: `Issue assigned to ${worker?.workerName ?? workerId}.`,
      };

      const updated: CanonicalIssue = {
        ...issue,
        assignedWorkerId: workerId,
        status: 'Assigned',
        events: [...issue.events, event],
      };

      await updateIssue(updated);
      dispatch({ type: 'UPDATE_ISSUE', issue: updated });

      // Update worker assignment list
      const updatedWorker = state.workers.find((w) => w.workerId === workerId);
      if (updatedWorker && !updatedWorker.assignedIssueIds.includes(issueId)) {
        dispatch({
          type: 'UPDATE_WORKER',
          worker: {
            ...updatedWorker,
            assignedIssueIds: [...updatedWorker.assignedIssueIds, issueId],
          },
        });
      }
    },
    [state.issues, state.workers, state.user.userId]
  );

  const updateIssueStatus = useCallback(
    async (
      issueId: string,
      status: CaseStatus,
      note?: string,
      actorId?: string,
      actorRole: CaseEvent['actorRole'] = 'system'
    ) => {
      const issue = state.issues.find((i) => i.issueId === issueId);
      if (!issue) return;

      const event: CaseEvent = {
        eventId: `EVT-${issueId}-status-${Date.now()}`,
        issueId,
        type: 'status_changed',
        timestamp: new Date().toISOString(),
        actorId: actorId ?? 'system',
        actorRole,
        description: note ?? `Status changed to ${status}.`,
      };

      const updated: CanonicalIssue = {
        ...issue,
        status,
        events: [...issue.events, event],
      };

      await updateIssue(updated);
      dispatch({ type: 'UPDATE_ISSUE', issue: updated });
    },
    [state.issues]
  );

  const submitResolutionEvidence = useCallback(
    async (issueId: string, evidence: ResolutionEvidence) => {
      const issue = state.issues.find((i) => i.issueId === issueId);
      if (!issue) return;

      const event: CaseEvent = {
        eventId: `EVT-${issueId}-evidence-${Date.now()}`,
        issueId,
        type: 'evidence_submitted',
        timestamp: new Date().toISOString(),
        actorId: evidence.submittedBy,
        actorRole: 'worker',
        description: `Resolution evidence submitted by ${evidence.submittedBy}. Note: ${evidence.note}`,
      };

      const statusEvent: CaseEvent = {
        eventId: `EVT-${issueId}-pv-${Date.now()}`,
        issueId,
        type: 'status_changed',
        timestamp: new Date().toISOString(),
        actorId: evidence.submittedBy,
        actorRole: 'worker',
        description: 'Status changed to Pending Verification after evidence submission.',
      };

      const updated: CanonicalIssue = {
        ...issue,
        status: 'Pending Verification',
        resolutionEvidence: evidence,
        events: [...issue.events, event, statusEvent],
      };

      await updateIssue(updated);
      dispatch({ type: 'UPDATE_ISSUE', issue: updated });
    },
    [state.issues]
  );

  const verifyResolution = useCallback(
    async (issueId: string, officerId: string, accepted: boolean, note?: string) => {
      const issue = state.issues.find((i) => i.issueId === issueId);
      if (!issue) return;

      const newStatus: CaseStatus = accepted ? 'Resolved' : 'Reopened';
      const eventType: CaseEvent['type'] = accepted ? 'officer_verified' : 'officer_rejected';

      const event: CaseEvent = {
        eventId: `EVT-${issueId}-verify-${Date.now()}`,
        issueId,
        type: eventType,
        timestamp: new Date().toISOString(),
        actorId: officerId,
        actorRole: 'officer',
        description: note ?? (accepted ? 'Officer confirmed resolution.' : 'Officer rejected closure — case reopened.'),
      };

      const updated: CanonicalIssue = {
        ...issue,
        status: newStatus,
        events: [...issue.events, event],
      };

      await updateIssue(updated);
      dispatch({ type: 'UPDATE_ISSUE', issue: updated });

      // Update linked reports
      for (const reportId of issue.reportIds) {
        const rep = state.reports.find((r) => r.reportId === reportId);
        if (rep) {
          const updatedRep: CitizenReport = { ...rep, status: newStatus };
          await updateReport(updatedRep);
          dispatch({ type: 'UPDATE_REPORT', report: updatedRep });
        }
      }
    },
    [state.issues, state.reports]
  );

  return (
    <AppContext.Provider
      value={{
        state,
        setUser,
        submitReport,
        assignIssue,
        updateIssueStatus,
        submitResolutionEvidence,
        verifyResolution,
        refreshFromDB,
        loadEvidenceData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

/** Hook to consume app context */
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
