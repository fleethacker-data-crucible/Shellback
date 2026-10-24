import { SKILLS } from '../../core/taxonomy';
import type { Option } from '../components/ui/primitives';

export const SKILL_OPTIONS: readonly Option[] = SKILLS.map((s) => ({ value: s.id, label: `${s.name} · ${s.domain}` }));
export const SKILL_OPTIONS_SHORT: readonly Option[] = SKILLS.map((s) => ({ value: s.id, label: s.name }));

export const MODE_LABEL: Record<string, string> = { independent: 'Independent', ai: 'Approved AI-assisted', guided: 'Guided / collaborative', none: 'Not yet performed' };
export const modeLabel = (v: string | undefined): string => MODE_LABEL[v ?? ''] ?? 'Unknown';

export const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
