/**
 * @fileoverview Shared UI components used across all three role interfaces.
 */

'use client';

import { SeverityLevel, CaseStatus, IssueCategory, PriorityBreakdown } from '@/lib/types';

// ─── Severity Badge ───────────────────────────────────────────────────────

/** Renders a colored severity badge */
export function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  const classMap: Record<SeverityLevel, string> = {
    Critical: 'badge badge-critical',
    High: 'badge badge-high',
    Medium: 'badge badge-medium',
    Low: 'badge badge-low',
  };
  return <span className={classMap[severity]}>{severity}</span>;
}

// ─── Status Badge ─────────────────────────────────────────────────────────

/** Renders a colored case status badge */
export function StatusBadge({ status }: { status: CaseStatus }) {
  const classMap: Record<CaseStatus, string> = {
    Reported: 'badge status-reported',
    Reviewed: 'badge status-reviewed',
    Assigned: 'badge status-assigned',
    'In Progress': 'badge status-in-progress',
    'Pending Verification': 'badge status-pending',
    Resolved: 'badge status-resolved',
    Reopened: 'badge status-reopened',
  };
  return <span className={classMap[status]}>{status}</span>;
}

// ─── Priority Score ───────────────────────────────────────────────────────

/** Compact priority score display */
export function PriorityScore({ score, band }: { score: number; band: string }) {
  const colorMap: Record<string, string> = {
    Critical: '#EF4444',
    High: '#F97316',
    Medium: '#EAB308',
    Low: '#22C55E',
  };
  const color = colorMap[band] ?? '#6B7280';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div
        className={`priority-dot priority-dot-${band.toLowerCase()}`}
        aria-hidden="true"
      />
      <span style={{ fontWeight: 700, color, fontSize: '0.9375rem' }}>{score}</span>
      <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>/{band}</span>
    </div>
  );
}

// ─── Score Bar ────────────────────────────────────────────────────────────

/** Single horizontal score bar with label */
export function ScoreBar({
  label,
  value,
  max = 100,
  color = '#FFB21A',
}: {
  label: string;
  value: number;
  max?: number;
  color?: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
        <span style={{ color: '#9CA3AF' }}>{label}</span>
        <span style={{ color: '#F0F0F2', fontWeight: 500 }}>{value}</span>
      </div>
      <div className="score-bar-container">
        <div className="score-bar" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Priority Breakdown Card ──────────────────────────────────────────────

/** Full priority breakdown with component scores and explanations */
export function PriorityBreakdownCard({ priority }: { priority: PriorityBreakdown }) {
  const bandColor: Record<string, string> = {
    Critical: '#EF4444',
    High: '#F97316',
    Medium: '#EAB308',
    Low: '#22C55E',
  };
  const color = bandColor[priority.band] ?? '#6B7280';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Total score */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
        <span style={{ fontSize: '3rem', fontWeight: 800, color, lineHeight: 1 }}>
          {priority.total}
        </span>
        <div>
          <div style={{ fontWeight: 700, color, fontSize: '0.9375rem' }}>{priority.band} Priority</div>
          <div style={{ fontSize: '0.8125rem', color: '#9CA3AF' }}>Score out of 100</div>
        </div>
      </div>

      {/* Primary reason */}
      <div style={{
        background: `${color}12`,
        border: `1px solid ${color}30`,
        borderRadius: 8,
        padding: '0.625rem 0.875rem',
        fontSize: '0.875rem',
        color: '#F0F0F2',
        lineHeight: 1.5,
      }}>
        {priority.primaryReason}
      </div>

      {/* Component bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {priority.components.map(comp => (
          <div key={comp.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
              <span style={{ color: '#9CA3AF' }}>
                {comp.label}
                <span style={{ color: '#6B7280', marginLeft: '0.375rem' }}>({Math.round(comp.weight * 100)}%)</span>
              </span>
              <span style={{ color: '#F0F0F2', fontWeight: 500 }}>
                {Math.round(comp.rawScore * 100)}/100
              </span>
            </div>
            <div className="score-bar-container">
              <div
                className="score-bar"
                style={{
                  width: `${comp.rawScore * 100}%`,
                  background: comp.rawScore > 0.7 ? color : comp.rawScore > 0.4 ? '#FFB21A' : '#22C55E',
                }}
              />
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280', lineHeight: 1.4 }}>
              {comp.explanation}
            </div>
          </div>
        ))}
      </div>

      {/* Citizen report bonus */}
      {priority.citizenReportBonus > 0 && (
        <div style={{ fontSize: '0.8125rem', color: '#9CA3AF' }}>
          + Citizen report bonus: <span style={{ color: '#FFB21A' }}>+{priority.citizenReportBonus} pts</span>
        </div>
      )}

      {/* ML probability */}
      {priority.modelUnresolvedProb !== null && (
        <div style={{ fontSize: '0.8125rem', color: '#6B7280', borderTop: '1px solid #2A2D32', paddingTop: '0.625rem' }}>
          ML model unresolved probability: <span style={{ color: '#9CA3AF' }}>{(priority.modelUnresolvedProb * 100).toFixed(0)}%</span>
          <span style={{ marginLeft: '0.375rem', color: '#4B5563' }}>(input to scoring, not a risk prediction)</span>
        </div>
      )}
    </div>
  );
}

// ─── Category label ───────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  pothole: '🕳️ Pothole',
  road_damage: '🚧 Road Damage',
  flooding: '🌊 Flooding',
  drainage: '🔧 Drainage',
  streetlight: '💡 Streetlight',
  traffic_signal: '🚦 Traffic Signal',
  pedestrian_safety: '🚶 Pedestrian Safety',
  collision: '💥 Collision',
  other: '❓ Other',
};

