/**
 * @fileoverview Duplicate detection and report aggregation.
 *
 * Matches incoming citizen reports against existing canonical issues using:
 * - Spatial proximity (configurable radius in meters)
 * - Compatible issue categories
 * - Temporal proximity (configurable time window)
 *
 * NOTE: location_id alone does NOT trigger merging — the same location
 * can have multiple distinct canonical issues.
 */

import { CitizenReport, CanonicalIssue, IssueCategory, SeverityLevel } from './types';

// ─── Configuration ────────────────────────────────────────────────────────

export interface DedupConfig {
  /** Maximum spatial distance in meters to consider a report a duplicate */
  maxDistanceMeters: number;
  /** Maximum time window in hours to consider a report temporally related */
  maxTimeWindowHours: number;
}

export const DEFAULT_DEDUP_CONFIG: DedupConfig = {
  maxDistanceMeters: 150,
  maxTimeWindowHours: 72,
};

// ─── Haversine distance ───────────────────────────────────────────────────

/**
 * Compute great-circle distance in meters between two lat/lon points.
 */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── Category compatibility ───────────────────────────────────────────────

/**
 * Returns true if two categories are compatible for duplicate matching.
 * Some categories are grouped (e.g., pothole + road_damage).
 */
export function categoriesCompatible(a: IssueCategory, b: IssueCategory): boolean {
  if (a === b) return true;
  const groups: IssueCategory[][] = [
    ['pothole', 'road_damage'],
    ['flooding', 'drainage'],
    ['pedestrian_safety', 'collision'],
  ];
  for (const group of groups) {
    if (group.includes(a) && group.includes(b)) return true;
  }
  return false;
}

// ─── Worst severity ───────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<SeverityLevel, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3,
};

export function worstSeverity(a: SeverityLevel, b: SeverityLevel): SeverityLevel {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

// ─── Duplicate finder ─────────────────────────────────────────────────────

export interface DedupResult {
  matched: boolean;
  canonicalIssueId: string | null;
  distanceMeters: number | null;
  timeDeltaHours: number | null;
}

/**
 * Find the best-matching canonical issue for an incoming citizen report.
 * Returns the closest matching issue within the spatial and temporal windows.
 *
 * @param report           - Incoming citizen report
 * @param canonicalIssues  - All existing canonical issues
 * @param config           - Dedup configuration
 */
export function findDuplicate(
  report: CitizenReport,
  canonicalIssues: CanonicalIssue[],
  config: DedupConfig = DEFAULT_DEDUP_CONFIG
): DedupResult {
  const reportTime = new Date(report.submittedAt).getTime();

  let bestMatch: CanonicalIssue | null = null;
  let bestDistance = Infinity;
  let bestTimeDelta = Infinity;

  for (const issue of canonicalIssues) {
    // Skip resolved issues — a new report should open a new canonical issue
    if (issue.status === 'Resolved') continue;

    // Spatial proximity check
    const dist = haversineMeters(
      report.latitude,
      report.longitude,
      issue.latitude,
      issue.longitude
    );
    if (dist > config.maxDistanceMeters) continue;

    // Category compatibility check
    if (!categoriesCompatible(report.category, issue.category)) continue;

    // Temporal check: within window of the last report on the issue
    const lastReportTime = new Date(issue.lastReportedAt).getTime();
    const timeDeltaHours = Math.abs(reportTime - lastReportTime) / (1000 * 60 * 60);
    if (timeDeltaHours > config.maxTimeWindowHours) continue;

    // Prefer spatially closest match
    if (dist < bestDistance) {
      bestDistance = dist;
      bestTimeDelta = timeDeltaHours;
      bestMatch = issue;
    }
  }

  if (bestMatch) {
    return {
      matched: true,
      canonicalIssueId: bestMatch.issueId,
      distanceMeters: bestDistance,
      timeDeltaHours: bestTimeDelta,
    };
  }

  return { matched: false, canonicalIssueId: null, distanceMeters: null, timeDeltaHours: null };
}

// ─── Report-to-issue merging ──────────────────────────────────────────────

/**
 * Link a citizen report to an existing canonical issue.
 * Updates: reportIds, reportCount, lastReportedAt, severity (worst).
 * Does NOT recalculate priority — that is handled by the calling layer.
 */
export function linkReportToIssue(
  issue: CanonicalIssue,
  report: CitizenReport
): CanonicalIssue {
  if (issue.reportIds.includes(report.reportId)) return issue; // idempotent

  return {
    ...issue,
    reportIds: [...issue.reportIds, report.reportId],
    reportCount: issue.reportCount + 1,
    lastReportedAt: report.submittedAt > issue.lastReportedAt
      ? report.submittedAt
      : issue.lastReportedAt,
    severity: worstSeverity(issue.severity, report.severity),
  };
}
