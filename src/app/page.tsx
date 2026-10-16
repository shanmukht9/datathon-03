/**
 * @fileoverview Landing page — role selection for Nagrik.
 * Three clear entry points: Citizen, Officer, Worker.
 * Demo identity flow with no real authentication.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp, AppUser } from '@/context/AppContext';
import { Department } from '@/lib/types';

type EntryMode = 'select' | 'officer' | 'worker';

/** Mapping of department names for the officer dropdown */
const DEPARTMENTS: Department[] = [
  'Roads Department',
  'Drainage & Public Works',
  'Electrical Department',
  'Traffic & Signals',
  'Roads & Safety',
  'General',
];

/** Officer login sub-form */
function OfficerForm({ onBack }: { onBack: () => void }) {
  const { setUser } = useApp();
  const router = useRouter();
  const [officerId, setOfficerId] = useState('OFFICER-001');
  const [department, setDepartment] = useState<Department>('Roads Department');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (!officerId.trim()) { setError('Enter an officer ID.'); return; }
    const user: AppUser = { role: 'officer', userId: officerId.trim(), department };
    setUser(user);
    router.push('/officer');
  };

  return (
    <div className="card card-elevated animate-fade-in" style={{ maxWidth: 420 }}>
      <div className="panel-header">
        <h3 style={{ color: '#F0F0F2' }}>🏛️ Municipal Officer Access</h3>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
      </div>
      <div className="demo-banner" style={{ marginBottom: '1.25rem' }}>
        <span>⚠️</span>
        <span><strong>Demo prototype.</strong> No passwords or real identity verification.</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="form-group">
          <label className="form-label">Officer ID</label>
          <input
            className="form-input"
            value={officerId}
            onChange={e => setOfficerId(e.target.value)}
            placeholder="e.g. OFFICER-001"
            aria-label="Officer ID"
          />
          <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>Try: OFFICER-001, OFFICER-002</span>
        </div>
        <div className="form-group">
          <label className="form-label">Department</label>
          <select
            className="form-select"
            value={department}
            onChange={e => setDepartment(e.target.value as Department)}
            aria-label="Department"
          >
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        {error && <p style={{ fontSize: '0.8125rem', color: '#EF4444' }}>{error}</p>}
        <button className="btn btn-primary btn-lg" onClick={handleLogin} style={{ width: '100%' }}>
          Enter Operations Dashboard →
        </button>
      </div>
    </div>
  );
}

/** Worker login sub-form */
function WorkerForm({ onBack }: { onBack: () => void }) {
  const { setUser } = useApp();
  const router = useRouter();
  const [workerId, setWorkerId] = useState('WORKER-001');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (!workerId.trim()) { setError('Enter a worker ID.'); return; }
    const user: AppUser = { role: 'worker', userId: workerId.trim() };
    setUser(user);
    router.push('/worker');
  };

  return (
    <div className="card card-elevated animate-fade-in" style={{ maxWidth: 420 }}>
      <div className="panel-header">
        <h3 style={{ color: '#F0F0F2' }}>🔧 Field Worker Access</h3>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
      </div>
      <div className="demo-banner" style={{ marginBottom: '1.25rem' }}>
        <span>⚠️</span>
        <span><strong>Demo prototype.</strong> No passwords or real identity verification.</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="form-group">
          <label className="form-label">Worker ID</label>
          <input
            className="form-input"
            value={workerId}
            onChange={e => setWorkerId(e.target.value)}
            placeholder="e.g. WORKER-001"
            aria-label="Worker ID"
          />
          <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>Try: WORKER-001, WORKER-002, WORKER-003</span>
        </div>
        {error && <p style={{ fontSize: '0.8125rem', color: '#EF4444' }}>{error}</p>}
        <button className="btn btn-primary btn-lg" onClick={handleLogin} style={{ width: '100%' }}>
          Enter Field Dashboard →
        </button>
      </div>
    </div>
  );
}

