/**
 * @fileoverview Priority scoring engine.
 *
 * Computes a 0–100 priority score for each location/canonical issue,
 * broken down into five weighted components with human-readable explanations.
 *
 * Weights (provisional design choices, documented):
 *   Severity:          30%
 *   Frequency:         25%
 *   Local context:     20%
 *   Vulnerability:     15%
 *   Unresolved history: 10%
 *
 * Citizen report count adds a capped bonus (max +8 pts).
 */

import {
  LocationEvidence,
  PriorityBreakdown,
  PriorityComponent,
  SeverityLevel,
} from './types';

// ─── Score band thresholds ────────────────────────────────────────────────

export function scoreToBand(score: number): 'Low' | 'Medium' | 'High' | 'Critical' {
  if (score >= 75) return 'Critical';
  if (score >= 55) return 'High';
  if (score >= 35) return 'Medium';
  return 'Low';
}

// ─── Normalization helpers ────────────────────────────────────────────────

/** Clamp value to [0, 1]. */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Min-max normalize a value using soft caps.
 * Values above cap are clamped to 1.
 */
function normCapped(value: number, cap: number): number {
  return clamp01(value / cap);
}

// ─── Severity component ───────────────────────────────────────────────────

const SEVERITY_WEIGHTS: Record<SeverityLevel, number> = {
  Low: 0.1,
  Medium: 0.4,
  High: 0.75,
  Critical: 1.0,
};

/**
 * Score severity component based on worst recorded severity and distribution.
 * @returns raw score in [0, 1]
 */
function scoreSeverity(ev: LocationEvidence, citizenSeverity?: SeverityLevel): number {
  const { severityDist, totalIncidents, maxSeverityIncidents } = ev;
  if (totalIncidents === 0 && !citizenSeverity) return 0;

  // Base: weighted average severity from incidents
  const total = totalIncidents || 1;
  const weightedAvg =
    (severityDist.Low * 0.1 +
      severityDist.Medium * 0.4 +
      severityDist.High * 0.75 +
      severityDist.Critical * 1.0) /
    total;

  // Boost for max severity
  const maxBoost = SEVERITY_WEIGHTS[maxSeverityIncidents] * 0.3;

  // Citizen report severity input
  const citizenBoost = citizenSeverity ? SEVERITY_WEIGHTS[citizenSeverity] * 0.3 : 0;

  return clamp01(weightedAvg * 0.7 + maxBoost + citizenBoost);
}

// ─── Frequency component ──────────────────────────────────────────────────

/**
 * Score incident + complaint frequency. Uses log scaling to prevent
 * extremely high counts from dominating.
 * @returns raw score in [0, 1]
 */
function scoreFrequency(ev: LocationEvidence, citizenReportCount: number): number {
  // Historical incidents (cap at 30 for normalization)
  const incidentScore = normCapped(Math.log1p(ev.totalIncidents), Math.log1p(30));

  // Historical complaints
  const complaintScore = normCapped(Math.log1p(ev.totalComplaints), Math.log1p(20));

  // Citizen reports — bounded log to avoid gaming
  const citizenScore = normCapped(Math.log1p(citizenReportCount), Math.log1p(10));

  return clamp01(incidentScore * 0.5 + complaintScore * 0.3 + citizenScore * 0.2);
}

// ─── Local context component ──────────────────────────────────────────────

const ROAD_CONDITION_SCORES: Record<string, number> = {
  critical: 1.0,
  poor: 0.75,
  fair: 0.45,
  good: 0.2,
  excellent: 0.05,
};

const PEDESTRIAN_SCORES: Record<string, number> = {
  high: 1.0,
  medium: 0.55,
  low: 0.2,
};

const ROAD_TYPE_SCORES: Record<string, number> = {
  arterial: 0.9,
  collector: 0.65,
  residential: 0.4,
  highway: 0.85,
  local: 0.35,
};

/**
 * Score local context: road condition, pedestrian activity, road type.
 * @returns raw score in [0, 1]
 */
function scoreLocalContext(ev: LocationEvidence): number {
  const roadCond =
    ROAD_CONDITION_SCORES[ev.roadCondition.toLowerCase()] ?? 0.3;
  const pedestrian =
    PEDESTRIAN_SCORES[ev.pedestrianActivity.toLowerCase()] ?? 0.3;
  const roadType =
    ROAD_TYPE_SCORES[ev.roadType.toLowerCase()] ?? 0.4;

  return clamp01(roadCond * 0.45 + pedestrian * 0.35 + roadType * 0.2);
}

// ─── Vulnerability component ──────────────────────────────────────────────

/**
 * Score vulnerability: proximity to schools/hospitals, population density.
 * @returns raw score in [0, 1]
 */
