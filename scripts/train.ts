/**
 * @fileoverview Standalone ML Training Script for CivicPriority.
 * Trains logistic regression model from scratch using TypeScript.
 * Reads incidents.csv, splits chronologically (80/20 train/test),
 * trains via batch gradient descent with L2 regularization,
 * evaluates metrics, and outputs model-params.json and evaluation-results.json.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseCSV, parseIncidentRow } from '../src/lib/dataPipeline';
import { runTrainingPipeline } from '../src/lib/mlModel';
import { IncidentRow } from '../src/lib/types';

/**
 * Main training execution function.
 * Loads incidents dataset, runs chronological training pipeline,
 * logs metrics to console, and saves parameters to JSON.
 */
async function main(): Promise<void> {
  console.log('====================================================');
  console.log(' CivicPriority — Machine Learning Training Pipeline ');
  console.log(' Supervised Logistic Regression (Pure TypeScript)   ');
  console.log('====================================================\n');

  const incidentsPath = path.resolve(process.cwd(), 'incidents.csv');
  if (!fs.existsSync(incidentsPath)) {
    console.error(`Error: Incidents file not found at: ${incidentsPath}`);
    process.exit(1);
  }

  console.log(`[1/4] Ingesting incidents dataset from ${path.basename(incidentsPath)}...`);
  const rawText = fs.readFileSync(incidentsPath, 'utf8');
  const rawRows = parseCSV(rawText);
  const incidentRecords = rawRows
    .map(parseIncidentRow)
    .filter((r): r is IncidentRow => r !== null);
  console.log(`      Loaded ${incidentRecords.length.toLocaleString()} valid incident records.`);

  console.log('\n[2/4] Training Logistic Regression model (chronological split, no post-resolution leakage)...');
  const startTime = Date.now();
  const { params, evaluation } = runTrainingPipeline(incidentRecords, {
    learningRate: 0.1,
    epochs: 400,
    l2Lambda: 0.001,
  });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`      Training completed in ${duration}s.`);

  console.log('\n[3/4] Model Evaluation Metrics (on held-out test split):');
  console.log(`      • Total Incidents:    ${incidentRecords.length.toLocaleString()}`);
  console.log(`      • Training Set Size:  ${evaluation.trainSize.toLocaleString()}`);
  console.log(`      • Test Set Size:      ${evaluation.testSize.toLocaleString()}`);
  console.log(`      • Test Unresolved:    ${evaluation.unresolvedCount.toLocaleString()} (${(evaluation.unresolvedRate * 100).toFixed(1)}%)`);
  console.log(`      • Accuracy:           ${(evaluation.accuracy * 100).toFixed(2)}%`);
  console.log(`      • Precision:          ${(evaluation.precision * 100).toFixed(2)}%`);
  console.log(`      • Recall:             ${(evaluation.recall * 100).toFixed(2)}%`);
  console.log(`      • F1 Score:           ${(evaluation.f1Score * 100).toFixed(2)}%`);
  console.log(`      • ROC-AUC:            ${evaluation.rocAuc.toFixed(4)}`);
  console.log(`      • Confusion Matrix:   TP=${evaluation.confusionMatrix.tp}, FP=${evaluation.confusionMatrix.fp}, TN=${evaluation.confusionMatrix.tn}, FN=${evaluation.confusionMatrix.fn}`);

  console.log('\n[4/4] Persisting model parameters and evaluation metrics...');
  const modelParamsPath = path.resolve(process.cwd(), 'model-params.json');
  const evalResultsPath = path.resolve(process.cwd(), 'evaluation-results.json');

  fs.writeFileSync(modelParamsPath, JSON.stringify(params, null, 2), 'utf8');
  fs.writeFileSync(evalResultsPath, JSON.stringify(evaluation, null, 2), 'utf8');

  console.log(`      Saved parameters to: ${path.basename(modelParamsPath)}`);
  console.log(`      Saved metrics to:    ${path.basename(evalResultsPath)}`);
  console.log('\nTraining pipeline successfully finished!\n');
}

main().catch((err: unknown) => {
  console.error('Fatal training error:', err);
  process.exit(1);
});
