/**
 * @fileoverview Officer Dashboard — Operations control room interface.
 * Includes: stats overview, priority queue, geospatial map, issue detail panel,
 * assignment workflow, evidence review, and intervention comparison.
 */

'use client';

import dynamic from 'next/dynamic';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { CanonicalIssue, IssueCategory, SeverityLevel, CaseStatus, Department, LocationEvidence } from '@/lib/types';
import {
  SeverityBadge,
  StatusBadge,
  CategoryLabel,
  PriorityScore,
  PriorityBreakdownCard,
  CaseTimeline,
  Spinner,
  EmptyState,
  ErrorState,
  SimulatedDisclaimer,
  SectionHeader,
} from '@/components/ui';

const CivicMap = dynamic(() => import('@/components/CivicMap'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 440, background: '#17191C', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' }}>
      <Spinner label="Loading map..." />
    </div>
  ),
});

// ─── Stat Card ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = '#FFB21A', icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon?: string;
}) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="stat-label">{label}</span>
        {icon && <span style={{ fontSize: '1.25rem' }}>{icon}</span>}
      </div>
      <span className="stat-value" style={{ color }}>{value}</span>
      {sub && <span className="stat-sublabel">{sub}</span>}
    </div>
  );
}

// ─── Filters ──────────────────────────────────────────────────────────────
interface Filters {
  search: string;
  category: IssueCategory | '';
  severity: SeverityLevel | '';
  status: CaseStatus | '';
  department: Department | '';
  priorityMin: number;
  showSeedOnly: boolean;
}

