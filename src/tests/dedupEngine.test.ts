/**
 * @fileoverview Unit tests for the Deduplication and Report Aggregation Engine.
 */

import { describe, it, expect } from 'vitest';
import {
  haversineMeters,
  categoriesCompatible,
  findDuplicate,
  worstSeverity,
} from '../lib/dedupEngine';
import { CanonicalIssue, CitizenReport } from '../lib/types';

describe('Deduplication Engine', () => {
  it('calculates Haversine distance correctly', () => {
    // 0 distance for identical points
    const dist0 = haversineMeters(16.5, 80.6, 16.5, 80.6);
    expect(dist0).toBeCloseTo(0, 1);

    // Known approximate distance: 1 deg lat is ~111,000 meters
    const dist1 = haversineMeters(16.0, 80.0, 16.001, 80.0);
    expect(dist1).toBeGreaterThan(100);
    expect(dist1).toBeLessThan(120);
  });

  it('verifies category compatibility groups', () => {
    expect(categoriesCompatible('Pothole', 'Road Damage')).toBe(true);
    expect(categoriesCompatible('Flooding', 'Drainage')).toBe(true);
    expect(categoriesCompatible('Streetlight', 'Traffic Signal')).toBe(false);
    expect(categoriesCompatible('Pothole', 'Streetlight')).toBe(false);
  });

  it('determines the worst severity accurately', () => {
    expect(worstSeverity('Low', 'High')).toBe('High');
    expect(worstSeverity('High', 'Critical')).toBe('Critical');
    expect(worstSeverity('Medium', 'Low')).toBe('Medium');
    expect(worstSeverity('Critical', 'Critical')).toBe('Critical');
  });

  it('detects duplicate report within radius and time window', () => {
    const existingIssue: CanonicalIssue = {
      issueId: 'CI-TEST-001',
      locationId: 'L0116',
      latitude: 16.5001,
      longitude: 80.6001,
      category: 'Pothole',
      title: 'Pothole reported',
      description: 'Big pothole',
      severity: 'Medium',
      status: 'Reported',
      department: 'Roads Department',
      assignedWorkerId: null,
      reportIds: ['REP-001'],
      reportCount: 1,
      firstReportedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      lastReportedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      priority: {
        totalScore: 60,
        band: 'Medium',
        factorContributions: [],
        topReasons: [],
      },
      events: [],
      resolutionEvidence: null,
      isSeeded: false,
    };

    const newDuplicateReport: CitizenReport = {
      reportId: 'REP-002',
      locationId: 'L0116',
      latitude: 16.5002, // very close (~15 meters)
      longitude: 80.6001,
      category: 'Pothole',
      description: 'Dangerous pothole here',
      severity: 'High',
      imageDataUrl: null,
      imageKey: null,
      submittedAt: new Date().toISOString(),
      submittedBy: 'Citizen',
      status: 'Reported',
      canonicalIssueId: null,
    };

    const match = findDuplicate(newDuplicateReport, [existingIssue]);
    expect(match).not.toBeNull();
    expect(match?.issueId).toBe('CI-TEST-001');
  });

  it('does NOT group issues with incompatible categories or distant coordinates', () => {
    const existingIssue: CanonicalIssue = {
      issueId: 'CI-TEST-001',
      locationId: 'L0116',
      latitude: 16.5001,
      longitude: 80.6001,
      category: 'Streetlight',
      title: 'Broken streetlight',
      description: 'Dark area',
      severity: 'Low',
      status: 'Reported',
      department: 'Electrical Department',
      assignedWorkerId: null,
      reportIds: ['REP-001'],
      reportCount: 1,
      firstReportedAt: new Date().toISOString(),
      lastReportedAt: new Date().toISOString(),
      priority: {
        totalScore: 40,
        band: 'Low',
        factorContributions: [],
        topReasons: [],
      },
      events: [],
      resolutionEvidence: null,
      isSeeded: false,
    };

    const distantReport: CitizenReport = {
      reportId: 'REP-003',
      locationId: 'L0802',
      latitude: 16.65, // far away (~16km)
      longitude: 80.75,
      category: 'Pothole',
      description: 'Pothole',
      severity: 'High',
      imageDataUrl: null,
      imageKey: null,
      submittedAt: new Date().toISOString(),
      submittedBy: 'Citizen',
      status: 'Reported',
      canonicalIssueId: null,
    };

    const match = findDuplicate(distantReport, [existingIssue]);
    expect(match).toBeNull();
  });
});
