import type { Task, ScoreBreakdown, BacklogData } from './types.js';

// Scoring weights derived from AGENTS.md Lightweight Scoring Model
const PRIORITY_SCORES: Record<string, number> = {
  Critical: 40,
  Major: 25,
  Minor: 10,
  Unprioritized: 0,
  P0: 40,
  P1: 25,
  P2: 10,
  P3: 0,
};

const STATUS_SCORES: Record<string, number> = {
  'Prioritized': 30,
  'Pre-Pro Ready': 28,
  'Ready for release': 26,
  'Prepro-In Progress': 20,
  'TODO': 15,
  'Pod Working': 12,
  'BLOCK': 5,
  'TRIAGE': 3,
  'HOLD': 0,
  'Live': 0,
};

const PREPRO_SCORES: Record<string, number> = {
  '0 - Low': 25,
  '1 - Mid': 10,
  '2 - High': 0,
};

const RISK_SCORES: Record<string, number> = {
  'Low': 15,
  'High': 0,
};

const APPEARANCE_SCORES: Record<string, number> = {
  'All Sessions': 15,
  'Daily': 12,
  'Sometimes': 8,
  'Uncommon': 3,
};

const TYPE_SCORES: Record<string, number> = {
  'Bug': 5,
  'Improvement': 0,
};

export function scoreTask(task: Task, duplicateIds: Map<string, number>): ScoreBreakdown {
  const breakdown: ScoreBreakdown = {
    priority: PRIORITY_SCORES[task.priority] ?? 0,
    status: STATUS_SCORES[task.status] ?? 0,
    prepro: PREPRO_SCORES[task.preproWork] ?? 5, // slight benefit of doubt for unknown
    risk: RISK_SCORES[task.risk] ?? 5,            // slight benefit of doubt for unknown
    appearance: APPEARANCE_SCORES[task.appearance] ?? 0,
    type: TYPE_SCORES[task.type] ?? 0,
    metadataQuality: 0,
  };

  // Metadata quality penalties
  if (!task.priority) breakdown.metadataQuality -= 5;
  if (!task.status) breakdown.metadataQuality -= 5;
  if (task.id && duplicateIds.has(task.id)) breakdown.metadataQuality -= 10;

  return breakdown;
}

export function totalScore(breakdown: ScoreBreakdown): number {
  return (
    breakdown.priority +
    breakdown.status +
    breakdown.prepro +
    breakdown.risk +
    breakdown.appearance +
    breakdown.type +
    breakdown.metadataQuality
  );
}

export function scoreTasks(backlog: BacklogData): Task[] {
  for (const task of backlog.tasks) {
    task.scoreBreakdown = scoreTask(task, backlog.duplicateIds);
    task.score = totalScore(task.scoreBreakdown);
  }
  return backlog.tasks.sort((a, b) => b.score - a.score);
}

export const MAX_SCORE = 40 + 30 + 25 + 15 + 15 + 5; // 130