function scoreVulnerability(ev: LocationEvidence): number {
  const schoolBoost = ev.nearSchool ? 0.4 : 0;
  const hospitalBoost = ev.nearHospital ? 0.35 : 0;

  // Population density — normalize to a typical max of 15,000/km²
  const densityScore = normCapped(ev.populationDensity, 15000);

  // High priority complaints proportion
  const highComplaintRatio =
    ev.totalComplaints > 0
      ? clamp01(ev.highPriorityComplaints / ev.totalComplaints)
      : 0;

  return clamp01(
    schoolBoost + hospitalBoost + densityScore * 0.15 + highComplaintRatio * 0.1
  );
}

// ─── Unresolved history component ────────────────────────────────────────

/**
 * Score based on unresolved incidents, complaints, and resolution delay.
 * ML model unresolved probability may contribute here.
 * @returns raw score in [0, 1]
 */
function scoreUnresolvedHistory(
  ev: LocationEvidence,
  modelUnresolvedProb: number | null
): number {
  const unresolvedIncidentRatio =
    ev.totalIncidents > 0
      ? clamp01(ev.unresolvedIncidents / ev.totalIncidents)
      : 0;

  const unresolvedComplaintRatio =
    ev.totalComplaints > 0
      ? clamp01(ev.unresolvedComplaints / ev.totalComplaints)
      : 0;

  // Resolution delay — normalize to 72h cap
  const delayScore =
    ev.avgResolutionHours !== null
      ? normCapped(ev.avgResolutionHours, 72)
      : 0.4; // assume moderate if unknown

  // ML model contribution (weighted at 25% of this component)
  const mlScore = modelUnresolvedProb !== null ? modelUnresolvedProb : 0;

  return clamp01(
    unresolvedIncidentRatio * 0.35 +
      unresolvedComplaintRatio * 0.25 +
      delayScore * 0.15 +
      mlScore * 0.25
  );
}

// ─── Main scoring function ────────────────────────────────────────────────

const COMPONENT_WEIGHTS = {
  severity: 0.30,
  frequency: 0.25,
  localContext: 0.20,
  vulnerability: 0.15,
  unresolvedHistory: 0.10,
};

/**
 * Compute a full priority breakdown for a location.
 *
 * @param ev                 - Aggregated location evidence
 * @param citizenReportCount - Number of linked citizen reports
 * @param citizenSeverity    - Worst severity from citizen reports (optional)
 * @param modelUnresolvedProb - ML model output (optional, 0–1)
 */
export function computePriority(
  ev: LocationEvidence,
  citizenReportCount = 0,
  citizenSeverity?: SeverityLevel,
  modelUnresolvedProb: number | null = null
): PriorityBreakdown {
  const rawSeverity = scoreSeverity(ev, citizenSeverity);
  const rawFrequency = scoreFrequency(ev, citizenReportCount);
  const rawContext = scoreLocalContext(ev);
  const rawVulnerability = scoreVulnerability(ev);
  const rawUnresolved = scoreUnresolvedHistory(ev, modelUnresolvedProb);

  const components: PriorityComponent[] = [
    {
      label: 'Severity',
      weight: COMPONENT_WEIGHTS.severity,
      rawScore: rawSeverity,
      weightedScore: rawSeverity * COMPONENT_WEIGHTS.severity,
      explanation: buildSeverityExplanation(ev, rawSeverity),
    },
    {
      label: 'Historical Frequency',
      weight: COMPONENT_WEIGHTS.frequency,
      rawScore: rawFrequency,
      weightedScore: rawFrequency * COMPONENT_WEIGHTS.frequency,
      explanation: buildFrequencyExplanation(ev, citizenReportCount),
    },
    {
      label: 'Local Context',
      weight: COMPONENT_WEIGHTS.localContext,
      rawScore: rawContext,
      weightedScore: rawContext * COMPONENT_WEIGHTS.localContext,
      explanation: buildContextExplanation(ev),
    },
    {
      label: 'Vulnerability',
      weight: COMPONENT_WEIGHTS.vulnerability,
      rawScore: rawVulnerability,
      weightedScore: rawVulnerability * COMPONENT_WEIGHTS.vulnerability,
      explanation: buildVulnerabilityExplanation(ev),
    },
    {
      label: 'Unresolved History',
      weight: COMPONENT_WEIGHTS.unresolvedHistory,
      rawScore: rawUnresolved,
      weightedScore: rawUnresolved * COMPONENT_WEIGHTS.unresolvedHistory,
      explanation: buildUnresolvedExplanation(ev, modelUnresolvedProb),
    },
  ];

  const baseScore = components.reduce((s, c) => s + c.weightedScore, 0);

  // Capped citizen report bonus: max +8 points (log scaled)
  const reportBonus = Math.min(
    8,
    citizenReportCount > 0 ? Math.log1p(citizenReportCount) * 3 : 0
  );

  const total = Math.min(100, Math.round((baseScore * 100) + reportBonus));

  const band = scoreToBand(total);
  const primaryReason = buildPrimaryReason(components, ev, band);

  return {
    total,
    severityScore: Math.round(rawSeverity * 100),
    frequencyScore: Math.round(rawFrequency * 100),
    localContextScore: Math.round(rawContext * 100),
    vulnerabilityScore: Math.round(rawVulnerability * 100),
    unresolvedHistoryScore: Math.round(rawUnresolved * 100),
    citizenReportBonus: Math.round(reportBonus),
    components,
    band,
    primaryReason,
    modelUnresolvedProb,
  };
}

