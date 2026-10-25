/**
 * ROI model, rebuilt around what Shellback actually changes and what a government program office can
 * defend. Four benefit lanes and two cost lanes, each tagged as CASH (money that stops leaving) or
 * CAPACITY (hours; never released cash). Only cash is set against operating cost. Every input carries
 * a basis (assumed / benchmark / measured) so a reviewer can see how much of the result rests on guesses.
 *
 *   Lane 1  Expertise found inside   — questions answered by an internal expert instead of a paid outside one.
 *           cash  = external hours × share now answered internally × external rate
 *           cost  = those hours × internal answer time × loaded rate   (capacity SPENT, subtracted)
 *   Lane 2  Training not duplicated  — people already hold a skill the course teaches, or a mentor covers it.
 *           cash  = people × annual training $ × avoided share          capacity = people × hours × avoided share × rate
 *   Lane 3  Credential lapses avoided — renewal reminders stop expensive requalification / downtime.
 *           cash  = lapses per year × cost per lapse × avoided share
 *   Lane 4  Finding who knows what    — leads stop asking around.  capacity only.
 *           capacity = leads × minutes/week × weeks × usable share × rate
 *   Costs   platform $ (cash) · profile upkeep (capacity spent) · admin hours (capacity spent)
 *
 * Adoption scales every people-driven lane. Break-even adoption is where cash benefit = platform cost.
 */
import { ROI_DEFAULTS, type RoiBasis, type RoiInputs, type RoiKey } from './schema';

export type LaneKind = 'cash' | 'capacity';
export interface Lane { id: string; label: string; kind: LaneKind; value: number; detail: string }

export interface RoiScenario {
  people: number;
  lanes: Lane[];
  cash: number;
  capacityGross: number;
  capacitySpent: number;
  capacityNet: number;
  platformCost: number;
  netCash: number;
  /** cash / platform cost, or null when cost is zero. */
  multiple: number | null;
  /** Adoption % at which cash benefit equals platform cost; null if never. */
  breakEvenAdoption: number | null;
  /** Share of lanes resting on assumed (not benchmark/measured) inputs, 0..1. */
  assumedShare: number;
}

const num = (v: unknown) => Math.max(0, Number(v) || 0);
const pct = (v: unknown) => Math.min(1, num(v) / 100);

export function roiScenario(p: RoiInputs, adoptionFactor = 1, basis?: Partial<Record<RoiKey, RoiBasis>>): RoiScenario {
  const participants = num(p.employees);
  const uptake = Math.min(1, pct(p.adoption) * adoptionFactor);
  const people = participants * uptake;
  const rate = num(p.hourlyRate);
  const weeks = num(p.weeks);

  // Lane 1
  const extHours = num(p.externalHours) * uptake;
  const coveredHours = extHours * pct(p.internalCoverage);
  const l1cash = coveredHours * num(p.externalRate);
  const l1spent = coveredHours * num(p.internalAnswerHours) * rate;
  // Lane 2
  const l2cash = people * num(p.trainingCost) * pct(p.trainingAvoidance);
  const l2cap = people * num(p.trainingHours) * pct(p.trainingAvoidance) * rate;
  // Lane 3
  const l3cash = num(p.lapsesPerYear) * uptake * num(p.lapseCost) * pct(p.lapseAvoidance);
  // Lane 4
  const l4cap = num(p.leads) * uptake * (num(p.searchMinutes) / 60) * weeks * pct(p.realization) * rate;
  // Costs
  const platformCost = num(p.annualCost);
  const upkeep = people * (num(p.upkeepMinutes) / 60) * 4 * rate;
  const admin = num(p.adminHours) * rate;

  const lanes: Lane[] = [
    { id: 'expertise-cash', label: 'Outside expertise avoided', kind: 'cash', value: l1cash, detail: `${Math.round(coveredHours)} h now answered internally × $${num(p.externalRate)}/h` },
    { id: 'expertise-spent', label: 'Internal time spent answering instead', kind: 'capacity', value: -l1spent, detail: `${Math.round(coveredHours * num(p.internalAnswerHours))} h of internal experts' time` },
    { id: 'training-cash', label: 'Duplicate training not bought', kind: 'cash', value: l2cash, detail: `${Math.round(people)} people × $${num(p.trainingCost)} × ${num(p.trainingAvoidance)}%` },
    { id: 'training-cap', label: 'Training hours not sat through', kind: 'capacity', value: l2cap, detail: `${Math.round(people * num(p.trainingHours) * pct(p.trainingAvoidance))} h` },
    { id: 'lapse-cash', label: 'Credential lapses avoided', kind: 'cash', value: l3cash, detail: `${(num(p.lapsesPerYear) * uptake * pct(p.lapseAvoidance)).toFixed(1)} lapses × $${num(p.lapseCost)}` },
    { id: 'search-cap', label: 'Time not spent finding who knows what', kind: 'capacity', value: l4cap, detail: `${Math.round(num(p.leads) * uptake)} leads × ${num(p.searchMinutes)} min/wk × ${weeks} wk × ${num(p.realization)}% usable` },
    { id: 'upkeep-spent', label: 'Profile upkeep', kind: 'capacity', value: -upkeep, detail: `${Math.round(people)} people × ${num(p.upkeepMinutes)} min/quarter` },
    { id: 'admin-spent', label: 'Program administration', kind: 'capacity', value: -admin, detail: `${num(p.adminHours)} h/year` },
  ];
  const cash = l1cash + l2cash + l3cash;
  const capacityGross = l2cap + l4cap;
  const capacitySpent = l1spent + upkeep + admin;

  // Break-even: cash is linear in uptake (all three cash lanes scale with it), so solve directly.
  const cashAtFullUptake = uptake > 0 ? cash / uptake : 0;
  const breakEvenAdoption = platformCost === 0 ? 0 : cashAtFullUptake > 0 && platformCost / cashAtFullUptake <= 1 ? (platformCost / cashAtFullUptake) * 100 : null;

  const keys = Object.keys(ROI_DEFAULTS) as RoiKey[];
  const assumed = keys.filter((k) => (basis?.[k] ?? 'assumed') === 'assumed').length;

  return {
    people, lanes, cash, capacityGross, capacitySpent, capacityNet: capacityGross - capacitySpent, platformCost,
    netCash: cash - platformCost, multiple: platformCost > 0 ? cash / platformCost : null, breakEvenAdoption,
    assumedShare: keys.length ? assumed / keys.length : 0,
  };
}

