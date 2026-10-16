/**
 * @fileoverview API route: GET /api/model-params
 * Returns the trained logistic regression model parameters (if available).
 * Parameters are saved by the training script to model-params.json.
 */

import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { ModelParameters } from '@/lib/types';

export async function GET() {
  try {
    const paramsPath = path.join(process.cwd(), 'model-params.json');
    if (!fs.existsSync(paramsPath)) {
      return NextResponse.json(
        { error: 'Model not trained yet. Run: npm run train', trained: false },
        { status: 404 }
      );
    }
    const params: ModelParameters = JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
    return NextResponse.json({ params, trained: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load model parameters', detail: String(error) },
      { status: 500 }
    );
  }
}
