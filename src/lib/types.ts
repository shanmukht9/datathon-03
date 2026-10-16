/**
 * @fileoverview Shared TypeScript types for Nagrik platform.
 * These types are used across data ingestion, ML, scoring, UI, and persistence layers.
 */

// ─── CSV source row types ──────────────────────────────────────────────────

export interface LocationRow {
  location_id: string;
  zone: string;
  road_type: string;
  road_condition: string;
  population_density_per_km2: number;
  near_school: boolean;
  near_hospital: boolean;
  pedestrian_activity: string;
  latitude: number;
  longitude: number;
}

export interface IncidentRow {
  incident_id: string;
  location_id: string;
  timestamp: Date;
  incident_type: string;
  severity: SeverityLevel;
  injuries: number;
  reported_by: string;
  resolved: boolean;
  resolution_hours: number | null;
}

export interface ComplaintRow {
  complaint_id: string;
  location_id: string;
  created_at: Date;
  category: string;
  priority_reported: string;
  status: string;
  days_to_resolution: number | null;
}

// ─── Severity & Status enums ───────────────────────────────────────────────

export type SeverityLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type CaseStatus =
  | 'Reported'
  | 'Reviewed'
  | 'Assigned'
  | 'In Progress'
  | 'Pending Verification'
  | 'Resolved'
  | 'Reopened';

export type IssueCategory =
  | 'pothole'
  | 'road_damage'
  | 'flooding'
  | 'drainage'
  | 'streetlight'
  | 'traffic_signal'
  | 'pedestrian_safety'
  | 'collision'
  | 'other';

export type Department =
  | 'Roads Department'
  | 'Drainage & Public Works'
  | 'Electrical Department'
  | 'Traffic & Signals'
  | 'Roads & Safety'
  | 'General';

// ─── Aggregated location evidence ─────────────────────────────────────────

export interface IncidentSeverityDist {
  Low: number;
  Medium: number;
  High: number;
  Critical: number;
}

export interface LocationEvidence {
  locationId: string;
  latitude: number;
  longitude: number;
  zone: string;
  roadType: string;
  roadCondition: string;
  populationDensity: number;
  nearSchool: boolean;
  nearHospital: boolean;
  pedestrianActivity: string;

  // Incident aggregates
  totalIncidents: number;
  severityDist: IncidentSeverityDist;
  incidentTypeCounts: Record<string, number>;
  totalInjuries: number;
  unresolvedIncidents: number;
  avgResolutionHours: number | null;
  maxSeverityIncidents: SeverityLevel;

  // Complaint aggregates
  totalComplaints: number;
  complaintCategoryCounts: Record<string, number>;
  unresolvedComplaints: number;
  avgDaysToResolution: number | null;
  highPriorityComplaints: number;
}

// ─── ML model types ───────────────────────────────────────────────────────

export interface ModelFeatures {
  // Numeric (standardized)
  injuries: number;
  resolution_hours_norm: number;

  // One-hot encoded
  severity_Low: number;
  severity_Medium: number;
  severity_High: number;
  severity_Critical: number;

  incident_type_Pothole: number;
  incident_type_Flooding: number;
  incident_type_Drainage: number;
  incident_type_Streetlight: number;
  incident_type_Traffic: number;
  incident_type_Collision: number;
  incident_type_Other: number;

  reported_by_Citizen: number;
  reported_by_Officer: number;
  reported_by_Worker: number;
}

export interface ModelParameters {
  weights: number[];
  bias: number;
  featureNames: string[];
  trainMean: number[];
  trainStd: number[];
  trainedAt: string;
  epochs: number;
  learningRate: number;
  finalLoss: number;
}

export interface ModelEvaluation {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  rocAuc: number | null;
  confusionMatrix: {
    tp: number;
    fp: number;
    tn: number;
    fn: number;
  };
  testSize: number;
  trainSize: number;
  classBalance: { resolved: number; unresolved: number };
}

// ─── Priority scoring ─────────────────────────────────────────────────────

