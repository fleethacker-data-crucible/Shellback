/**
 * Program → Intelligence → Evaluation set. Runs the active provider over the built-in synthetic gold
 * résumés and shows how closely its suggestions match the expected ones. The scores describe the
 * provider on fictional text; nothing about a person is computed or stored.
 */
import { useState } from 'react';
import { BUILTIN_GOLD_SET } from '../../core/evaluation-data';
import { evaluateProvider, type EvaluationReport } from '../../core/evaluation';
import { skillName } from '../../core/taxonomy';
import { activeProvider } from '../../storage/intel-settings';
import { useDialogs } from '../components/ui/dialogs';
import { Button, Notice, Panel, PanelHeading, Pill } from '../components/ui/primitives';

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function EvaluationPanel() {
  const dialogs = useDialogs();
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const info = activeProvider().describe();

  async function run() {
    if (!info.offline) {
      const ok = await dialogs.confirm(<>The {BUILTIN_GOLD_SET.cases.length} synthetic résumé snippets in the evaluation set will be sent to <b>{info.origin}</b> through <b>{info.label}</b>. They are fictional and contain nothing about you. Run it?</>, { title: 'Send the evaluation set?', confirmLabel: 'Run evaluation' });
      if (!ok) return;
    }
    setBusy(true);
    try { setReport(await evaluateProvider(activeProvider(), BUILTIN_GOLD_SET.cases, (d, t) => setProgress(`${d} of ${t}`))); }
    finally { setBusy(false); setProgress(''); }
  }

  return (
    <Panel id="intelEvaluation">
      <PanelHeading eyebrow="EVALUATION SET" title={<>Provider quality check <Pill tone={info.offline ? 'mint' : 'amber'}>{info.label}</Pill></>}
        action={<Button id="evalRun" variant="primary" size="sm" disabled={busy} onClick={run}>{busy ? `Running… ${progress}` : report ? 'Run again' : 'Run the evaluation set'}</Button>}>
        {BUILTIN_GOLD_SET.cases.length} fictional résumé snippets with the skills and credentials a careful reader would expect. Use it to compare a new provider with Local rules before relying on it. The scores describe the provider, not any person.
      </PanelHeading>
      {report && (
        <div id="evalResult" className="space-y-3">
          <dl className="grid grid-cols-2 gap-3 text-[13px] md:grid-cols-4">
            <div><dt className="text-quiet">Skills precision</dt><dd id="evalSkillsPrecision" className="text-[20px] font-bold">{pct(report.micro.skills.precision)}</dd></div>
            <div><dt className="text-quiet">Skills recall</dt><dd id="evalSkillsRecall" className="text-[20px] font-bold">{pct(report.micro.skills.recall)}</dd></div>
            <div><dt className="text-quiet">Credentials precision</dt><dd className="text-[20px] font-bold">{pct(report.micro.credentials.precision)}</dd></div>
            <div><dt className="text-quiet">Credentials recall</dt><dd className="text-[20px] font-bold">{pct(report.micro.credentials.recall)}</dd></div>
          </dl>
          {report.failed > 0 && <Notice tone="warn">{report.failed} case{report.failed === 1 ? '' : 's'} failed to run and scored zero: {report.cases.find((c) => c.error)?.error}</Notice>}
          <table className="w-full text-[13px]" id="evalTable">
            <thead><tr className="text-left text-[12px] uppercase tracking-wider text-quiet"><th className="py-1 pr-3">Case</th><th className="py-1 pr-3">Skills F1</th><th className="py-1 pr-3">Missed</th><th className="py-1">Extra</th></tr></thead>
            <tbody>
              {report.cases.map((c) => (
                <tr key={c.id} data-case={c.id} className="border-t border-stroke align-top">
                  <td className="py-1 pr-3">{c.title}</td>
                  <td className="py-1 pr-3">{pct(c.skills.f1)}</td>
                  <td className="py-1 pr-3">{c.skills.missed.map(skillName).join(', ') || '—'}</td>
                  <td className="py-1">{c.skills.extra.map(skillName).join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