export interface RoiField { label: string; unit: '$' | '%' | 'people' | 'hours' | 'minutes' | 'weeks' | 'count'; lane: string; hint: string }
export const ROI_FIELDS: Readonly<Record<RoiKey, RoiField>> = {
  employees: { label: 'People in the pilot', unit: 'people', lane: 'Scope', hint: 'Headcount offered Shellback.' },
  adoption: { label: 'Adoption', unit: '%', lane: 'Scope', hint: 'Share who confirm a profile and keep it current. Measure it from the pilot; do not assume.' },
  hourlyRate: { label: 'Loaded hourly rate', unit: '$', lane: 'Scope', hint: 'Salary + benefits + overhead per hour. Use the program office figure.' },
  weeks: { label: 'Working weeks per year', unit: 'weeks', lane: 'Scope', hint: '' },
  externalHours: { label: 'Outside expert / contractor hours bought per year', unit: 'hours', lane: 'Outside expertise', hint: 'Hours paid for questions an internal person could have answered. From contract records.' },
  externalRate: { label: 'Outside expert rate', unit: '$', lane: 'Outside expertise', hint: 'Fully burdened $/hour on those contracts.' },
  internalCoverage: { label: 'Share now answered internally', unit: '%', lane: 'Outside expertise', hint: 'Of those hours, how many Shellback reveals an internal expert for.' },
  internalAnswerHours: { label: 'Internal hours per avoided external hour', unit: 'hours', lane: 'Outside expertise', hint: 'An internal expert still spends time; 1.0–1.5 is typical. This is subtracted as capacity spent.' },
  trainingCost: { label: 'Training spend per person per year', unit: '$', lane: 'Training', hint: 'Courses, travel, vendor fees. Exclude labor (counted as hours below).' },
  trainingAvoidance: { label: 'Share avoidable (already held / covered by a mentor)', unit: '%', lane: 'Training', hint: 'Sent to a course for a skill they already confirmed, or that a teammate could teach.' },
  trainingHours: { label: 'Training hours per person per year', unit: 'hours', lane: 'Training', hint: 'Seat time. Avoided hours are capacity, not cash.' },
  lapsesPerYear: { label: 'Credential lapses per year (pilot population)', unit: 'count', lane: 'Credentials', hint: 'Expirations that forced requalification, lost work authorization or downtime.' },
  lapseCost: { label: 'Cost of one lapse', unit: '$', lane: 'Credentials', hint: 'Requalification fees + idle time + rework. Use a real example.' },
  lapseAvoidance: { label: 'Share avoided with reminders', unit: '%', lane: 'Credentials', hint: 'Renewal horizon is visible to the person months ahead.' },
  leads: { label: 'Leads / supervisors in scope', unit: 'people', lane: 'Finding people', hint: 'People who staff work and ask around for who knows what.' },
  searchMinutes: { label: 'Minutes per lead per week spent asking around', unit: 'minutes', lane: 'Finding people', hint: 'Measure with a two-week diary; do not guess high.' },
  realization: { label: 'Usable share of that time', unit: '%', lane: 'Finding people', hint: 'Recovered minutes rarely become productive hours one for one.' },
  annualCost: { label: 'Platform cost per year', unit: '$', lane: 'Costs', hint: 'Hosting, support, accreditation upkeep. Shellback itself is a static site; most of this is people.' },
  upkeepMinutes: { label: 'Profile upkeep per person per quarter', unit: 'minutes', lane: 'Costs', hint: 'Time employees spend keeping their profile honest. Counted against capacity.' },
  adminHours: { label: 'Program admin hours per year', unit: 'hours', lane: 'Costs', hint: 'Taxonomy curation, onboarding, answering questions.' },
};
export const ROI_LANES = ['Scope', 'Outside expertise', 'Training', 'Credentials', 'Finding people', 'Costs'] as const;
export const ROI_BASIS_LABEL: Record<RoiBasis, string> = { assumed: 'Assumed', benchmark: 'Benchmark', measured: 'Measured' };
