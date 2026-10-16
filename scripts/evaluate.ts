/**
 * @fileoverview Standalone Model Evaluation Script for CivicPriority.
 * Loads trained model parameters from model-params.json and runs comprehensive
 * evaluation on the chronological test split of incidents.csv.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseCSV, parseIncidentRow } from '../src/lib/dataPipeline';
import { evaluateModel, extractFeatures, standardize } from '../src/lib/mlModel';
import { IncidentRow, ModelParameters } from '../src/lib/types';

/**
 * Main evaluation function.
 * Verifies trained weights, evaluates test split, displays confusion matrix
 * and feature weights ranking.
 */
async function main(): Promise<void> {
  console.log('====================================================');
  console.log(' CivicPriority — Model Evaluation & Diagnostics    ');
  console.log(' Supervised Logistic Regression (Pure TypeScript)   ');
  console.log('====================================================\n');

  const modelParamsPath = path.resolve(process.cwd(), 'model-params.json');
  if (!fs.existsSync(modelParamsPath)) {
    console.error('Error: model-params.json not found! Please run training first:\n  npm run train');
    process.exit(1);
  }

  const incidentsPath = path.resolve(process.cwd(), 'incidents.csv');
  if (!fs.existsSync(incidentsPath)) {
    console.error(`Error: Incidents file not found at: ${incidentsPath}`);
    process.exit(1);
  }

  const rawParams = fs.readFileSync(modelParamsPath, 'utf8');
  const params: ModelParameters = JSON.parse(rawParams);

  console.log(`[1/3] Loaded trained model (trained on: ${params.trainedAt}):`);
  console.log(`      • Features count:   ${params.featureNames.length}`);
  console.log(`      • Bias / Intercept: ${params.bias.toFixed(4)}`);
  console.log(`      • Training Epochs:  ${params.epochs}`);
  console.log(`      • Final Loss:       ${params.finalLoss.toFixed(4)}`);

  console.log('\n[2/3] Evaluating on incidents dataset...');
  const rawText = fs.readFileSync(incidentsPath, 'utf8');
  const rawRows = parseCSV(rawText);
  const incidents = rawRows
    .map(parseIncidentRow)
    .filter((r): r is IncidentRow => r !== null);
  
  // Chronological 80/20 test split (matching training pipeline)
  const sorted = [...incidents].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const splitIdx = Math.floor(sorted.length * 0.8);
  const testSet = sorted.slice(splitIdx);

  const testMatrix = testSet.map((inc) => {
    const raw = extractFeatures(inc);
    return standardize(raw, params.trainMean, params.trainStd);
  });
  const testLabels = testSet.map((inc) => (inc.resolved ? 0 : 1));

  const metrics = evaluateModel(testMatrix, testLabels, params.weights, params.bias);

  console.log('\n[3/3] Held-Out Test Evaluation Results:');
  console.log(`      • Test Samples:     ${testSet.length.toLocaleString()}`);
  console.log(
  `      • Actual Unresolved: ${metrics.classBalance.unresolved.toLocaleString()} (${metrics.testSize > 0 ? ((metrics.classBalance.unresolved / metrics.testSize) * 100).toFixed(1) : "0.0"}%)`
);
  console.log(`      • Accuracy:         ${(metrics.accuracy * 100).toFixed(2)}%`);
  console.log(`      • Precision:        ${(metrics.precision * 100).toFixed(2)}%`);
  console.log(`      • Recall:           ${(metrics.recall * 100).toFixed(2)}%`);
console.log(`      • F1 Score:         ${(metrics.f1 * 100).toFixed(2)}%`);
 console.log(
  `      • ROC-AUC:          ${metrics.rocAuc !== null ? metrics.rocAuc.toFixed(4) : "N/A (only one class present)"}`
);

  console.log('\nConfusion Matrix:');
  console.log('                 Predicted Unresolved   Predicted Resolved');
  console.log(`Actual Unresolved:      ${metrics.confusionMatrix.tp.toString().padEnd(10)}         ${metrics.confusionMatrix.fn.toString().padEnd(10)}`);
  console.log(`Actual Resolved:        ${metrics.confusionMatrix.fp.toString().padEnd(10)}         ${metrics.confusionMatrix.tn.toString().padEnd(10)}`);

  console.log('\nLearned Feature Weights:');
  const weightsWithNames = params.featureNames.map((name, i) => ({
    name,
    weight: params.weights[i],
  })).sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

  for (const item of weightsWithNames) {
    const sign = item.weight >= 0 ? '+' : '';
    console.log(`  ${item.name.padEnd(30)}: ${sign}${item.weight.toFixed(4)}`);
  }

  console.log('\nModel evaluation completed.\n');
}

main().catch((err: unknown) => {
  console.error('Fatal evaluation error:', err);
  process.exit(1);
});
