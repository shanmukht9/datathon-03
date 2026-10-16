/**
 * @fileoverview CSV parser and data ingestion pipeline.
 * Reads locations.csv, incidents.csv, public_complaints.csv, validates,
 * aggregates by location_id, and builds LocationEvidence objects.
 */

import fs from 'fs';
import path from 'path';
import {
  LocationRow,
  IncidentRow,
  ComplaintRow,
  LocationEvidence,
  SeverityLevel,
  IncidentSeverityDist,
} from './types';

// ─── Helper: parse CSV text into rows ────────────────────────────────────

/**
 * Lightweight CSV parser. Handles quoted fields.
 * Returns an array of header-keyed objects.
 */
export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    if (values.length !== headers.length) continue; // skip malformed
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

/** Split a single CSV line respecting double-quoted fields. */
function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// ─── Numeric / Boolean parsers ────────────────────────────────────────────

function parseFloat2(v: string): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function parseInt2(v: string): number {
  const n = parseInt(v, 10);
  return isNaN(n) ? 0 : n;
}

function parseBool(v: string): boolean {
  return v === '1' || v.toLowerCase() === 'true';
}

function parseDate(v: string): Date {
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function parseSeverity(v: string): SeverityLevel {
  const map: Record<string, SeverityLevel> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
  };
  return map[v.toLowerCase()] ?? 'Medium';
}

// ─── Row parsers ──────────────────────────────────────────────────────────

/**
 * Parse a raw CSV row into a validated LocationRow.
 * Returns null if location_id or coordinates are missing/invalid.
 */
export function parseLocationRow(raw: Record<string, string>): LocationRow | null {
  const id = raw['location_id'];
  const lat = parseFloat2(raw['latitude']);
  const lon = parseFloat2(raw['longitude']);
  if (!id || lat === 0 || lon === 0) return null;

  return {
    location_id: id,
    zone: raw['zone'] || 'Unknown',
    road_type: raw['road_type'] || 'Unknown',
    road_condition: raw['road_condition'] || 'Unknown',
    population_density_per_km2: parseFloat2(raw['population_density_per_km2']),
    near_school: parseBool(raw['near_school']),
    near_hospital: parseBool(raw['near_hospital']),
    pedestrian_activity: raw['pedestrian_activity'] || 'Low',
    latitude: lat,
    longitude: lon,
  };
}

/**
 * Parse a raw CSV row into a validated IncidentRow.
 * Returns null if critical fields are missing.
 */
export function parseIncidentRow(raw: Record<string, string>): IncidentRow | null {
  const id = raw['incident_id'];
  const locId = raw['location_id'];
  if (!id || !locId) return null;

  const resHours = parseFloat2(raw['resolution_hours']);

  return {
    incident_id: id,
    location_id: locId,
    timestamp: parseDate(raw['timestamp']),
    incident_type: raw['incident_type'] || 'Other',
    severity: parseSeverity(raw['severity']),
    injuries: parseInt2(raw['injuries']),
    reported_by: raw['reported_by'] || 'Unknown',
    resolved: parseBool(raw['resolved']),
    resolution_hours: isNaN(parseFloat(raw['resolution_hours'])) ? null : resHours,
  };
}

/**
 * Parse a raw CSV row into a validated ComplaintRow.
 * Returns null if critical fields are missing.
 */
export function parseComplaintRow(raw: Record<string, string>): ComplaintRow | null {
  const id = raw['complaint_id'];
  const locId = raw['location_id'];
  if (!id || !locId) return null;

  const days = parseFloat(raw['days_to_resolution']);

  return {
    complaint_id: id,
    location_id: locId,
    created_at: parseDate(raw['created_at']),
    category: raw['category'] || 'Other',
    priority_reported: raw['priority_reported'] || 'Normal',
    status: raw['status'] || 'Open',
    days_to_resolution: isNaN(days) ? null : days,
  };
}

// ─── Aggregation ──────────────────────────────────────────────────────────

/** Build a map from location_id → aggregated incident stats. */
function aggregateIncidents(
  incidents: IncidentRow[]
): Map<string, {
  count: number;
  severityDist: IncidentSeverityDist;
  typeCounts: Record<string, number>;
  injuries: number;
  unresolved: number;
  resHours: number[];
  maxSeverity: SeverityLevel;
}> {
  const map = new Map<string, ReturnType<typeof aggregateIncidents> extends Map<string, infer V> ? V : never>();

  const severityOrder: Record<SeverityLevel, number> = { Low: 0, Medium: 1, High: 2, Critical: 3 };

  for (const inc of incidents) {
    if (!map.has(inc.location_id)) {
      map.set(inc.location_id, {
        count: 0,
        severityDist: { Low: 0, Medium: 0, High: 0, Critical: 0 },
        typeCounts: {},
        injuries: 0,
        unresolved: 0,
        resHours: [],
        maxSeverity: 'Low',
      });
    }
    const agg = map.get(inc.location_id)!;
    agg.count++;
    agg.severityDist[inc.severity]++;
    agg.typeCounts[inc.incident_type] = (agg.typeCounts[inc.incident_type] ?? 0) + 1;
    agg.injuries += inc.injuries;
    if (!inc.resolved) agg.unresolved++;
    if (inc.resolution_hours !== null) agg.resHours.push(inc.resolution_hours);
    if (severityOrder[inc.severity] > severityOrder[agg.maxSeverity]) {
      agg.maxSeverity = inc.severity;
    }
  }
  return map;
}

