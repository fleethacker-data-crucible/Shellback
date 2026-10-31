/** The built-in synthetic evaluation set. The JSON under examples/evaluation/ is the single source of truth (imported at build time). */
import gold from '../../examples/evaluation/gold-resumes.json';
import { parseGoldSet, type GoldSet } from './evaluation';

export const BUILTIN_GOLD_SET: GoldSet = parseGoldSet(gold);
