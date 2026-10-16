/**
 * @fileoverview Citizen Portal — Report a Civic Issue.
 * Provides a full issue-reporting form, photo upload, map location selection,
 * geolocation support, submission confirmation, and "My Reports" section.
 */

'use client';

import dynamic from 'next/dynamic';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { IssueCategory, SeverityLevel, CitizenReport } from '@/lib/types';
import {
  SeverityBadge,
  StatusBadge,
  CategoryLabel,
  Spinner,
  EmptyState,
  SuccessState,
  ErrorState,
  SimulatedDisclaimer,
} from '@/components/ui';
import { saveImage, getImageUrl } from '@/lib/persistence';
import { useRouter } from 'next/navigation';

// Dynamically import map to avoid SSR
const CivicMap = dynamic(() => import('@/components/CivicMap'), { ssr: false, loading: () => <div style={{ height: 300, background: '#17191C', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' }}><Spinner label="Loading map..." /></div> });

const CATEGORIES: { value: IssueCategory; label: string; icon: string }[] = [
  { value: 'pothole', label: 'Pothole', icon: '🕳️' },
  { value: 'road_damage', label: 'Road Damage', icon: '🚧' },
  { value: 'flooding', label: 'Flooding', icon: '🌊' },
  { value: 'drainage', label: 'Drainage Issue', icon: '🔧' },
  { value: 'streetlight', label: 'Streetlight Failure', icon: '💡' },
  { value: 'traffic_signal', label: 'Traffic Signal Failure', icon: '🚦' },
  { value: 'pedestrian_safety', label: 'Pedestrian Safety', icon: '🚶' },
  { value: 'other', label: 'Other', icon: '❓' },
];

const SEVERITIES: { value: SeverityLevel; label: string; desc: string }[] = [
  { value: 'Low', label: 'Low', desc: 'Minor inconvenience' },
  { value: 'Medium', label: 'Medium', desc: 'Affects daily use' },
  { value: 'High', label: 'High', desc: 'Safety risk' },
  { value: 'Critical', label: 'Critical', desc: 'Immediate danger' },
];

interface FormState {
  category: IssueCategory;
  description: string;
  severity: SeverityLevel;
  latitude: number | null;
  longitude: number | null;
  locationMethod: 'gps' | 'manual' | 'none';
  imageBlob: Blob | null;
  imagePreviewUrl: string | null;
}

interface SubmitResult {
  reportId: string;
  issueId: string;
  isDuplicate: boolean;
}

export default function CitizenPage() {
  const { state, submitReport } = useApp();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>({
    category: 'pothole',
    description: '',
    severity: 'Medium',
    latitude: null,
    longitude: null,
    locationMethod: 'none',
    imageBlob: null,
    imagePreviewUrl: null,
  });

  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [activeTab, setActiveTab] = useState<'report' | 'myreports'>('report');
  const [myReportImages, setMyReportImages] = useState<Record<string, string | null>>({});
  const [dragOver, setDragOver] = useState(false);

  // Load images for my reports
  const myReports = state.reports.filter(r => !r.isSeeded);
  useEffect(() => {
    const loadImages = async () => {
      const imgs: Record<string, string | null> = {};
      for (const report of myReports) {
        if (report.imageKey) {
          imgs[report.reportId] = await getImageUrl(report.imageKey);
        }
      }
      setMyReportImages(imgs);
    };
    if (myReports.length > 0) loadImages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.reports]);

  // Handle GPS geolocation
  const handleGetLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by this browser. Please enter coordinates manually.');
      return;
    }
    setGeoLoading(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(f => ({
          ...f,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          locationMethod: 'gps',
        }));
        setGeoLoading(false);
      },
      err => {
        setGeoLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Location permission denied. Please allow location access or enter coordinates manually.');
        } else {
          setGeoError(`Could not get location: ${err.message}. Please enter coordinates manually.`);
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, []);

  // Handle image selection
  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setForm(f => ({ ...f, imageBlob: file, imagePreviewUrl: url }));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  };

  // Form validation
  const validateForm = (): string | null => {
    if (!form.description.trim()) return 'Please provide a description of the issue.';
    if (form.description.trim().length < 10) return 'Description must be at least 10 characters.';
    if (form.latitude === null || form.longitude === null) return 'Please provide a location (use GPS or enter coordinates manually).';
    return null;
  };

  // Submit
  const handleSubmit = async () => {
    const err = validateForm();
    if (err) { setSubmitError(err); return; }
    setSubmitError('');
    setSubmitting(true);
    try {
      let imageKey: string | null = null;
      if (form.imageBlob) {
        imageKey = await saveImage(form.imageBlob);
      }
      const result = await submitReport({
        locationId: null,
        latitude: form.latitude!,
        longitude: form.longitude!,
        category: form.category,
        description: form.description,
        severity: form.severity,
        imageDataUrl: null,
        imageKey,
        submittedBy: 'Citizen (Anonymous)',
      });
      setSubmitResult(result);
    } catch (e) {
      setSubmitError(`Submission failed: ${String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewReport = () => {
    setSubmitResult(null);
    setForm({
      category: 'pothole',
      description: '',
      severity: 'Medium',
      latitude: null,
      longitude: null,
      locationMethod: 'none',
      imageBlob: null,
      imagePreviewUrl: null,
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0B0D0F' }}>
      {/* Header */}
      <header style={{
        background: '#17191C',
        borderBottom: '1px solid #2A2D32',
        padding: '0.875rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 32, height: 32, background: '#FFB21A', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🏙️</div>
          <span style={{ fontWeight: 700, color: '#F0F0F2' }}>CivicPriority</span>
          <span className="badge badge-green" style={{ marginLeft: '0.25rem' }}>Citizen Portal</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push('/')}>← Home</button>
      </header>

      <div style={{ maxWidth: 880, margin: '0 auto', padding: '1.5rem' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #2A2D32', paddingBottom: '0' }}>
          {[
            { key: 'report', label: '📝 Report an Issue' },
            { key: 'myreports', label: `📋 My Reports (${myReports.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              className="btn btn-ghost"
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              style={{
                borderRadius: '8px 8px 0 0',
                borderBottom: activeTab === tab.key ? '2px solid #FFB21A' : '2px solid transparent',
                color: activeTab === tab.key ? '#FFB21A' : '#9CA3AF',
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Report Form ─────────────────────────────────────────── */}
        {activeTab === 'report' && (
          <div className="animate-fade-in">
            {submitResult ? (
              /* Success screen */
              <div className="card" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '2.5rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                <h2 style={{ color: '#22C55E', marginBottom: '0.5rem' }}>Report Submitted!</h2>
                {submitResult.isDuplicate ? (
                  <p style={{ color: '#9CA3AF', fontSize: '0.9375rem', marginBottom: '1.25rem' }}>
                    Your report was linked to an existing civic issue as a duplicate — this strengthens the evidence for that issue.
                  </p>
                ) : (
                  <p style={{ color: '#9CA3AF', fontSize: '0.9375rem', marginBottom: '1.25rem' }}>
                    A new civic issue has been created and added to the municipal priority queue.
                  </p>
                )}
                <div className="card" style={{ background: '#22252A', marginBottom: '1.25rem', textAlign: 'left' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reference IDs</div>
                  <div style={{ fontFamily: 'monospace', color: '#FFB21A', fontSize: '0.9375rem' }}>Report: {submitResult.reportId}</div>
                  <div style={{ fontFamily: 'monospace', color: '#F0F0F2', fontSize: '0.875rem' }}>Issue: {submitResult.issueId}</div>
                  {submitResult.isDuplicate && (
                    <div className="badge badge-blue" style={{ marginTop: '0.5rem' }}>🔗 Linked as duplicate</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={handleNewReport}>Submit Another Report</button>
                  <button className="btn btn-secondary" onClick={() => setActiveTab('myreports')}>View My Reports</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                {/* Photo upload */}
                <div className="card">
                  <h3 style={{ color: '#F0F0F2', marginBottom: '1rem' }}>📸 Upload Photo</h3>
                  <div
                    className={`upload-zone ${dragOver ? 'dragover' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    role="button"
                    aria-label="Upload photo of the issue"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
                  >
                    {form.imagePreviewUrl ? (
                      <div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={form.imagePreviewUrl}
                          alt="Issue preview"
                          style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 8, objectFit: 'cover' }}
                        />
                        <p style={{ color: '#9CA3AF', fontSize: '0.8125rem', marginTop: '0.5rem' }}>Click to replace</p>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📷</div>
                        <p style={{ color: '#9CA3AF', fontSize: '0.875rem' }}>Click or drag & drop a photo here</p>
                        <p style={{ color: '#6B7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>Optional but recommended. Stored locally in your browser.</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    aria-label="File input for issue photo"
                  />
                </div>

                {/* Category & Severity */}
                <div className="card">
                  <h3 style={{ color: '#F0F0F2', marginBottom: '1rem' }}>🏷️ Issue Details</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Category */}
                    <div className="form-group">
                      <label className="form-label form-required">Issue Category</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem' }}>
                        {CATEGORIES.map(cat => (
                          <button
                            key={cat.value}
                            id={`cat-${cat.value}`}
                            onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                            style={{
                              padding: '0.625rem 0.75rem',
                              borderRadius: 8,
                              border: `1px solid ${form.category === cat.value ? '#FFB21A' : '#2A2D32'}`,
                              background: form.category === cat.value ? '#FFB21A15' : 'transparent',
                              color: form.category === cat.value ? '#FFB21A' : '#9CA3AF',
                              cursor: 'pointer',
                              fontSize: '0.8125rem',
                              fontWeight: 500,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              textAlign: 'left',
                              transition: 'all 0.15s',
                            }}
                            aria-pressed={form.category === cat.value}
                          >
                            <span>{cat.icon}</span>
                            <span>{cat.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Description */}
                    <div className="form-group">
                      <label className="form-label form-required">Description</label>
                      <textarea
                        className="form-textarea"
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Describe the issue in detail. What did you see? When did it start? How does it affect people?"
                        rows={4}
                        aria-label="Issue description"
                      />
                      <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>{form.description.length} chars</span>
                    </div>

                    {/* Severity */}
                    <div className="form-group">
                      <label className="form-label form-required">Severity</label>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {SEVERITIES.map(sev => (
                          <button
                            key={sev.value}
                            id={`sev-${sev.value}`}
                            onClick={() => setForm(f => ({ ...f, severity: sev.value }))}
                            className={`btn btn-sm ${form.severity === sev.value ? 'btn-primary' : 'btn-secondary'}`}
                            style={{
                              borderColor: form.severity === sev.value ? undefined : '#2A2D32',
                            }}
                            aria-pressed={form.severity === sev.value}
                          >
                            <SeverityBadge severity={sev.value} />
                            <span style={{ color: '#6B7280', fontSize: '0.75rem' }}>{sev.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="card">
                  <h3 style={{ color: '#F0F0F2', marginBottom: '1rem' }}>📍 Location</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <button
                        id="btn-get-location"
                        className="btn btn-primary"
                        onClick={handleGetLocation}
                        disabled={geoLoading}
                        aria-label="Get current GPS location"
                      >
                        {geoLoading ? <Spinner label="" /> : '📡'} Use My Location (GPS)
                      </button>
                      {form.locationMethod === 'gps' && form.latitude !== null && (
                        <span className="badge badge-green">📡 GPS acquired</span>
                      )}
                    </div>
                    {geoError && <ErrorState message={geoError} />}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label className="form-label form-required">Latitude</label>
                        <input
                          className="form-input"
                          type="number"
                          step="0.000001"
                          value={form.latitude ?? ''}
                          onChange={e => setForm(f => ({ ...f, latitude: parseFloat(e.target.value) || null, locationMethod: 'manual' }))}
                          placeholder="e.g. 16.5163"
                          aria-label="Latitude"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label form-required">Longitude</label>
                        <input
                          className="form-input"
                          type="number"
                          step="0.000001"
                          value={form.longitude ?? ''}
                          onChange={e => setForm(f => ({ ...f, longitude: parseFloat(e.target.value) || null, locationMethod: 'manual' }))}
                          placeholder="e.g. 80.5156"
                          aria-label="Longitude"
                        />
                      </div>
                    </div>
                    {form.latitude !== null && form.longitude !== null && (
                      <div style={{ fontSize: '0.8125rem', color: '#9CA3AF' }}>
                        📌 {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                        {form.locationMethod === 'manual' && <span className="badge badge-gray" style={{ marginLeft: '0.5rem' }}>Manual entry</span>}
                      </div>
                    )}
                    <p style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                      Tip: For demo purposes, try coordinates within Vijayawada area: lat 16.3–16.6, lon 80.4–80.7
                    </p>
                  </div>
                </div>

                {/* Submit */}
                {submitError && <ErrorState message={submitError} />}
                <button
                  id="btn-submit-report"
                  className="btn btn-primary btn-lg"
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{ width: '100%' }}
                  aria-label="Submit civic issue report"
                >
                  {submitting ? <Spinner label="Submitting..." /> : '📤 Submit Report'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── My Reports ──────────────────────────────────────────── */}
        {activeTab === 'myreports' && (
          <div className="animate-fade-in">
            <SimulatedDisclaimer />
            <div style={{ marginTop: '1rem' }}>
              {myReports.length === 0 ? (
                <EmptyState
                  icon="📭"
                  title="No reports yet"
                  message="Submit your first civic issue report to see it here."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {[...myReports].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map(report => (
                    <div key={report.reportId} className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      {/* Thumbnail */}
                      {myReportImages[report.reportId] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={myReportImages[report.reportId]!}
                          alt="Report photo"
                          style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{ width: 72, height: 72, borderRadius: 8, background: '#22252A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>📋</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
                          <span style={{ fontWeight: 600, color: '#F0F0F2', fontSize: '0.9375rem' }}>
                            <CategoryLabel category={report.category} />
                          </span>
                          <StatusBadge status={report.status} />
                          <SeverityBadge severity={report.severity} />
                        </div>
                        <p style={{ color: '#9CA3AF', fontSize: '0.8125rem', marginBottom: '0.375rem' }} className="truncate">
                          {report.description}
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#6B7280', flexWrap: 'wrap' }}>
                          <span>🕐 {new Date(report.submittedAt).toLocaleString()}</span>
                          <span>📌 {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}</span>
                          <span style={{ fontFamily: 'monospace' }}>{report.reportId}</span>
                        </div>
                        {report.canonicalIssueId && (
                          <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: '#FFB21A' }}>
                            Linked to issue: <span style={{ fontFamily: 'monospace' }}>{report.canonicalIssueId}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
