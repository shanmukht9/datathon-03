/**
 * @fileoverview Seeded demonstration data.
 *
 * These records are clearly labeled as demo seeds.
 * They are NOT real citizen reports and should be visually distinguished.
 * Seed data uses location IDs and coordinates from the supplied CSV dataset.
 */

import {
  CanonicalIssue,
  CitizenReport,
  CaseEvent,
  PriorityBreakdown,
  WorkerAssignment,
} from './types';

// ─── Demo worker assignments ──────────────────────────────────────────────

export const DEMO_WORKERS: WorkerAssignment[] = [
  {
    workerId: 'WORKER-001',
    workerName: 'Ramesh Kumar',
    department: 'Roads Department',
    assignedIssueIds: [],
  },
  {
    workerId: 'WORKER-002',
    workerName: 'Priya Sharma',
    department: 'Drainage & Public Works',
    assignedIssueIds: [],
  },
  {
    workerId: 'WORKER-003',
    workerName: 'Suresh Rao',
    department: 'Electrical Department',
    assignedIssueIds: [],
  },
];

// ─── Seed priority breakdowns (simplified, for demo purposes) ─────────────

function makePriority(
  total: number,
  band: 'Low' | 'Medium' | 'High' | 'Critical',
  reason: string
): PriorityBreakdown {
  return {
    total,
    severityScore: Math.round(total * 0.3),
    frequencyScore: Math.round(total * 0.25),
    localContextScore: Math.round(total * 0.2),
    vulnerabilityScore: Math.round(total * 0.15),
    unresolvedHistoryScore: Math.round(total * 0.1),
    citizenReportBonus: 3,
    components: [
      {
        label: 'Severity',
        weight: 0.3,
        rawScore: total / 100,
        weightedScore: (total / 100) * 0.3,
        explanation: 'High-severity incidents recorded at this location.',
      },
      {
        label: 'Historical Frequency',
        weight: 0.25,
        rawScore: total / 100,
        weightedScore: (total / 100) * 0.25,
        explanation: 'Multiple historical incidents and complaints.',
      },
      {
        label: 'Local Context',
        weight: 0.2,
        rawScore: total / 100,
        weightedScore: (total / 100) * 0.2,
        explanation: 'Poor road condition with high pedestrian activity.',
      },
      {
        label: 'Vulnerability',
        weight: 0.15,
        rawScore: total / 100,
        weightedScore: (total / 100) * 0.15,
        explanation: 'Location near school and hospital.',
      },
      {
        label: 'Unresolved History',
        weight: 0.1,
        rawScore: total / 100,
        weightedScore: (total / 100) * 0.1,
        explanation: 'Long average resolution time.',
      },
    ],
    band,
    primaryReason: reason,
    modelUnresolvedProb: 0.72,
  };
}

// ─── Seed events ──────────────────────────────────────────────────────────

function seedEvent(
  issueId: string,
  type: CaseEvent['type'],
  description: string,
  hoursAgo: number,
  actor = 'system',
  role: CaseEvent['actorRole'] = 'system'
): CaseEvent {
  const ts = new Date(Date.now() - hoursAgo * 3600000).toISOString();
  return {
    eventId: `EVT-${issueId}-${type}-${hoursAgo}`,
    issueId,
    type,
    timestamp: ts,
    actorId: actor,
    actorRole: role,
    description,
  };
}

// ─── Seed canonical issues ────────────────────────────────────────────────