/** Main landing page */
export default function HomePage() {
  const [mode, setMode] = useState<EntryMode>('select');
  const { setUser } = useApp();
  const router = useRouter();

  const handleCitizen = () => {
    setUser({ role: 'citizen', userId: `citizen-${Date.now()}` });
    router.push('/citizen');
  };

  return (
    <main style={{ minHeight: '100vh', background: '#0B0D0F', display: 'flex', flexDirection: 'column' }}>
      {/* Hero */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
        gap: '3rem',
      }}>
        {/* Logo & Tagline */}
        <div style={{ textAlign: 'center', maxWidth: 680 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{
              width: 48, height: 48,
              background: '#FFB21A',
              borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem',
              flexShrink: 0,
            }}>🏙️</div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#F0F0F2', letterSpacing: '-0.03em' }}>
              Nag<span style={{ color: '#FFB21A' }}>rik</span>
            </h1>
          </div>
          <p style={{ fontSize: '1.25rem', color: '#9CA3AF', fontWeight: 400, marginBottom: '1rem', lineHeight: 1.5 }}>
            From Citizen Reports to Evidence-Based City Action.
          </p>
          <p style={{ fontSize: '0.9375rem', color: '#6B7280', lineHeight: 1.6, maxWidth: 560, margin: '0 auto' }}>
            Nagrik unifies citizen reports, historical incidents, and public complaints
            into an explainable, ML-backed priority queue — giving municipal officers a transparent,
            evidence-driven path to resolution.
          </p>
          <div className="simulated-notice" style={{ marginTop: '1.25rem', justifyContent: 'center' }}>
            <span>ℹ️</span>
            <span>All location data is synthetic educational data from the Datathon dataset. Not real civic complaints.</span>
          </div>
        </div>

        {/* How it works */}
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 840 }}>
          {[
            { icon: '📸', title: 'Citizens Report', desc: 'Upload photos, describe issues, share location. One tap to submit.' },
            { icon: '🧠', title: 'AI Prioritizes', desc: 'ML model + weighted scoring ranks every issue with full transparency.' },
            { icon: '🗺️', title: 'Officers Act', desc: 'Geospatial dashboard shows ranked queue. Assign, track, verify.' },
            { icon: '✅', title: 'Workers Resolve', desc: 'Field app captures evidence, location, and closure notes.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="card" style={{ width: 180, textAlign: 'center', padding: '1.25rem 1rem' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{icon}</div>
              <div style={{ fontWeight: 600, color: '#F0F0F2', fontSize: '0.9375rem', marginBottom: '0.375rem' }}>{title}</div>
              <div style={{ fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>

        {/* Entry mode */}
        {mode === 'select' && (
          <div className="animate-fade-in" style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {/* Citizen */}
            <button
              id="btn-citizen-entry"
              className="card"
              onClick={handleCitizen}
              style={{
                width: 220, textAlign: 'center', cursor: 'pointer', padding: '1.75rem 1.25rem',
                border: '1px solid #2A2D32', transition: 'all 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#FFB21A')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A2D32')}
              aria-label="Open citizen reporting portal"
            >
              <div style={{ fontSize: '2.25rem', marginBottom: '0.75rem' }}>📱</div>
              <div style={{ fontWeight: 700, color: '#F0F0F2', fontSize: '1rem', marginBottom: '0.375rem' }}>Report an Issue</div>
              <div style={{ fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.5 }}>Citizen Portal</div>
              <div className="badge badge-green" style={{ marginTop: '0.875rem' }}>Open Access</div>
            </button>

            {/* Officer */}
            <button
              id="btn-officer-entry"
              className="card"
              onClick={() => setMode('officer')}
              style={{
                width: 220, textAlign: 'center', cursor: 'pointer', padding: '1.75rem 1.25rem',
                border: '1px solid #2A2D32', transition: 'all 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#FFB21A')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A2D32')}
              aria-label="Open municipal officer dashboard"
            >
              <div style={{ fontSize: '2.25rem', marginBottom: '0.75rem' }}>🏛️</div>
              <div style={{ fontWeight: 700, color: '#F0F0F2', fontSize: '1rem', marginBottom: '0.375rem' }}>Municipal Dashboard</div>
              <div style={{ fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.5 }}>Officer Interface</div>
              <div className="badge badge-yellow" style={{ marginTop: '0.875rem' }}>Demo ID Required</div>
            </button>

            {/* Worker */}
            <button
              id="btn-worker-entry"
              className="card"
              onClick={() => setMode('worker')}
              style={{
                width: 220, textAlign: 'center', cursor: 'pointer', padding: '1.75rem 1.25rem',
                border: '1px solid #2A2D32', transition: 'all 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#FFB21A')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A2D32')}
              aria-label="Open field worker interface"
            >
              <div style={{ fontSize: '2.25rem', marginBottom: '0.75rem' }}>🔧</div>
              <div style={{ fontWeight: 700, color: '#F0F0F2', fontSize: '1rem', marginBottom: '0.375rem' }}>Field Resolution</div>
              <div style={{ fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.5 }}>Worker Interface</div>
              <div className="badge badge-purple" style={{ marginTop: '0.875rem' }}>Demo ID Required</div>
            </button>
          </div>
        )}

        {mode === 'officer' && <OfficerForm onBack={() => setMode('select')} />}
        {mode === 'worker' && <WorkerForm onBack={() => setMode('select')} />}
      </div>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid #2A2D32',
        padding: '1rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <span style={{ fontSize: '0.8125rem', color: '#6B7280' }}>
          Nagrik — Datathon Round 1 Prototype
        </span>
        <span style={{ fontSize: '0.8125rem', color: '#6B7280' }}>
          Data: Synthetic educational dataset · Not for real public-safety decisions
        </span>
      </footer>
    </main>
  );
}