// ─── Issue Detail Panel ───────────────────────────────────────────────────
function IssueDetailPanel({
  issue,
  evidence,
  workers,
  onClose,
  onAssign,
  onVerify,
}: {
  issue: CanonicalIssue;
  evidence: Record<string, LocationEvidence>;
  workers: ReturnType<typeof useApp>['state']['workers'];
  onClose: () => void;
  onAssign: (issueId: string, workerId: string) => void;
  onVerify: (issueId: string, accepted: boolean, note?: string) => void;
}) {
  const ev = issue.locationId ? evidence[issue.locationId] : null;
  const [assigningWorker, setAssigningWorker] = useState('');
  const [verifyNote, setVerifyNote] = useState('');
  const [activeSection, setActiveSection] = useState<'overview' | 'score' | 'evidence' | 'timeline' | 'intervention'>('overview');

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'score', label: '⚡ Score' },
    { key: 'evidence', label: '📊 Evidence' },
    { key: 'timeline', label: '🕐 Timeline' },
    { key: 'intervention', label: '🔧 Interventions' },
  ] as const;

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 480,
      background: '#17191C', borderLeft: '1px solid #2A2D32',
      display: 'flex', flexDirection: 'column', zIndex: 200,
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid #2A2D32', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
              <SeverityBadge severity={issue.severity} />
              <StatusBadge status={issue.status} />
              {issue.isSeeded && <span className="badge badge-demo">★ Demo Seed</span>}
            </div>
            <h3 style={{ color: '#F0F0F2', fontSize: '1rem', lineHeight: 1.4 }}>{issue.title}</h3>
            <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem', fontFamily: 'monospace' }}>
              {issue.issueId}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close panel">✕</button>
        </div>

        {/* Score */}
        <div style={{ marginTop: '0.875rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <PriorityScore score={issue.priority.total} band={issue.priority.band} />
          <div style={{ fontSize: '0.8125rem', color: '#9CA3AF' }}>
            {issue.reportCount} report(s) · <CategoryLabel category={issue.category} />
          </div>
        </div>
      </div>

      {/* Quick action: assign */}
      {issue.status === 'Reported' || issue.status === 'Reviewed' ? (
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #2A2D32', background: '#1E2024', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <select
              className="form-select"
              value={assigningWorker}
              onChange={e => setAssigningWorker(e.target.value)}
              aria-label="Select worker to assign"
            >
              <option value="">Select worker to assign…</option>
              {workers.map(w => (
                <option key={w.workerId} value={w.workerId}>
                  {w.workerName} ({w.workerId}) — {w.department}
                </option>
              ))}
            </select>
            <button
              id={`btn-assign-${issue.issueId}`}
              className="btn btn-primary btn-sm"
              disabled={!assigningWorker}
              onClick={() => { onAssign(issue.issueId, assigningWorker); setAssigningWorker(''); }}
              aria-label="Assign issue to selected worker"
            >
              Assign
            </button>
          </div>
        </div>
      ) : issue.status === 'Pending Verification' ? (
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #2A2D32', background: '#1E2024', flexShrink: 0 }}>
          <div style={{ fontSize: '0.875rem', color: '#EAB308', fontWeight: 600, marginBottom: '0.75rem' }}>
            ⏳ Pending your verification
          </div>
          {issue.resolutionEvidence && (
            <div className="card" style={{ background: '#22252A', marginBottom: '0.75rem', padding: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: '0.25rem' }}>Worker note:</div>
              <div style={{ fontSize: '0.875rem', color: '#F0F0F2' }}>{issue.resolutionEvidence.note}</div>
              <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.375rem' }}>
                Location capture: <span style={{ fontWeight: 500 }}>{issue.resolutionEvidence.locationCaptureMethod}</span>
                {issue.resolutionEvidence.latitude !== null && (
                  <span> · {issue.resolutionEvidence.latitude.toFixed(4)}, {issue.resolutionEvidence.longitude!.toFixed(4)}</span>
                )}
              </div>
            </div>
          )}
          <input
            className="form-input"
            value={verifyNote}
            onChange={e => setVerifyNote(e.target.value)}
            placeholder="Optional: verification note…"
            style={{ marginBottom: '0.625rem' }}
          />
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button id={`btn-verify-${issue.issueId}`} className="btn btn-primary btn-sm" onClick={() => onVerify(issue.issueId, true, verifyNote || undefined)}>
              ✅ Confirm Resolved
            </button>
            <button id={`btn-reject-${issue.issueId}`} className="btn btn-danger btn-sm" onClick={() => onVerify(issue.issueId, false, verifyNote || undefined)}>
              ❌ Reject — Reopen
            </button>
          </div>
        </div>
      ) : null}

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: '0.25rem', padding: '0.5rem 1.25rem', borderBottom: '1px solid #2A2D32', flexShrink: 0, overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            className="btn btn-ghost btn-sm"
            onClick={() => setActiveSection(tab.key)}
            style={{
              borderBottom: activeSection === tab.key ? '2px solid #FFB21A' : '2px solid transparent',
              borderRadius: '4px 4px 0 0',
              color: activeSection === tab.key ? '#FFB21A' : '#9CA3AF',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: '1.25rem', flex: 1 }}>
        {activeSection === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '0.875rem', color: '#9CA3AF', lineHeight: 1.6 }}>{issue.description}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', fontSize: '0.8125rem' }}>
              {[
                ['Location ID', issue.locationId ?? 'N/A'],
                ['Coordinates', `${issue.latitude.toFixed(4)}, ${issue.longitude.toFixed(4)}`],
                ['Department', issue.department],
                ['Assigned to', issue.assignedWorkerId ?? 'Unassigned'],
                ['Reports', issue.reportCount],
                ['First reported', new Date(issue.firstReportedAt).toLocaleDateString()],
                ['Last reported', new Date(issue.lastReportedAt).toLocaleDateString()],
              ].map(([label, value]) => (
                <div key={String(label)} className="card" style={{ padding: '0.625rem 0.75rem', background: '#1E2024' }}>
                  <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                  <div style={{ color: '#F0F0F2', marginTop: '0.125rem', fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'score' && (
          <PriorityBreakdownCard priority={issue.priority} />
        )}

        {activeSection === 'evidence' && ev && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', fontSize: '0.8125rem' }}>
              {[
                ['Zone', ev.zone],
                ['Road Type', ev.roadType],
                ['Road Condition', ev.roadCondition],
                ['Pop. Density', `${ev.populationDensity.toLocaleString()}/km²`],
                ['Near School', ev.nearSchool ? '✅ Yes' : '❌ No'],
                ['Near Hospital', ev.nearHospital ? '✅ Yes' : '❌ No'],
                ['Pedestrian Activity', ev.pedestrianActivity],
              ].map(([label, value]) => (
                <div key={String(label)} className="card" style={{ padding: '0.625rem', background: '#1E2024' }}>
                  <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ color: '#F0F0F2', marginTop: '0.125rem' }}>{value}</div>
                </div>
              ))}
            </div>
            <div className="card" style={{ background: '#1E2024' }}>
              <div style={{ fontWeight: 600, color: '#9CA3AF', marginBottom: '0.5rem', fontSize: '0.8125rem' }}>Historical Incidents</div>
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem' }}>
                <div><span style={{ fontWeight: 700, color: '#F0F0F2', fontSize: '1.25rem' }}>{ev.totalIncidents}</span><div style={{ color: '#6B7280', fontSize: '0.75rem' }}>Total</div></div>
                <div><span style={{ fontWeight: 700, color: '#EF4444', fontSize: '1.25rem' }}>{ev.unresolvedIncidents}</span><div style={{ color: '#6B7280', fontSize: '0.75rem' }}>Unresolved</div></div>
                <div><span style={{ fontWeight: 700, color: '#F97316', fontSize: '1.25rem' }}>{ev.totalInjuries}</span><div style={{ color: '#6B7280', fontSize: '0.75rem' }}>Injuries</div></div>
                <div><span style={{ fontWeight: 700, color: '#9CA3AF', fontSize: '1.25rem' }}>{ev.avgResolutionHours ? `${ev.avgResolutionHours.toFixed(0)}h` : 'N/A'}</span><div style={{ color: '#6B7280', fontSize: '0.75rem' }}>Avg Resolution</div></div>
              </div>
            </div>
            <div className="card" style={{ background: '#1E2024' }}>
              <div style={{ fontWeight: 600, color: '#9CA3AF', marginBottom: '0.5rem', fontSize: '0.8125rem' }}>Severity Distribution</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {(['Critical', 'High', 'Medium', 'Low'] as SeverityLevel[]).map(sev => (
                  <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}>
                    <SeverityBadge severity={sev} />
                    <span style={{ color: '#9CA3AF' }}>{ev.severityDist[sev]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{ background: '#1E2024' }}>
              <div style={{ fontWeight: 600, color: '#9CA3AF', marginBottom: '0.5rem', fontSize: '0.8125rem' }}>Public Complaints</div>
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem' }}>
                <div><span style={{ fontWeight: 700, color: '#F0F0F2', fontSize: '1.25rem' }}>{ev.totalComplaints}</span><div style={{ color: '#6B7280', fontSize: '0.75rem' }}>Total</div></div>
                <div><span style={{ fontWeight: 700, color: '#EAB308', fontSize: '1.25rem' }}>{ev.unresolvedComplaints}</span><div style={{ color: '#6B7280', fontSize: '0.75rem' }}>Unresolved</div></div>
                <div><span style={{ fontWeight: 700, color: '#F97316', fontSize: '1.25rem' }}>{ev.highPriorityComplaints}</span><div style={{ color: '#6B7280', fontSize: '0.75rem' }}>High Priority</div></div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'evidence' && !ev && (
          <EmptyState icon="📊" title="No historical evidence" message="No CSV data matched for this location ID. This may be a citizen-submitted issue with no historical record." />
        )}

        {activeSection === 'timeline' && (
          <CaseTimeline events={issue.events} />
        )}

        {activeSection === 'intervention' && (
          <InterventionPanel issue={issue} />
        )}
      </div>
    </div>
  );
}

// ─── Intervention Comparison Panel ───────────────────────────────────────
function InterventionPanel({ issue }: { issue: CanonicalIssue }) {
  const interventions = useMemo(() => getInterventions(issue.category), [issue.category]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="demo-banner">
        <span>⚠️</span>
        <span>Illustrative intervention framework. Cost estimates are assumptions only, not validated data.</span>
      </div>
      {interventions.map(iv => (
        <div key={iv.id} className="card" style={{ background: '#1E2024' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600, color: '#F0F0F2', fontSize: '0.9375rem' }}>{iv.title}</span>
            <span className={`badge ${iv.urgency === 'Immediate' ? 'badge-critical' : iv.urgency === 'Short-term' ? 'badge-high' : 'badge-medium'}`}>
              {iv.urgency}
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', marginBottom: '0.75rem', lineHeight: 1.5 }}>{iv.description}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem', fontSize: '0.75rem' }}>
            <div><span style={{ color: '#6B7280' }}>Est. cost (illustrative): </span><span style={{ color: '#F0F0F2' }}>{iv.estimatedCostLabel}</span></div>
            <div><span style={{ color: '#6B7280' }}>Feasibility: </span><span style={{ color: iv.feasibility === 'High' ? '#22C55E' : iv.feasibility === 'Medium' ? '#EAB308' : '#F97316' }}>{iv.feasibility}</span></div>
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: '#9CA3AF' }}>
            <span style={{ color: '#6B7280' }}>Expected benefit: </span>{iv.expectedBenefit}
          </div>
          <div style={{ marginTop: '0.375rem', fontSize: '0.8125rem', color: '#FFB21A' }}>
            → {iv.recommendationReason}
          </div>
        </div>
      ))}
    </div>
  );
}


