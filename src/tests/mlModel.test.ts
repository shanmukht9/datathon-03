/**
 * @fileoverview Unit tests for the from-scratch TypeScript Logistic Regression ML model.
 */

import { describe, it, expect } from 'vitest';
import {
  sigmoid,
  binaryCrossEntropyLoss,
  predictProbability,
  trainLogisticRegression,
  evaluateModel,
} from '../lib/mlModel';
import { ModelParameters } from '../lib/types';

describe('Machine Learning Model (Pure TypeScript Logistic Regression)', () => {
  it('computes numerically stable sigmoid function', () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 4);
    expect(sigmoid(100)).toBeCloseTo(1.0, 4);
    expect(sigmoid(-100)).toBeCloseTo(0.0, 4);
    expect(sigmoid(2)).toBeGreaterThan(0.5);
    expect(sigmoid(-2)).toBeLessThan(0.5);
  });

  it('computes binary cross entropy loss correctly', () => {
    const yTrue = [1, 0, 1, 0];
    const yPredGood = [0.95, 0.05, 0.90, 0.10];
    const yPredBad = [0.10, 0.90, 0.05, 0.95];

    const lossGood = binaryCrossEntropyLoss(yTrue, yPredGood);
    const lossBad = binaryCrossEntropyLoss(yTrue, yPredBad);

    expect(lossGood).toBeGreaterThan(0);
    expect(lossBad).toBeGreaterThan(lossGood);
  });

  it('trains logistic regression on synthetic separable data and improves loss', () => {
    // 2 features: feature 0 positively correlated with class 1
    const X = [
      [2.0, 1.0],
      [2.5, 0.8],
      [1.8, 1.2],
      [-2.0, -1.0],
      [-2.5, -0.8],
      [-1.8, -1.2],
    ];
    const y = [1, 1, 1, 0, 0, 0];

    const params = trainLogisticRegression(X, y, {
      learningRate: 0.2,
      epochs: 80,
      l2Lambda: 0.001,
      featureNames: ['feat_pos', 'feat_side'],
    });

    expect(params.weights.length).toBe(2);
    expect(params.weights[0]).toBeGreaterThan(0); // positive weight for feat_pos

    const metrics = evaluateModel(params, X, y);
    expect(metrics.accuracy).toBeGreaterThanOrEqual(0.8);
    expect(metrics.rocAuc).toBeGreaterThan(0.7);
  });

  it('calculates probability predictions within [0, 1]', () => {
    const params: ModelParameters = {
      weights: [0.5, -0.3],
      bias: 0.1,
      featureNames: ['f1', 'f2'],
      featureStats: {
        injuriesMean: 0,
        injuriesStd: 1,
        resolutionHoursMean: 0,
        resolutionHoursStd: 1,
      },
      hyperparameters: { learningRate: 0.1, epochs: 100, l2Lambda: 0.001 },
      trainedAt: new Date().toISOString(),
      trainingMetrics: {
        accuracy: 0.8,
        precision: 0.8,
        recall: 0.8,
        f1Score: 0.8,
        rocAuc: 0.85,
        confusionMatrix: { tp: 8, fp: 2, tn: 8, fn: 2 },
        trainSize: 20,
        testSize: 10,
        unresolvedCount: 10,
        unresolvedRate: 0.5,
        totalIncidents: 30,
      },
    };

    const prob = predictProbability([1.5, 0.5], params);
    expect(prob).toBeGreaterThanOrEqual(0);
    expect(prob).toBeLessThanOrEqual(1);
  });
});