/** Build a map from location_id → aggregated complaint stats. */
function aggregateComplaints(
  complaints: ComplaintRow[]
): Map<string, {
  count: number;
  categoryCounts: Record<string, number>;
  unresolved: number;
  daysToResolution: number[];
  highPriority: number;
}> {
  const map = new Map<string, ReturnType<typeof aggregateComplaints> extends Map<string, infer V> ? V : never>();

  for (const c of complaints) {
    if (!map.has(c.location_id)) {
      map.set(c.location_id, {
        count: 0,
        categoryCounts: {},
        unresolved: 0,
        daysToResolution: [],
        highPriority: 0,
      });
    }
    const agg = map.get(c.location_id)!;
    agg.count++;
    agg.categoryCounts[c.category] = (agg.categoryCounts[c.category] ?? 0) + 1;
    if (c.status.toLowerCase() !== 'resolved') agg.unresolved++;
    if (c.days_to_resolution !== null) agg.daysToResolution.push(c.days_to_resolution);
    if (c.priority_reported.toLowerCase() === 'high' || c.priority_reported.toLowerCase() === 'urgent') {
      agg.highPriority++;
    }
  }
  return map;
}

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// ─── Main pipeline ────────────────────────────────────────────────────────

export interface DataPipeline {
  locations: LocationRow[];
  incidents: IncidentRow[];
  complaints: ComplaintRow[];
  evidence: Map<string, LocationEvidence>;
}

/**
 * Load and join all three CSVs from the filesystem.
 * This runs server-side (Node.js) only — never on the browser.
 */
export function loadDataPipeline(dataDir: string): DataPipeline {
  const readCSV = (filename: string) =>
    fs.readFileSync(path.join(dataDir, filename), 'utf-8');

  const locationRaws = parseCSV(readCSV('locations.csv'));
  const incidentRaws = parseCSV(readCSV('incidents.csv'));
  const complaintRaws = parseCSV(readCSV('public_complaints.csv'));

  const locations = locationRaws.map(parseLocationRow).filter(Boolean) as LocationRow[];
  const incidents = incidentRaws.map(parseIncidentRow).filter(Boolean) as IncidentRow[];
  const complaints = complaintRaws.map(parseComplaintRow).filter(Boolean) as ComplaintRow[];

  const incidentAgg = aggregateIncidents(incidents);
  const complaintAgg = aggregateComplaints(complaints);

  const evidence = new Map<string, LocationEvidence>();
  for (const loc of locations) {
    const inc = incidentAgg.get(loc.location_id) ?? {
      count: 0,
      severityDist: { Low: 0, Medium: 0, High: 0, Critical: 0 },
      typeCounts: {},
      injuries: 0,
      unresolved: 0,
      resHours: [],
      maxSeverity: 'Low' as SeverityLevel,
    };
    const cmp = complaintAgg.get(loc.location_id) ?? {
      count: 0,
      categoryCounts: {},
      unresolved: 0,
      daysToResolution: [],
      highPriority: 0,
    };

    const ev: LocationEvidence = {
      locationId: loc.location_id,
      latitude: loc.latitude,
      longitude: loc.longitude,
      zone: loc.zone,
      roadType: loc.road_type,
      roadCondition: loc.road_condition,
      populationDensity: loc.population_density_per_km2,
      nearSchool: loc.near_school,
      nearHospital: loc.near_hospital,
      pedestrianActivity: loc.pedestrian_activity,
      totalIncidents: inc.count,
      severityDist: inc.severityDist,
      incidentTypeCounts: inc.typeCounts,
      totalInjuries: inc.injuries,
      unresolvedIncidents: inc.unresolved,
      avgResolutionHours: avg(inc.resHours),
      maxSeverityIncidents: inc.maxSeverity,
      totalComplaints: cmp.count,
      complaintCategoryCounts: cmp.categoryCounts,
      unresolvedComplaints: cmp.unresolved,
      avgDaysToResolution: avg(cmp.daysToResolution),
      highPriorityComplaints: cmp.highPriority,
    };

    evidence.set(loc.location_id, ev);
  }

  return { locations, incidents, complaints, evidence };
}
