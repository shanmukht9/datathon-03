/**
 * @fileoverview Worker Field Interface — field resolution workflow.
 * Workers see their assigned issues, can update status, upload closure photos,
 * capture GPS, and submit resolution evidence for officer review.
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { CanonicalIssue, ResolutionEvidence } from '@/lib/types';
import {
  SeverityBadge,
  StatusBadge,
  CategoryLabel,
  PriorityScore,
  CaseTimeline,
  Spinner,
  EmptyState,
  ErrorState,
  SuccessState,
} from '@/components/ui';
import { saveImage, getImageUrl } from '@/lib/persistence';

// ─── Resolution Form ──────────────────────────────────────────────────────
function ResolutionForm({
  issue,
  workerId,
  onSubmit,
  onCancel,
}: {
  issue: CanonicalIssue;
  workerId: string;
  onSubmit: (evidence: ResolutionEvidence) => Promise<void>;
  onCancel: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState('');
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationMethod, setLocationMethod] = useState<'gps' | 'manual' | 'none'>('none');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleGetLocation = useCallback(() => {
    if (!navigator.geolocation) { setGeoError('Geolocation not supported.'); return; }
    setGeoLoading(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLocationMethod('gps');
        setGeoLoading(false);
      },
      err => {
        setGeoLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Location permission denied. You can enter coordinates manually or proceed without location.');
        } else {
          setGeoError(`Could not get location: ${err.message}`);
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, []);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageBlob(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!note.trim()) { setError('Please enter a resolution note.'); return; }
    setError('');
    setSubmitting(true);
    try {
      let imageKey: string | null = null;
      if (imageBlob) imageKey = await saveImage(imageBlob);
      await onSubmit({
        submittedBy: workerId,
        submittedAt: new Date().toISOString(),
        note: note.trim(),
        imageKey,
        latitude,
        longitude,
        locationCaptureMethod: locationMethod,
      });
    } catch (e) {
      setError(`Submission failed: ${String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', background: '#1E2024', borderRadius: 12 }}>
      <h3 style={{ color: '#F0F0F2' }}>📷 Submit Resolution Evidence</h3>
      <div className="demo-banner">
        <span>ℹ️</span>
        <span>Location metadata is shown alongside evidence. It does not authenticate the photo.</span>
      </div>

      {/* Photo upload */}
      <div className="form-group">
        <label className="form-label">Closure Photo (optional)</label>
        <div
          className="upload-zone"
          style={{ padding: '1.25rem', cursor: 'pointer' }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          aria-label="Upload closure photo"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          {imagePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagePreview} alt="Closure preview" style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 8, objectFit: 'cover' }} />
          ) : (
            <div>
              <div style={{ fontSize: '1.75rem' }}>📷</div>
              <p style={{ color: '#9CA3AF', fontSize: '0.875rem' }}>Click to upload closure photo</p>
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} style={{ display: 'none' }} aria-label="Closure photo file input" />
      </div>

      {/* GPS */}
      <div className="form-group">
        <label className="form-label">Location at Time of Closure</label>
        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleGetLocation} disabled={geoLoading} aria-label="Capture GPS location">
            {geoLoading ? <Spinner label="" /> : '📡'} Capture GPS
          </button>
          {locationMethod === 'gps' && latitude !== null && (
            <span className="badge badge-green">📡 GPS: {latitude.toFixed(4)}, {longitude!.toFixed(4)}</span>
          )}
        </div>
        {geoError && <ErrorState message={geoError} />}
        {locationMethod !== 'gps' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginTop: '0.5rem' }}>
            <div className="form-group">
              <input className="form-input" type="number" placeholder="Latitude (optional)" value={latitude ?? ''} onChange={e => { setLatitude(parseFloat(e.target.value) || null); setLocationMethod('manual'); }} aria-label="Manual latitude" />
            </div>
            <div className="form-group">
              <input className="form-input" type="number" placeholder="Longitude (optional)" value={longitude ?? ''} onChange={e => { setLongitude(parseFloat(e.target.value) || null); setLocationMethod('manual'); }} aria-label="Manual longitude" />
            </div>
          </div>
        )}
        {locationMethod === 'none' && (
          <p style={{ fontSize: '0.75rem', color: '#6B7280' }}>No location captured. You can proceed without it.</p>
        )}
      </div>

      {/* Resolution note */}
      <div className="form-group">
        <label className="form-label form-required">Resolution Note</label>
        <textarea
          className="form-textarea"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Describe what was done to resolve the issue. Include materials used, actions taken, and any remaining concerns."
          rows={4}
          aria-label="Resolution note"
        />
      </div>

      {error && <ErrorState message={error} />}

      <div style={{ display: 'flex', gap: '0.625rem' }}>
        <button
          id="btn-submit-resolution"
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={submitting}
          aria-label="Submit resolution evidence"
        >
          {submitting ? <Spinner label="Submitting..." /> : '📤 Submit for Verification'}
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Issue Card ───────────────────────────────────────────────────────────
function IssueCard({ issue, workerId, onUpdate, onEvidence }: {
  issue: CanonicalIssue;
  workerId: string;
  onUpdate: (issueId: string) => void;
  onEvidence: (issueId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card animate-fade-in">
      <div
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}
        onClick={() => setExpanded(e => !e)}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setExpanded(x => !x)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
            <PriorityScore score={issue.priority.total} band={issue.priority.band} />
            <SeverityBadge severity={issue.severity} />
            <StatusBadge status={issue.status} />
            {issue.isSeeded && <span className="badge badge-demo">★ Demo</span>}
          </div>
          <div style={{ fontWeight: 600, color: '#F0F0F2', fontSize: '0.9375rem', marginBottom: '0.25rem' }}>{issue.title}</div>
          <div style={{ fontSize: '0.8125rem', color: '#9CA3AF' }}><CategoryLabel category={issue.category} /> · {issue.department}</div>
          <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem', fontFamily: 'monospace' }}>{issue.issueId}</div>
        </div>
        <span style={{ color: '#6B7280', fontSize: '1rem', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem', animation: 'fadeIn 0.15s ease' }}>
          <p style={{ fontSize: '0.875rem', color: '#9CA3AF', lineHeight: 1.6 }}>{issue.description}</p>
          <div style={{ fontSize: '0.8125rem', color: '#9CA3AF' }}>
            📌 {issue.latitude.toFixed(4)}, {issue.longitude.toFixed(4)}
            {issue.locationId && <span> · {issue.locationId}</span>}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
            {issue.status === 'Assigned' && (
              <button
                id={`btn-start-${issue.issueId}`}
                className="btn btn-primary btn-sm"
                onClick={() => onUpdate(issue.issueId)}
                aria-label="Mark issue as In Progress"
              >
                🔧 Start Work (In Progress)
              </button>
            )}
            {issue.status === 'In Progress' && (
              <button
                id={`btn-resolve-${issue.issueId}`}
                className="btn btn-primary btn-sm"
                onClick={() => onEvidence(issue.issueId)}
                aria-label="Submit closure evidence"
              >
                📷 Submit Closure Evidence
              </button>
            )}
            {issue.status === 'Pending Verification' && (
              <span className="badge badge-medium" style={{ padding: '0.5rem 0.875rem' }}>
                ⏳ Awaiting officer verification
              </span>
            )}
            {issue.status === 'Resolved' && (
              <span className="badge badge-green" style={{ padding: '0.5rem 0.875rem' }}>✅ Resolved</span>
            )}
            {issue.status === 'Reopened' && (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => onUpdate(issue.issueId)}
                aria-label="Restart work on reopened issue"
              >
                🔁 Restart Work
              </button>
            )}
          </div>

          {/* Resolution evidence (if submitted) */}
          {issue.resolutionEvidence && (
            <div className="card" style={{ background: '#22252A' }}>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Submitted Evidence
              </div>
              <p style={{ fontSize: '0.875rem', color: '#F0F0F2', marginBottom: '0.375rem' }}>{issue.resolutionEvidence.note}</p>
              <div style={{ fontSize: '0.75rem', color: '#9CA3AF', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <span>📅 {new Date(issue.resolutionEvidence.submittedAt).toLocaleString()}</span>
                <span>📍 Location: {issue.resolutionEvidence.locationCaptureMethod}</span>
                {issue.resolutionEvidence.latitude !== null && (
                  <span>{issue.resolutionEvidence.latitude.toFixed(4)}, {issue.resolutionEvidence.longitude!.toFixed(4)}</span>
                )}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Event Timeline</div>
            <CaseTimeline events={issue.events.slice(-5)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Worker Page ─────────────────────────────────────────────────────
export default function WorkerPage() {
  const { state, updateIssueStatus, submitResolutionEvidence } = useApp();
  const router = useRouter();

  const user = state.user;
  const workerId = user.userId || 'WORKER-001';

  const [activeTab, setActiveTab] = useState<'assigned' | 'all'>('assigned');
  const [evidenceIssueId, setEvidenceIssueId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Issues assigned to this worker
  const assignedIssues = state.issues.filter(i => i.assignedWorkerId === workerId);
  const allIssues = state.issues.filter(i => i.status !== 'Resolved');

  const displayIssues = activeTab === 'assigned' ? assignedIssues : allIssues;

  const handleStartWork = async (issueId: string) => {
    await updateIssueStatus(issueId, 'In Progress', `Worker ${workerId} started work.`, workerId, 'worker');
    setSuccessMsg('Status updated to In Progress.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleSubmitEvidence = async (evidence: ResolutionEvidence) => {
    if (!evidenceIssueId) return;
    await submitResolutionEvidence(evidenceIssueId, evidence);
    setEvidenceIssueId(null);
    setSuccessMsg('Resolution evidence submitted. Awaiting officer verification.');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  if (state.loading) {
    return <div style={{ padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner label="Loading worker dashboard..." /></div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0B0D0F' }}>
      {/* Header */}
      <header style={{ background: '#17191C', borderBottom: '1px solid #2A2D32', padding: '0.875rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 32, height: 32, background: '#FFB21A', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🏙️</div>
          <span style={{ fontWeight: 700, color: '#F0F0F2' }}>CivicPriority</span>
          <span className="badge badge-purple">Field Worker</span>
          <span style={{ fontSize: '0.8125rem', color: '#6B7280' }}>· {workerId}</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push('/')}>← Home</button>
      </header>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem' }}>
        {/* Worker summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.875rem', marginBottom: '1.25rem' }}>
          {[
            { label: 'Assigned', value: assignedIssues.length, icon: '📋' },
            { label: 'In Progress', value: assignedIssues.filter(i => i.status === 'In Progress').length, icon: '🔧', color: '#F97316' },
            { label: 'Pending Verify', value: assignedIssues.filter(i => i.status === 'Pending Verification').length, icon: '⏳', color: '#EAB308' },
            { label: 'Resolved', value: assignedIssues.filter(i => i.status === 'Resolved').length, icon: '✅', color: '#22C55E' },
          ].map(stat => (
            <div key={stat.label} className="stat-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="stat-label">{stat.label}</span>
                <span>{stat.icon}</span>
              </div>
              <span className="stat-value" style={{ color: stat.color ?? '#FFB21A' }}>{stat.value}</span>
            </div>
          ))}
        </div>

        {successMsg && <SuccessState message={successMsg} />}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #2A2D32', paddingBottom: 0 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setActiveTab('assigned')}
            style={{
              borderBottom: activeTab === 'assigned' ? '2px solid #FFB21A' : '2px solid transparent',
              borderRadius: '8px 8px 0 0',
              color: activeTab === 'assigned' ? '#FFB21A' : '#9CA3AF',
              marginBottom: -1,
            }}
          >
            🗂️ My Assignments ({assignedIssues.length})
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setActiveTab('all')}
            style={{
              borderBottom: activeTab === 'all' ? '2px solid #FFB21A' : '2px solid transparent',
              borderRadius: '8px 8px 0 0',
              color: activeTab === 'all' ? '#FFB21A' : '#9CA3AF',
              marginBottom: -1,
            }}
          >
            📋 All Open Issues ({allIssues.length})
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {displayIssues.length === 0 ? (
            <EmptyState
              icon={activeTab === 'assigned' ? '🎉' : '✅'}
              title={activeTab === 'assigned' ? 'No assignments yet' : 'No open issues'}
              message={activeTab === 'assigned' ? 'An officer will assign issues to you soon.' : 'All issues are currently resolved.'}
            />
          ) : (
            displayIssues
              .sort((a, b) => b.priority.total - a.priority.total)
              .map(issue => (
                <div key={issue.issueId}>
                  {evidenceIssueId === issue.issueId ? (
                    <ResolutionForm
                      issue={issue}
                      workerId={workerId}
                      onSubmit={handleSubmitEvidence}
                      onCancel={() => setEvidenceIssueId(null)}
                    />
                  ) : (
                    <IssueCard
                      issue={issue}
                      workerId={workerId}
                      onUpdate={handleStartWork}
                      onEvidence={setEvidenceIssueId}
                    />
                  )}
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
