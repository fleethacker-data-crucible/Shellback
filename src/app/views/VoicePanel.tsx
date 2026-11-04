import { useState } from 'react';
import { useStore } from '../state/store';
import { skillsSummaryText } from '../../core/skills-summary';
import { speakText, startDictation, stopSpeaking, type Dictation } from '../lib/speech';
import { Button, Checkbox, Notice, Panel, PanelHeading, Textarea } from '../components/ui/primitives';

const SPEAK_MESSAGE = {
  unsupported: 'This browser has no speech output, so the summary stays on screen.',
  'no-local-voice': 'No voice is installed on this computer, so nothing is spoken. The summary is on screen.',
};

export function VoicePanel() {
  const { ws } = useStore();
  const summary = skillsSummaryText(ws);
  const [spoken, setSpoken] = useState('');
  const [allowDictation, setAllowDictation] = useState(false);
  const [note, setNote] = useState('');
  const [listening, setListening] = useState(false);
  const [dictation, setDictation] = useState<Dictation | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  function read() {
    const r = speakText(summary);
    setSpoken(r.ok ? 'Reading the summary aloud. Use Stop to end it.' : SPEAK_MESSAGE[r.reason]);
  }

  function listen() {
    const d = startDictation((t) => setNote((n) => (n ? `${n} ${t}` : t)), () => setListening(false));
    if (!d) { setUnsupported(true); return; }
    setDictation(d);
    setListening(true);
    d.start();
  }

  return (
    <Panel id="voicePanel">
      <PanelHeading eyebrow="VOICE" title="Hear your summary, or dictate a note">
        Both work offline where this computer has the voices. Nothing is saved from a note; copy it where you need it.
      </PanelHeading>
      <p id="voiceSummary" className="text-[14px]">{summary}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button id="voiceRead" size="sm" onClick={read}>Read my summary aloud</Button>
        <Button id="voiceStop" size="sm" variant="ghost" onClick={() => { stopSpeaking(); setSpoken(''); }}>Stop</Button>
      </div>
      {spoken && <p id="voiceStatus" role="status" className="note mt-2">{spoken}</p>}

      <div className="mt-5 space-y-2">
        <Checkbox id="dictateAllow" checked={allowDictation} onChange={setAllowDictation}>
          Allow dictation through this browser’s speech service
        </Checkbox>
        <p className="note">Chrome and Edge may send the audio to their speech service to recognise it. Leave this off to type the note instead.</p>
        <div className="flex flex-wrap gap-2">
          <Button id="dictateStart" size="sm" disabled={!allowDictation || listening} onClick={listen}>{listening ? 'Listening…' : 'Dictate a skills note'}</Button>
          {listening && <Button id="dictateStop" size="sm" variant="ghost" onClick={() => { dictation?.stop(); setListening(false); }}>Stop listening</Button>}
        </div>
        {unsupported && <Notice className="mt-2">This browser cannot dictate here. Type the note in the box below.</Notice>}
        <label htmlFor="skillsNote" className="block text-[13px] font-bold">Skills note</label>
        <Textarea id="skillsNote" value={note} onChange={setNote} rows={3} placeholder="Type, or dictate when allowed" />
      </div>
    </Panel>
  );
}

