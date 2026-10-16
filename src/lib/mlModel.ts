/**
 * @fileoverview Logistic regression model trained from scratch in TypeScript.
 *
 * Target: predict P(incident remains unresolved) using pre-resolution features only.
 * Features: severity (one-hot), incident_type (one-hot), injuries (numeric),
 *           reported_by (one-hot). resolution_hours is EXCLUDED to prevent leakage.
 *
 * Training: batch gradient descent with binary cross-entropy loss.
 * Evaluation: confusion matrix, precision, recall, F1, accuracy, ROC-AUC.
 */

import { IncidentRow, ModelFeatures, ModelParameters, ModelEvaluation } from './types';

// ─── Feature engineering ──────────────────────────────────────────────────

const SEVERITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;
const INCIDENT_TYPES = ['Pothole', 'Flooding', 'Drainage', 'Streetlight', 'Traffic', 'Collision', 'Other'] as const;
const REPORTED_BY = ['Citizen', 'Officer', 'Worker'] as const;

export const FEATURE_NAMES: string[] = [
  'injuries',
  ...SEVERITY_LEVELS.map((s) => `severity_${s}`),
  ...INCIDENT_TYPES.map((t) => `incident_type_${t}`),
  ...REPORTED_BY.map((r) => `reported_by_${r}`),
];

/**
 * Extract raw numeric feature vector from an IncidentRow.
 * resolution_hours is deliberately NOT included (target leakage).
 */
export function extractFeatures(incident: IncidentRow): number[] {
  const features: number[] = [];

  // Numeric: injury count
  features.push(incident.injuries);

  // One-hot: severity
  for (const sev of SEVERITY_LEVELS) {
    features.push(incident.severity === sev ? 1 : 0);
  }

  // One-hot: incident type (normalize to match our categories)
  const normType = normalizeIncidentType(incident.incident_type);
  for (const t of INCIDENT_TYPES) {
    features.push(normType === t ? 1 : 0);
  }

  // One-hot: reported_by
  const normBy = normalizeReportedBy(incident.reported_by);
  for (const r of REPORTED_BY) {
    features.push(normBy === r ? 1 : 0);
  }

  return features;
}

function normalizeIncidentType(type: string): (typeof INCIDENT_TYPES)[number] {
  const t = type.toLowerCase();
  if (t.includes('pothole') || t.includes('road')) return 'Pothole';
  if (t.includes('flood')) return 'Flooding';
  if (t.includes('drain')) return 'Drainage';
  if (t.includes('light') || t.includes('lamp')) return 'Streetlight';
  if (t.includes('traffic') || t.includes('signal')) return 'Traffic';
  if (t.includes('collision') || t.includes('accident')) return 'Collision';
  return 'Other';
}

function normalizeReportedBy(by: string): (typeof REPORTED_BY)[number] {
  const b = by.toLowerCase();
  if (b.includes('officer') || b.includes('municipal')) return 'Officer';
  if (b.includes('worker') || b.includes('field')) return 'Worker';
  return 'Citizen';
}

// ─── Standardization ──────────────────────────────────────────────────────

/**
 * Compute mean and std from training set feature matrix.
 * Only numeric (continuous) features are standardized; binary features are left as-is.
 * We standardize all features for simplicity (binary features ≈ Bernoulli mean/std).
 */
export function computeStats(matrix: number[][]): { mean: number[]; std: number[] } {
  const n = matrix.length;
  const d = matrix[0].length;
  const mean = new Array<number>(d).fill(0);
  const std = new Array<number>(d).fill(1);

  // Mean
  for (const row of matrix) {
    for (let j = 0; j < d; j++) mean[j] += row[j];
  }
  for (let j = 0; j < d; j++) mean[j] /= n;

  // Std
  for (const row of matrix) {
    for (let j = 0; j < d; j++) std[j] += (row[j] - mean[j]) ** 2;
  }
  for (let j = 0; j < d; j++) {
    std[j] = Math.sqrt(std[j] / n) || 1; // avoid division by zero
  }

  return { mean, std };
}

