/**
 * @fileoverview Unit tests for the Nagrik Explainable Priority Engine.
 */

import { describe, it, expect } from 'vitest';
import {
  computePriority,
  suggestDepartment,
  incidentTypeToCategory,
} from '../lib/priorityEngine';
import { LocationEvidence, SeverityLevel } from '../lib/types';

const mockEvidence: LocationEvidence = {
  locationId: 'L0116',
  zone: 'Zone-3',
  roadType: 'Secondary',
  roadCondition: 'Poor',
  populationDensity: 4500,
  nearSchool: true,
  nearHospital: false,
  pedestrianActivity: 'High',
  latitude: 16.45,
  longitude: 80.52,
  totalIncidents: 12,
  severityDist: { Low: 2, Medium: 4, High: 4, Critical: 2 },
  incidentTypeCounts: { Pothole: 8, Flooding: 4 },
  totalInjuries: 3,
  unresolvedIncidents: 4,
  avgResolutionHours: 48,
  maxSeverityIncidents: 'Critical',
  totalComplaints: 6,
  complaintCategoryCounts: { Pothole: 6 },
  unresolvedComplaints: 2,
  avgDaysToResolution: 5,
  highPriorityComplaints: 3,
};

describe('Priority Engine', () => {
  it('computes a valid priority score between 0 and 100', () => {
    const result = computePriority({
      severity: 'Critical',
      category: 'Pothole',
      reportCount: 3,
      evidence: mockEvidence,
      mlUnresolvedProb: 0.65,
    });

    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect(['Low', 'Medium', 'High', 'Critical']).toContain(result.band);
    expect(result.factorContributions.length).toBe(5);
  });

  it('assigns higher score to Critical severity than Low severity', () => {
    const criticalScore = computePriority({
      severity: 'Critical',
      category: 'Pothole',
      reportCount: 1,
      evidence: mockEvidence,
      mlUnresolvedProb: 0.5,
    });

    const lowScore = computePriority({
      severity: 'Low',
      category: 'Pothole',
      reportCount: 1,
      evidence: mockEvidence,
      mlUnresolvedProb: 0.5,
    });

    expect(criticalScore.totalScore).toBeGreaterThan(lowScore.totalScore);
  });

  it('correctly routes issue categories to appropriate departments', () => {
    expect(suggestDepartment('Pothole')).toBe('Roads Department');
    expect(suggestDepartment('Road Damage')).toBe('Roads Department');
    expect(suggestDepartment('Flooding')).toBe('Drainage & Public Works');
    expect(suggestDepartment('Drainage')).toBe('Drainage & Public Works');
    expect(suggestDepartment('Streetlight')).toBe('Electrical Department');
    expect(suggestDepartment('Traffic Signal')).toBe('Traffic & Signals');
    expect(suggestDepartment('Pedestrian Safety')).toBe('Traffic & Signals');
  });

  it('maps incident types to issue categories properly', () => {
    expect(incidentTypeToCategory('Pothole')).toBe('Pothole');
    expect(incidentTypeToCategory('Flooding')).toBe('Flooding');
    expect(incidentTypeToCategory('Drainage Leak')).toBe('Drainage');
    expect(incidentTypeToCategory('Streetlight Out')).toBe('Streetlight');
  });
});