type Intervention = {
  id: string;
  title: string;
  category: IssueCategory;
  description: string;
  urgency: 'Immediate' | 'Short-term' | 'Planned';
  estimatedCostLabel: string;
  expectedBenefit: string;
  feasibility: 'High' | 'Medium' | 'Low';
  recommendationReason: string;
};

function getInterventions(category: IssueCategory): Intervention[] {
  const base: Intervention[] = [
    {
      id: 'inspect',
      title: 'Site Inspection',
      category,
      description: 'Send field worker to confirm issue severity and take detailed photographs.',
      urgency: 'Immediate',
      estimatedCostLabel: '₹500–2,000 (illustrative)',
      expectedBenefit: 'Accurate scope assessment before committing resources.',
      feasibility: 'High',
      recommendationReason: 'Always the first step before any major intervention.',
    },
  ];

  const specific: Record<IssueCategory, Intervention[]> = {
    pothole: [
      {
        id: 'patch',
        title: 'Cold-Mix Patching',
        category: 'pothole',
        description: 'Apply cold-mix asphalt to seal potholes. Temporary fix for urgent cases.',
        urgency: 'Short-term',
        estimatedCostLabel: '₹5,000–20,000/pothole (illustrative)',
        expectedBenefit: 'Immediate road safety improvement and vehicle damage reduction.',
        feasibility: 'High',
        recommendationReason: 'Recommended for high-traffic arterial roads with deep potholes.',
      },
    ],
    road_damage: [
      {
        id: 'repave',
        title: 'Road Resurfacing',
        category: 'road_damage',
        description: 'Hot-mix asphalt resurfacing for severely damaged road sections.',
        urgency: 'Planned',
        estimatedCostLabel: '₹50,000–5,00,000/100m (illustrative)',
        expectedBenefit: 'Long-term road quality improvement; reduces recurring complaints.',
        feasibility: 'Medium',
        recommendationReason: 'Suitable when multiple potholes cluster in a section.',
      },
    ],
    flooding: [
      {
        id: 'pump',
        title: 'Emergency Pumping',
        category: 'flooding',
        description: 'Deploy mobile water pumps to clear standing floodwater.',
        urgency: 'Immediate',
        estimatedCostLabel: '₹8,000–25,000/day (illustrative)',
        expectedBenefit: 'Immediate access restoration and health risk reduction.',
        feasibility: 'High',
        recommendationReason: 'Critical when flooding blocks school/hospital access.',
      },
    ],
    drainage: [
      {
        id: 'desilting',
        title: 'Drain Desilting',
        category: 'drainage',
        description: 'Mechanical desilting and clearance of blocked drainage channels.',
        urgency: 'Short-term',
        estimatedCostLabel: '₹15,000–60,000 (illustrative)',
        expectedBenefit: 'Prevents recurring flooding; reduces mosquito breeding sites.',
        feasibility: 'High',
        recommendationReason: 'Most effective permanent solution for drainage blockage.',
      },
    ],
    streetlight: [
      {
        id: 'bulb',
        title: 'Lamp Replacement',
        category: 'streetlight',
        description: 'Replace faulty streetlight bulbs with energy-efficient LEDs.',
        urgency: 'Short-term',
        estimatedCostLabel: '₹3,000–12,000/lamp (illustrative)',
        expectedBenefit: 'Improved pedestrian and road safety at night.',
        feasibility: 'High',
        recommendationReason: 'Quick win for high-pedestrian-activity areas.',
      },
    ],
    traffic_signal: [
      {
        id: 'signal-repair',
        title: 'Signal Repair/Recalibration',
        category: 'traffic_signal',
        description: 'Inspect and repair faulty traffic signal electronics and timing.',
        urgency: 'Immediate',
        estimatedCostLabel: '₹10,000–80,000 (illustrative)',
        expectedBenefit: 'Reduces collision risk at critical junctions.',
        feasibility: 'Medium',
        recommendationReason: 'Highest priority at junctions with pedestrian crossing.',
      },
    ],
    pedestrian_safety: [
      {
        id: 'ped-infra',
        title: 'Pedestrian Infrastructure',
        category: 'pedestrian_safety',
        description: 'Install or repair footpaths, crossings, guardrails, or signage.',
        urgency: 'Short-term',
        estimatedCostLabel: '₹30,000–2,00,000 (illustrative)',
        expectedBenefit: 'Reduces pedestrian injury risk, especially near schools.',
        feasibility: 'Medium',
        recommendationReason: 'Prioritise if near school zone or hospital.',
      },
    ],
    collision: [
      {
        id: 'speed-control',
        title: 'Speed Mitigation Measures',
        category: 'collision',
        description: 'Install speed humps, signage, or rumble strips at collision-prone spots.',
        urgency: 'Short-term',
        estimatedCostLabel: '₹20,000–1,00,000 (illustrative)',
        expectedBenefit: 'Reduces collision frequency and severity.',
        feasibility: 'High',
        recommendationReason: 'Data-driven placement at historically high-collision locations.',
      },
    ],
    other: [],
  };

  return [...base, ...(specific[category] ?? [])];
}