/** Standardize a single feature vector using pre-computed stats. */
export function standardize(features: number[], mean: number[], std: number[]): number[] {
  return features.map((v, i) => (v - mean[i]) / std[i]);
}

// ─── Sigmoid & loss ──────────────────────────────────────────────────────

/** Sigmoid activation function. */
export function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, z))));
}

/**
 * Compute dot product of weights and feature vector, plus bias.
 */
function dotProduct(weights: number[], features: number[], bias: number): number {
  let z = bias;
  for (let i = 0; i < weights.length; i++) z += weights[i] * features[i];
  return z;
}

/**
 * Binary cross-entropy loss with epsilon clipping to prevent log(0).
 */
export function binaryCrossEntropy(
  predictions: number[],
  labels: number[],
  weights: number[],
  l2Lambda = 0.001
): number {
  const eps = 1e-15;
  let loss = 0;
  for (let i = 0; i < predictions.length; i++) {
    const p = Math.max(eps, Math.min(1 - eps, predictions[i]));
    loss += -labels[i] * Math.log(p) - (1 - labels[i]) * Math.log(1 - p);
  }
  // L2 regularisation
  const l2 = l2Lambda * weights.reduce((s, w) => s + w * w, 0);
  return loss / predictions.length + l2;
}

// ─── Training ─────────────────────────────────────────────────────────────

export interface TrainingConfig {
  epochs: number;
  learningRate: number;
  l2Lambda: number;
  verbose: boolean;
}

const DEFAULT_CONFIG: TrainingConfig = {
  epochs: 300,
  learningRate: 0.05,
  l2Lambda: 0.001,
  verbose: false,
};

/**
 * Train logistic regression using batch gradient descent.
 * Returns learned weights, bias, and training statistics.
 *
 * @param trainMatrix - Standardized feature matrix [n_samples × n_features]
 * @param labels      - Binary labels (1 = unresolved, 0 = resolved)
 * @param config      - Training hyperparameters
 */
export function trainLogisticRegression(
  trainMatrix: number[][],
  labels: number[],
  config: Partial<TrainingConfig> = {}
): { weights: number[]; bias: number; finalLoss: number; lossHistory: number[] } {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const n = trainMatrix.length;
  const d = trainMatrix[0].length;

  // Deterministic initialization (fixed seed behavior via constant values)
  const weights = new Array<number>(d).fill(0);
  let bias = 0;

  const lossHistory: number[] = [];
  let finalLoss = Infinity;

  for (let epoch = 0; epoch < cfg.epochs; epoch++) {
    // Forward pass
    const predictions: number[] = [];
    for (let i = 0; i < n; i++) {
      predictions.push(sigmoid(dotProduct(weights, trainMatrix[i], bias)));
    }

    // Compute loss
    const loss = binaryCrossEntropy(predictions, labels, weights, cfg.l2Lambda);
    lossHistory.push(loss);
    finalLoss = loss;

    if (cfg.verbose && epoch % 50 === 0) {
      console.log(`Epoch ${epoch}: loss = ${loss.toFixed(6)}`);
    }

    // Gradients (batch)
    const dW = new Array<number>(d).fill(0);
    let dB = 0;
    for (let i = 0; i < n; i++) {
      const err = predictions[i] - labels[i];
      for (let j = 0; j < d; j++) {
        dW[j] += err * trainMatrix[i][j];
      }
      dB += err;
    }

    // Update with L2
    for (let j = 0; j < d; j++) {
      weights[j] -= cfg.learningRate * (dW[j] / n + cfg.l2Lambda * weights[j]);
    }
    bias -= cfg.learningRate * (dB / n);
  }

  return { weights, bias, finalLoss, lossHistory };
}

// ─── Inference ────────────────────────────────────────────────────────────

/**
 * Predict probability that an incident is unresolved.
 * Accepts raw features (will be standardized using saved stats).
 */
export function predictUnresolvedProb(
  incident: IncidentRow,
  params: ModelParameters
): number {
  const raw = extractFeatures(incident);
  const std = standardize(raw, params.trainMean, params.trainStd);
  return sigmoid(dotProduct(params.weights, std, params.bias));
}

// ─── Evaluation ──────────────────────────────────────────────────────────

