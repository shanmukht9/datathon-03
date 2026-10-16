/**
 * @fileoverview Browser-side persistence layer using IndexedDB.
 *
 * Stores:
 * - CitizenReport metadata (JSON store)
 * - CanonicalIssue records (JSON store)
 * - Image blobs (separate blob store keyed by imageKey)
 * - ResolutionEvidence (bundled with CanonicalIssue)
 *
 * All data survives page refreshes. Does not modify historical CSV data.
 */

import { CitizenReport, CanonicalIssue } from './types';

const DB_NAME = 'civic-priority-db';
const DB_VERSION = 1;

const STORES = {
  reports: 'citizen_reports',
  issues: 'canonical_issues',
  images: 'images',
} as const;

// ─── DB initialization ────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

/**
 * Open (or upgrade) the IndexedDB database.
 * Creates object stores if they do not exist.
 */
export function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORES.reports)) {
        db.createObjectStore(STORES.reports, { keyPath: 'reportId' });
      }
      if (!db.objectStoreNames.contains(STORES.issues)) {
        db.createObjectStore(STORES.issues, { keyPath: 'issueId' });
      }
      if (!db.objectStoreNames.contains(STORES.images)) {
        db.createObjectStore(STORES.images); // key = imageKey string
      }
    };

    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}

// ─── Generic helpers ──────────────────────────────────────────────────────

function idbGet<T>(db: IDBDatabase, storeName: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function idbPut<T>(db: IDBDatabase, storeName: string, value: T, key?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = key !== undefined ? store.put(value, key) : store.put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, storeName: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Citizen reports ──────────────────────────────────────────────────────

export async function saveReport(report: CitizenReport): Promise<void> {
  const db = await openDB();
  await idbPut(db, STORES.reports, report);
}

export async function getReport(reportId: string): Promise<CitizenReport | undefined> {
  const db = await openDB();
  return idbGet<CitizenReport>(db, STORES.reports, reportId);
}

export async function getAllReports(): Promise<CitizenReport[]> {
  const db = await openDB();
  return idbGetAll<CitizenReport>(db, STORES.reports);
}

export async function updateReport(report: CitizenReport): Promise<void> {
  const db = await openDB();
  await idbPut(db, STORES.reports, report);
}

// ─── Canonical issues ─────────────────────────────────────────────────────

export async function saveIssue(issue: CanonicalIssue): Promise<void> {
  const db = await openDB();
  await idbPut(db, STORES.issues, issue);
}

export async function getIssue(issueId: string): Promise<CanonicalIssue | undefined> {
  const db = await openDB();
  return idbGet<CanonicalIssue>(db, STORES.issues, issueId);
}

export async function getAllIssues(): Promise<CanonicalIssue[]> {
  const db = await openDB();
  return idbGetAll<CanonicalIssue>(db, STORES.issues);
}

export async function updateIssue(issue: CanonicalIssue): Promise<void> {
  const db = await openDB();
  await idbPut(db, STORES.issues, issue);
}

export async function deleteIssue(issueId: string): Promise<void> {
  const db = await openDB();
  await idbDelete(db, STORES.issues, issueId);
}

// ─── Images ───────────────────────────────────────────────────────────────

/**
 * Save an image blob. Returns the generated image key.
 */
export async function saveImage(blob: Blob): Promise<string> {
  const db = await openDB();
  const key = `img_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await idbPut(db, STORES.images, blob, key);
  return key;
}

export async function getImage(key: string): Promise<Blob | undefined> {
  const db = await openDB();
  return idbGet<Blob>(db, STORES.images, key);
}

export async function getImageUrl(key: string | null): Promise<string | null> {
  if (!key) return null;
  const blob = await getImage(key);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

// ─── ID generation ────────────────────────────────────────────────────────

/**
 * Generate a readable civic issue ID.
 */
export function generateIssueId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `CI-${ts}-${rand}`;
}

/**
 * Generate a readable report reference ID.
 */
export function generateReportId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `CR-${ts}-${rand}`;
}