export function CategoryLabel({ category }: { category: IssueCategory }) {
  return <span>{CATEGORY_LABELS[category] ?? category}</span>;
}

// ─── Loading Spinner ──────────────────────────────────────────────────────

export function Spinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: '#9CA3AF', fontSize: '0.875rem' }}>
      <div className="spinner" role="status" aria-label={label} />
      <span>{label}</span>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────

export function EmptyState({ icon = '📭', title, message }: { icon?: string; title: string; message?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '3rem 1rem', color: '#6B7280' }}>
      <div style={{ fontSize: '2rem' }}>{icon}</div>
      <div style={{ fontWeight: 600, color: '#9CA3AF' }}>{title}</div>
      {message && <div style={{ fontSize: '0.8125rem', textAlign: 'center', maxWidth: 300 }}>{message}</div>}
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────

export function ErrorState({ message }: { message: string }) {
  return (
    <div style={{
      background: '#EF444412',
      border: '1px solid #EF444430',
      borderRadius: 8,
      padding: '0.875rem 1rem',
      fontSize: '0.875rem',
      color: '#EF4444',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    }}>
      <span>⚠️</span>
      <span>{message}</span>
    </div>
  );
}

// ─── Success state ────────────────────────────────────────────────────────

export function SuccessState({ message }: { message: string }) {
  return (
    <div style={{
      background: '#22C55E12',
      border: '1px solid #22C55E30',
      borderRadius: 8,
      padding: '0.875rem 1rem',
      fontSize: '0.875rem',
      color: '#22C55E',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    }}>
      <span>✅</span>
      <span>{message}</span>
    </div>
  );
}

// ─── Simulated data disclaimer ────────────────────────────────────────────

export function SimulatedDisclaimer() {
  return (
    <div className="simulated-notice">
      <span>🔬</span>
      <span>
        <strong>Synthetic data.</strong> All locations, incidents, and complaints are from the Datathon educational dataset.
        Not real civic complaints or official ward boundaries.
      </span>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
      <div>
        <h2 style={{ color: '#F0F0F2', fontSize: '1.125rem', fontWeight: 700 }}>{title}</h2>
        {subtitle && <p style={{ color: '#6B7280', fontSize: '0.8125rem', marginTop: '0.25rem' }}>{subtitle}</p>}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

// ─── Case Timeline ────────────────────────────────────────────────────────

import { CaseEvent } from '@/lib/types';

export function CaseTimeline({ events }: { events: CaseEvent[] }) {
  const sorted = [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const iconMap: Record<CaseEvent['type'], string> = {
    created: '📋',
    duplicate_linked: '🔗',
    reviewed: '👁️',
    assigned: '👤',
    status_changed: '🔄',
    worker_update: '🔧',
    evidence_submitted: '📷',
    officer_verified: '✅',
    officer_rejected: '❌',
    reopened: '🔁',
    priority_recalculated: '⚡',
  };

  return (
    <div className="timeline">
      {sorted.map((ev, i) => (
        <div key={ev.eventId} className="timeline-item">
          <div className={`timeline-dot ${i === 0 ? 'active' : ''}`} />
          <div style={{ paddingBottom: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem' }}>{iconMap[ev.type] ?? '•'}</span>
              <span style={{ fontSize: '0.8125rem', color: '#F0F0F2' }}>{ev.description}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>
              {new Date(ev.timestamp).toLocaleString()} · {ev.actorRole} {ev.actorId !== 'system' ? `· ${ev.actorId}` : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
