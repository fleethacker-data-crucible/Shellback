/**
 * ROI scenario model. Cash avoidance and the monetized value of recovered time are
 * kept strictly separate; only cash is compared against operating cost.
 */
import type { RoiInputs } from './schema';

export interface RoiScenario {
  people: number;
  cashTraining: number;
  cashExternal: number;
  trainingHours: number;
  grossWorkflow: number;
  overlapDeduction: number;
  workflow: number;
  cash: number;
  capacity: number;
  cost: number;
  total: number;
  netCash: number;
  /** cash / cost, or null when cost is zero. */
  multiple: number | null;
}

const pct = (v: number) => Math.min(1, Math.max(0, (Number(v) || 0) / 100));

export function roiScenario(p: RoiInputs, adoptionFactor = 1): RoiScenario {
  const participants = Math.max(0, Number(p.employees) || 0);
  const uptake = Math.min(1, Math.max(0, ((Number(p.adoption) || 0) * adoptionFactor) / 100));
  const people = participants * uptake;
  const avoidance = pct(p.trainingAvoidance);
  const externalAvoidance = pct(p.externalAvoidance);
  const cashTraining = people * (Number(p.trainingCost) || 0) * avoidance;
  const cashExternal = (Number(p.externalSpend) || 0) * externalAvoidance * uptake;
  const trainingHours = people * (Number(p.trainingHours) || 0) * (Number(p.hourlyRate) || 0) * avoidance;
  const grossWorkflow = people * ((Number(p.minutesSaved) || 0) / 60) * (Number(p.weeks) || 0) * (Number(p.hourlyRate) || 0) * pct(p.realization);
  const overlapDeduction = Math.min(trainingHours, grossWorkflow) * pct(p.overlap);
  const workflow = Math.max(0, grossWorkflow - overlapDeduction);
  const cash = cashTraining + cashExternal;
  const capacity = trainingHours + workflow;
  const cost = Math.max(0, Number(p.annualCost) || 0);
  return {
    people, cashTraining, cashExternal, trainingHours, grossWorkflow, overlapDeduction, workflow,
    cash, capacity, cost, total: cash + capacity, netCash: cash - cost, multiple: cost > 0 ? cash / cost : null,
  };
}

export const ROI_LABELS: Readonly<Record<keyof RoiInputs, readonly [label: string, unit: string]>> = {
  employees: ['Pilot participants', 'people'],
  trainingCost: ['Annual training spend per person', '$'],
  trainingAvoidance: ['Avoided duplicate training', '%'],
  trainingHours: ['Annual training hours per person', 'hours'],
  hourlyRate: ['Loaded hourly rate', '$'],
  externalSpend: ['Annual outside specialist spend', '$'],
  externalAvoidance: ['External spend avoidance', '%'],
  minutesSaved: ['Minutes recovered per person / week', 'minutes'],
  weeks: ['Working weeks / year', 'weeks'],
  realization: ['Usable share of recovered time', '%'],
  adoption: ['Employees adopting the workflow', '%'],
  overlap: ['Estimated overlapping time benefits', '%'],
  annualCost: ['Annual platform operating cost', '$'],
};