export interface PriorityBreakdown {
  total: number; // 0–100
  severityScore: number;
  frequencyScore: number;
  localContextScore: number;
  vulnerabilityScore: number;
  unresolvedHistoryScore: number;
  citizenReportBonus: number;
  components: PriorityComponent[];
  band: 'Low' | 'Medium' | 'High' | 'Critical';
  primaryReason: string;
  modelUnresolvedProb: number | null;
}

export interface PriorityComponent {
  label: string;
  weight: number;
  rawScore: number;
  weightedScore: number;
  explanation: string;
}

// ─── Citizen reports & canonical issues ──────────────────────────────────

export interface CitizenReport {
  reportId: string;
  locationId: string | null; // nearest matched or null
  latitude: number;
  longitude: number;
  category: IssueCategory;
  description: string;
  severity: SeverityLevel;
  imageDataUrl: string | null; // stored separately in IndexedDB
  imageKey: string | null;
  submittedAt: string; // ISO
  submittedBy: string; // anonymous display name
  status: CaseStatus;
  canonicalIssueId: string | null; // linked after dedup
  isSeeded?: boolean;
}

export interface CanonicalIssue {
  issueId: string;
  locationId: string | null;
  latitude: number;
  longitude: number;
  category: IssueCategory;
  title: string;
  description: string;

  severity: SeverityLevel;
  status: CaseStatus;
  department: Department;
  assignedWorkerId: string | null;

  reportIds: string[]; // linked citizen reports
  reportCount: number;
  firstReportedAt: string;
  lastReportedAt: string;

  priority: PriorityBreakdown;
  events: CaseEvent[];

  resolutionEvidence: ResolutionEvidence | null;
  isSeeded: boolean; // true = demo seed record
}

// ─── Department & assignment ──────────────────────────────────────────────

export interface WorkerAssignment {
  workerId: string;
  workerName: string;
  department: Department;
  assignedIssueIds: string[];
}

// ─── Resolution evidence ─────────────────────────────────────────────────

export interface ResolutionEvidence {
  submittedBy: string; // workerId
  submittedAt: string;
  note: string;
  imageKey: string | null; // IndexedDB image key
  latitude: number | null;
  longitude: number | null;
  locationCaptureMethod: 'gps' | 'manual' | 'none';
}

// ─── Case event timeline ─────────────────────────────────────────────────

export type CaseEventType =
  | 'created'
  | 'duplicate_linked'
  | 'reviewed'
  | 'assigned'
  | 'status_changed'
  | 'worker_update'
  | 'evidence_submitted'
  | 'officer_verified'
  | 'officer_rejected'
  | 'reopened'
  | 'priority_recalculated';

export interface CaseEvent {
  eventId: string;
  issueId: string;
  type: CaseEventType;
  timestamp: string;
  actorId: string;
  actorRole: 'citizen' | 'officer' | 'worker' | 'system';
  description: string;
  metadata?: Record<string, unknown>;
}

// ─── Dashboard summary ────────────────────────────────────────────────────

export interface DashboardStats {
  totalLocations: number;
  totalIncidents: number;
  totalComplaints: number;
  openIssues: number;
  newCitizenReports: number;
  duplicateLinkedCount: number;
  highPriorityLocations: number;
  departmentCounts: Record<Department, number>;
  resolvedToday: number;
}

// ─── Intervention comparison ──────────────────────────────────────────────

export interface InterventionOption {
  id: string;
  title: string;
  category: IssueCategory;
  description: string;
  urgency: 'Immediate' | 'Short-term' | 'Planned';
  estimatedCostLabel: string; // illustrative only, clearly labeled
  expectedBenefit: string;
  feasibility: 'High' | 'Medium' | 'Low';
  recommendationReason: string;
}

// ─── Map types ────────────────────────────────────────────────────────────

export interface MapMarker {
  locationId: string;
  latitude: number;
  longitude: number;
  priorityScore: number;
  priorityBand: 'Low' | 'Medium' | 'High' | 'Critical';
  issueCount: number;
  canonicalIssueIds: string[];
  topCategory: string;
  label: string;
}