/**
 * Evaluate the model on a held-out test set.
 * Threshold = 0.5 for binary classification metrics.
 */
export function evaluateModel(
  testMatrix: number[][],
  labels: number[],
  weights: number[],
  bias: number
): ModelEvaluation {
  const predictions = testMatrix.map((row) => sigmoid(dotProduct(weights, row, bias)));
  const threshold = 0.5;

  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (let i = 0; i < labels.length; i++) {
    const pred = predictions[i] >= threshold ? 1 : 0;
    if (pred === 1 && labels[i] === 1) tp++;
    else if (pred === 1 && labels[i] === 0) fp++;
    else if (pred === 0 && labels[i] === 1) fn++;
    else tn++;
  }

  const accuracy = (tp + tn) / labels.length;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  // ROC-AUC via trapezoidal rule
  const rocAuc = computeRocAuc(predictions, labels);

  const resolved = labels.filter((l) => l === 0).length;
  const unresolved = labels.filter((l) => l === 1).length;

  return {
    accuracy,
    precision,
    recall,
    f1,
    rocAuc,
    confusionMatrix: { tp, fp, tn, fn },
    testSize: labels.length,
    trainSize: 0, // filled by caller
    classBalance: { resolved, unresolved },
  };
}

/**
 * Compute ROC-AUC using the trapezoidal rule.
 * Returns null if only one class present in labels.
 */
export function computeRocAuc(scores: number[], labels: number[]): number | null {
  const unique = new Set(labels);
  if (unique.size < 2) return null;

  // Sort by descending score
  const pairs = scores.map((s, i) => ({ s, l: labels[i] })).sort((a, b) => b.s - a.s);

  const totalPos = labels.filter((l) => l === 1).length;
  const totalNeg = labels.length - totalPos;

  let auc = 0;
  let tp = 0, fp = 0;
  let prevTp = 0, prevFp = 0;

  for (const { l } of pairs) {
    if (l === 1) tp++;
    else fp++;
    // Trapezoid
    auc += ((fp - prevFp) / totalNeg) * ((tp + prevTp) / 2 / totalPos);
    prevTp = tp;
    prevFp = fp;
  }

  return auc;
}

// ─── Full training pipeline ───────────────────────────────────────────────

/**
 * End-to-end: extract features, split train/test chronologically,
 * standardize, train, evaluate, and return model parameters + evaluation.
 */
export function runTrainingPipeline(
  incidents: IncidentRow[],
  config: Partial<TrainingConfig> = {}
): { params: ModelParameters; evaluation: ModelEvaluation } {
  // Sort chronologically
  const sorted = [...incidents].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Chronological 80/20 split
  const splitIdx = Math.floor(sorted.length * 0.8);
  const trainData = sorted.slice(0, splitIdx);
  const testData = sorted.slice(splitIdx);

  // Labels: 1 = unresolved (positive class), 0 = resolved
  const trainLabels = trainData.map((r) => (r.resolved ? 0 : 1));
  const testLabels = testData.map((r) => (r.resolved ? 0 : 1));

  // Feature extraction
  const trainRaw = trainData.map(extractFeatures);
  const testRaw = testData.map(extractFeatures);

  // Standardize using ONLY training set statistics
  const { mean: trainMean, std: trainStd } = computeStats(trainRaw);
  const trainMatrix = trainRaw.map((r) => standardize(r, trainMean, trainStd));
  const testMatrix = testRaw.map((r) => standardize(r, trainMean, trainStd));

  // Train
  const { weights, bias, finalLoss } = trainLogisticRegression(trainMatrix, trainLabels, config);

  // Evaluate
  const evaluation = evaluateModel(testMatrix, testLabels, weights, bias);
  evaluation.trainSize = trainData.length;

  // Package parameters
  const params: ModelParameters = {
    weights,
    bias,
    featureNames: FEATURE_NAMES,
    trainMean,
    trainStd,
    trainedAt: new Date().toISOString(),
    epochs: config.epochs ?? DEFAULT_CONFIG.epochs,
    learningRate: config.learningRate ?? DEFAULT_CONFIG.learningRate,
    finalLoss,
  };

  return { params, evaluation };
}
