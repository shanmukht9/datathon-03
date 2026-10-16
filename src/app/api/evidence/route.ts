/**
 * @fileoverview API route: GET /api/evidence
 * Loads and aggregates the three CSV datasets server-side.
 * Returns serializable LocationEvidence records keyed by location_id.
 *
 * NOTE: This runs in the Node.js runtime, NOT the browser edge runtime.
 */

import { NextResponse } from 'next/server';
import path from 'path';
import { loadDataPipeline } from '@/lib/dataPipeline';
import { computePriority } from '@/lib/priorityEngine';
import { LocationEvidence } from '@/lib/types';

// Cache the result in-memory for the lifetime of the server process
let cachedEvidence: Record<string, LocationEvidence> | null = null;

export async function GET() {
  try {
    if (cachedEvidence) {
      return NextResponse.json({ evidence: cachedEvidence, cached: true });
    }

    // Data lives in project root alongside package.json
    const dataDir = path.join(process.cwd());
    const { evidence } = loadDataPipeline(dataDir);

    // Convert Map to plain object for JSON serialization
    const evidenceObj: Record<string, LocationEvidence> = {};
    evidence.forEach((ev, id) => {
      evidenceObj[id] = ev;
    });

    cachedEvidence = evidenceObj;

    return NextResponse.json({
      evidence: evidenceObj,
      count: Object.keys(evidenceObj).length,
      cached: false,
    });
  } catch (error) {
    console.error('[/api/evidence] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load evidence data', detail: String(error) },
      { status: 500 }
    );
  }
}