export const SEED_ISSUES: CanonicalIssue[] = [
  {
    issueId: 'CI-SEED-001',
    locationId: 'L0116',
    latitude: 16.45321,
    longitude: 80.51234,
    category: 'pothole',
    title: 'Severe pothole cluster — Main Road junction',
    description:
      'Multiple deep potholes on the main arterial road near the L0116 junction. Causing vehicle damage and near-miss incidents.',
    severity: 'High',
    status: 'Assigned',
    department: 'Roads Department',
    assignedWorkerId: 'WORKER-001',
    reportIds: ['CR-SEED-001A', 'CR-SEED-001B'],
    reportCount: 2,
    firstReportedAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    lastReportedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    priority: makePriority(78, 'High', 'HIGH: Multiple high-severity pothole reports with 2 citizen reports confirming.'),
    events: [
      seedEvent('CI-SEED-001', 'created', 'Issue created from citizen report CR-SEED-001A', 48, 'citizen-anon', 'citizen'),
      seedEvent('CI-SEED-001', 'duplicate_linked', 'Report CR-SEED-001B linked as duplicate', 12, 'system'),
      seedEvent('CI-SEED-001', 'reviewed', 'Issue reviewed by Officer OFFICER-001', 10, 'OFFICER-001', 'officer'),
      seedEvent('CI-SEED-001', 'assigned', 'Assigned to WORKER-001 (Roads Department)', 8, 'OFFICER-001', 'officer'),
    ],
    resolutionEvidence: null,
    isSeeded: true,
  },
  {
    issueId: 'CI-SEED-002',
    locationId: 'L0802',
    latitude: 16.38234,
    longitude: 80.43512,
    category: 'flooding',
    title: 'Recurring flooding — residential drainage overflow',
    description:
      'Drainage overflow causes standing water 300mm deep. Road becomes impassable during rains. Near L0802.',
    severity: 'Critical',
    status: 'In Progress',
    department: 'Drainage & Public Works',
    assignedWorkerId: 'WORKER-002',
    reportIds: ['CR-SEED-002A'],
    reportCount: 1,
    firstReportedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    lastReportedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    priority: makePriority(88, 'Critical', 'CRITICAL: Critical flooding near school. High injury risk.'),
    events: [
      seedEvent('CI-SEED-002', 'created', 'Issue created from citizen report', 24, 'citizen-anon', 'citizen'),
      seedEvent('CI-SEED-002', 'reviewed', 'Reviewed by OFFICER-001', 20, 'OFFICER-001', 'officer'),
      seedEvent('CI-SEED-002', 'assigned', 'Assigned to WORKER-002', 18, 'OFFICER-001', 'officer'),
      seedEvent('CI-SEED-002', 'status_changed', 'Worker marked In Progress', 5, 'WORKER-002', 'worker'),
    ],
    resolutionEvidence: null,
    isSeeded: true,
  },
  {
    issueId: 'CI-SEED-003',
    locationId: 'L0428',
    latitude: 16.52134,
    longitude: 80.48921,
    category: 'streetlight',
    title: 'Streetlight failures — 4 consecutive poles dark',
    description:
      'Four streetlights on the collector road near L0428 have been non-functional for 6 days. Pedestrian safety concern.',
    severity: 'Medium',
    status: 'Pending Verification',
    department: 'Electrical Department',
    assignedWorkerId: 'WORKER-003',
    reportIds: ['CR-SEED-003A'],
    reportCount: 1,
    firstReportedAt: new Date(Date.now() - 72 * 3600000).toISOString(),
    lastReportedAt: new Date(Date.now() - 72 * 3600000).toISOString(),
    priority: makePriority(52, 'High', 'HIGH: Multiple streetlight failures affecting pedestrian safety at night.'),
    events: [
      seedEvent('CI-SEED-003', 'created', 'Issue created', 72, 'citizen-anon', 'citizen'),
      seedEvent('CI-SEED-003', 'assigned', 'Assigned to WORKER-003', 60, 'OFFICER-001', 'officer'),
      seedEvent('CI-SEED-003', 'status_changed', 'Worker set In Progress', 24, 'WORKER-003', 'worker'),
      seedEvent('CI-SEED-003', 'evidence_submitted', 'Worker submitted closure evidence', 2, 'WORKER-003', 'worker'),
      seedEvent('CI-SEED-003', 'status_changed', 'Status set to Pending Verification', 2, 'WORKER-003', 'worker'),
    ],
    resolutionEvidence: {
      submittedBy: 'WORKER-003',
      submittedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      note: 'All 4 faulty bulbs replaced. Tested and confirmed working.',
      imageKey: null,
      latitude: 16.52134,
      longitude: 80.48921,
      locationCaptureMethod: 'gps',
    },
    isSeeded: true,
  },
];

// ─── Seed citizen reports ─────────────────────────────────────────────────

export const SEED_REPORTS: CitizenReport[] = [
  {
    reportId: 'CR-SEED-001A',
    locationId: 'L0116',
    latitude: 16.45321,
    longitude: 80.51234,
    category: 'pothole',
    description: 'There are huge potholes at the main road junction near the market. My vehicle was damaged.',
    severity: 'High',
    imageDataUrl: null,
    imageKey: null,
    submittedAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    submittedBy: 'Citizen (Demo)',
    status: 'Assigned',
    canonicalIssueId: 'CI-SEED-001',
  },
  {
    reportId: 'CR-SEED-001B',
    locationId: 'L0116',
    latitude: 16.45325,
    longitude: 80.51230,
    category: 'pothole',
    description: 'Second pothole report at same location — roads are really bad here. Needs immediate repair.',
    severity: 'High',
    imageDataUrl: null,
    imageKey: null,
    submittedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    submittedBy: 'Citizen (Demo)',
    status: 'Assigned',
    canonicalIssueId: 'CI-SEED-001',
  },
  {
    reportId: 'CR-SEED-002A',
    locationId: 'L0802',
    latitude: 16.38234,
    longitude: 80.43512,
    category: 'flooding',
    description: 'Water is flooding the road. Kids cannot walk to school safely.',
    severity: 'Critical',
    imageDataUrl: null,
    imageKey: null,
    submittedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    submittedBy: 'Citizen (Demo)',
    status: 'In Progress',
    canonicalIssueId: 'CI-SEED-002',
  },
  {
    reportId: 'CR-SEED-003A',
    locationId: 'L0428',
    latitude: 16.52134,
    longitude: 80.48921,
    category: 'streetlight',
    description: 'All the streetlights are out. Very dark and unsafe at night.',
    severity: 'Medium',
    imageDataUrl: null,
    imageKey: null,
    submittedAt: new Date(Date.now() - 72 * 3600000).toISOString(),
    submittedBy: 'Citizen (Demo)',
    status: 'Pending Verification',
    canonicalIssueId: 'CI-SEED-003',
  },
];