// ─── Main Officer Dashboard ───────────────────────────────────────────────
export default function OfficerPage() {
  const { state, assignIssue, verifyResolution } = useApp();
  const router = useRouter();

  const [filters, setFilters] = useState<Filters>({
    search: '', category: '', severity: '', status: '', department: '', priorityMin: 0, showSeedOnly: false,
  });
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [view, setView] = useState<'queue' | 'map'>('queue');

  // Redirect if no officer role
  const user = state.user;
  if (!state.initialized && !state.loading) {
    return <div style={{ padding: '2rem', color: '#9CA3AF' }}><Spinner label="Loading..." /></div>;
  }

  const stats = state.dashboardStats;
  const issues = state.issues;
  const evidence = state.evidence;

  // Apply filters
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      if (filters.search && !issue.title.toLowerCase().includes(filters.search.toLowerCase()) &&
          !issue.issueId.toLowerCase().includes(filters.search.toLowerCase()) &&
          !issue.locationId?.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.category && issue.category !== filters.category) return false;
      if (filters.severity && issue.severity !== filters.severity) return false;
      if (filters.status && issue.status !== filters.status) return false;
      if (filters.department && issue.department !== filters.department) return false;
      if (filters.priorityMin && issue.priority.total < filters.priorityMin) return false;
      if (filters.showSeedOnly && !issue.isSeeded) return false;
      return true;
    }).sort((a, b) => b.priority.total - a.priority.total);
  }, [issues, filters]);

  const selectedIssue = selectedIssueId ? issues.find(i => i.issueId === selectedIssueId) : null;

  const handleAssign = async (issueId: string, workerId: string) => {
    await assignIssue(issueId, workerId);
  };

  const handleVerify = async (issueId: string, accepted: boolean, note?: string) => {
    await verifyResolution(issueId, user.userId, accepted, note);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0B0D0F' }}>
      {/* Header */}
      <header style={{ background: '#17191C', borderBottom: '1px solid #2A2D32', padding: '0.875rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 32, height: 32, background: '#FFB21A', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🏙️</div>
          <span style={{ fontWeight: 700, color: '#F0F0F2' }}>Nagrik</span>
          <span className="badge badge-yellow">Officer Dashboard</span>
          {user.userId && <span style={{ fontSize: '0.8125rem', color: '#6B7280' }}>· {user.userId}</span>}
          {user.department && <span style={{ fontSize: '0.8125rem', color: '#6B7280' }}>· {user.department}</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/')}>← Home</button>
        </div>
      </header>

      <div style={{ flex: 1, padding: '1.25rem', maxWidth: selectedIssue ? 'calc(100% - 480px)' : '100%', transition: 'max-width 0.2s' }}>
        {/* Stats */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.875rem', marginBottom: '1.25rem' }}>
            <StatCard label="Locations" value={stats.totalLocations} icon="📍" color="#FFB21A" />
            <StatCard label="Incidents (Historical)" value={stats.totalIncidents.toLocaleString()} icon="📊" color="#F97316" />
            <StatCard label="Complaints (Historical)" value={stats.totalComplaints.toLocaleString()} icon="📣" color="#EAB308" />
            <StatCard label="Open Issues" value={stats.openIssues} icon="🔓" color="#EF4444" />
            <StatCard label="New Reports" value={stats.newCitizenReports} icon="📱" color="#22C55E" sub="from citizens" />
            <StatCard label="Duplicate-Linked" value={stats.duplicateLinkedCount} icon="🔗" color="#8B5CF6" />
            <StatCard label="High Priority" value={stats.highPriorityLocations} icon="⚠️" color="#EF4444" />
            <StatCard label="Resolved Today" value={stats.resolvedToday} icon="✅" color="#22C55E" />
          </div>
        )}

        <SimulatedDisclaimer />

        {/* View toggle */}
        <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
          <button id="btn-view-queue" className={`btn ${view === 'queue' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setView('queue')}>📋 Priority Queue</button>
          <button id="btn-view-map" className={`btn ${view === 'map' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setView('map')}>🗺️ Map View</button>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: '1rem', padding: '0.875rem' }}>
          <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="form-input"
              style={{ width: 200 }}
              placeholder="Search issue, ID, location…"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              aria-label="Search issues"
            />
            <select className="form-select" style={{ width: 150 }} value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value as IssueCategory | '' }))} aria-label="Filter by category">
              <option value="">All Categories</option>
              {['pothole','road_damage','flooding','drainage','streetlight','traffic_signal','pedestrian_safety','collision','other'].map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
            <select className="form-select" style={{ width: 130 }} value={filters.severity} onChange={e => setFilters(f => ({ ...f, severity: e.target.value as SeverityLevel | '' }))} aria-label="Filter by severity">
              <option value="">All Severity</option>
              {['Critical','High','Medium','Low'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="form-select" style={{ width: 160 }} value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value as CaseStatus | '' }))} aria-label="Filter by status">
              <option value="">All Statuses</option>
              {['Reported','Reviewed','Assigned','In Progress','Pending Verification','Resolved','Reopened'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="form-select" style={{ width: 180 }} value={filters.department} onChange={e => setFilters(f => ({ ...f, department: e.target.value as Department | '' }))} aria-label="Filter by department">
              <option value="">All Departments</option>
              {['Roads Department','Drainage & Public Works','Electrical Department','Traffic & Signals','Roads & Safety','General'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: '#9CA3AF', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={filters.showSeedOnly} onChange={e => setFilters(f => ({ ...f, showSeedOnly: e.target.checked }))} />
              Demo seeds only
            </label>
            <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ search:'',category:'',severity:'',status:'',department:'',priorityMin:0,showSeedOnly:false })}>
              Reset
            </button>
            <span style={{ fontSize: '0.8125rem', color: '#6B7280', marginLeft: 'auto' }}>{filteredIssues.length} issue(s)</span>
          </div>
        </div>

        {/* Queue view */}
        {view === 'queue' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {filteredIssues.length === 0 ? (
              <EmptyState icon="✅" title="No issues match filters" message="Try adjusting your filters or add a citizen report." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Priority</th>
                      <th>Issue</th>
                      <th>Category</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Reports</th>
                      <th>Department</th>
                      <th>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIssues.map(issue => (
                      <tr
                        key={issue.issueId}
                        onClick={() => setSelectedIssueId(issue.issueId)}
                        style={{ background: selectedIssueId === issue.issueId ? '#FFB21A08' : undefined }}
                      >
                        <td><PriorityScore score={issue.priority.total} band={issue.priority.band} /></td>
                        <td>
                          <div style={{ maxWidth: 240 }}>
                            <div style={{ fontWeight: 500, color: '#F0F0F2', fontSize: '0.875rem' }} className="truncate">{issue.title}</div>
                            <div style={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'monospace' }}>{issue.issueId}</div>
                            {issue.isSeeded && <span className="badge badge-demo" style={{ marginTop: '0.125rem' }}>★ Seed</span>}
                          </div>
                        </td>
                        <td><CategoryLabel category={issue.category} /></td>
                        <td><SeverityBadge severity={issue.severity} /></td>
                        <td><StatusBadge status={issue.status} /></td>
                        <td style={{ textAlign: 'center' }}><span className="badge badge-gray">{issue.reportCount}</span></td>
                        <td style={{ fontSize: '0.8125rem', color: '#9CA3AF' }}>{issue.department}</td>
                        <td style={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'monospace' }}>{issue.locationId ?? `${issue.latitude.toFixed(3)},${issue.longitude.toFixed(3)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Map view */}
        {view === 'map' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1rem' }}>
            <div className="map-container">
              <CivicMap
                issues={filteredIssues}
                evidence={evidence}
                selectedIssueId={selectedIssueId}
                onSelectIssue={setSelectedIssueId}
                height={560}
              />
            </div>
            {/* Ranked list */}
            <div className="card" style={{ padding: 0, overflowY: 'auto', maxHeight: 560 }}>
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #2A2D32', fontSize: '0.8125rem', color: '#9CA3AF', fontWeight: 600 }}>
                Ranked Locations ({filteredIssues.length})
              </div>
              {filteredIssues.map(issue => (
                <div
                  key={issue.issueId}
                  onClick={() => setSelectedIssueId(issue.issueId)}
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #1E2024',
                    cursor: 'pointer',
                    background: selectedIssueId === issue.issueId ? '#FFB21A10' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (selectedIssueId !== issue.issueId) e.currentTarget.style.background = '#22252A'; }}
                  onMouseLeave={e => { if (selectedIssueId !== issue.issueId) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <PriorityScore score={issue.priority.total} band={issue.priority.band} />
                    {issue.isSeeded && <span className="badge badge-demo" style={{ fontSize: '0.65rem' }}>Seed</span>}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#F0F0F2', lineHeight: 1.3 }} className="truncate">{issue.title}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <StatusBadge status={issue.status} />
                    <span>{issue.reportCount} report(s)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedIssue && (
        <IssueDetailPanel
          issue={selectedIssue}
          evidence={evidence}
          workers={state.workers}
          onClose={() => setSelectedIssueId(null)}
          onAssign={handleAssign}
          onVerify={handleVerify}
        />
      )}
    </div>
  );
}