// ─── Explanation builders ─────────────────────────────────────────────────

function buildSeverityExplanation(ev: LocationEvidence, score: number): string {
  if (score > 0.7) {
    return `${ev.severityDist.High + ev.severityDist.Critical} high/critical incidents recorded. Worst severity: ${ev.maxSeverityIncidents}.`;
  }
  if (score > 0.4) {
    return `Mix of Medium and High severity incidents at this location. Max severity: ${ev.maxSeverityIncidents}.`;
  }
  return `Mostly low-severity incidents recorded (${ev.totalIncidents} total). Max: ${ev.maxSeverityIncidents}.`;
}

function buildFrequencyExplanation(ev: LocationEvidence, citizenCount: number): string {
  const parts: string[] = [];
  if (ev.totalIncidents > 0) parts.push(`${ev.totalIncidents} historical incident(s)`);
  if (ev.totalComplaints > 0) parts.push(`${ev.totalComplaints} complaint(s)`);
  if (citizenCount > 0) parts.push(`${citizenCount} citizen report(s)`);
  return parts.length > 0
    ? `Recurring issue: ${parts.join(', ')}.`
    : 'No historical frequency data available.';
}

function buildContextExplanation(ev: LocationEvidence): string {
  const parts: string[] = [
    `${ev.roadCondition} road condition`,
    `${ev.pedestrianActivity} pedestrian activity`,
    `${ev.roadType} road type`,
  ];
  return parts.join(', ') + '.';
}

function buildVulnerabilityExplanation(ev: LocationEvidence): string {
  const flags: string[] = [];
  if (ev.nearSchool) flags.push('near a school');
  if (ev.nearHospital) flags.push('near a hospital');
  if (ev.populationDensity > 8000) flags.push(`high population density (${ev.populationDensity.toLocaleString()}/km²)`);
  if (flags.length === 0) return 'No critical vulnerability indicators detected.';
  return `Vulnerable context: ${flags.join(', ')}.`;
}

function buildUnresolvedExplanation(ev: LocationEvidence, mlProb: number | null): string {
  const parts: string[] = [];
  if (ev.unresolvedIncidents > 0)
    parts.push(`${ev.unresolvedIncidents}/${ev.totalIncidents} incidents unresolved`);
  if (ev.unresolvedComplaints > 0)
    parts.push(`${ev.unresolvedComplaints}/${ev.totalComplaints} complaints unresolved`);
  if (ev.avgResolutionHours !== null)
    parts.push(`avg ${ev.avgResolutionHours.toFixed(1)}h to resolve`);
  if (mlProb !== null)
    parts.push(`ML unresolved probability: ${(mlProb * 100).toFixed(0)}%`);
  return parts.length > 0 ? parts.join('; ') + '.' : 'No resolution delay data available.';
}

function buildPrimaryReason(
  components: PriorityComponent[],
  ev: LocationEvidence,
  band: string
): string {
  const top = [...components].sort((a, b) => b.weightedScore - a.weightedScore)[0];
  const prefix = band === 'Critical' ? 'CRITICAL: ' : band === 'High' ? 'HIGH: ' : '';
  return `${prefix}Primary driver: ${top.label} (${top.explanation.split('.')[0]}).`;
}

// ─── Department routing ───────────────────────────────────────────────────

import { IssueCategory, Department } from './types';

const CATEGORY_TO_DEPARTMENT: Record<IssueCategory, Department> = {
  pothole: 'Roads Department',
  road_damage: 'Roads Department',
  flooding: 'Drainage & Public Works',
  drainage: 'Drainage & Public Works',
  streetlight: 'Electrical Department',
  traffic_signal: 'Traffic & Signals',
  pedestrian_safety: 'Roads & Safety',
  collision: 'Roads & Safety',
  other: 'General',
};

/**
 * Suggest department based on issue category.
 */
export function suggestDepartment(category: IssueCategory): Department {
  return CATEGORY_TO_DEPARTMENT[category] ?? 'General';
}

/**
 * Normalize incident_type strings from CSV to IssueCategory.
 */
export function incidentTypeToCategory(type: string): IssueCategory {
  const t = type.toLowerCase();
  if (t.includes('pothole')) return 'pothole';
  if (t.includes('road')) return 'road_damage';
  if (t.includes('flood')) return 'flooding';
  if (t.includes('drain')) return 'drainage';
  if (t.includes('light') || t.includes('lamp')) return 'streetlight';
  if (t.includes('traffic') || t.includes('signal')) return 'traffic_signal';
  if (t.includes('pedestrian')) return 'pedestrian_safety';
  if (t.includes('collision') || t.includes('accident')) return 'collision';
  return 'other';
}
