'use client';
/* eslint-disable react-hooks/set-state-in-effect -- task presentation must sync timer/editor state */

import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { RoomEvent } from 'livekit-client';

const SUPPORTED_LANGUAGES = [
  { label: 'Python', value: 'python', ext: '.py' },
  { label: 'JavaScript', value: 'javascript', ext: '.js' },
  { label: 'TypeScript', value: 'typescript', ext: '.ts' },
  { label: 'Go', value: 'go', ext: '.go' },
  { label: 'Java', value: 'java', ext: '.java' },
  { label: 'C++', value: 'cpp', ext: '.cpp' },
  { label: 'Rust', value: 'rust', ext: '.rs' },
  { label: 'SQL', value: 'sql', ext: '.sql' },
];

const DEFAULT_SNIPPETS = {
  python: '# You can type or paste code here.\n# The AI interviewer can inspect your editor anytime you ask!\n\ndef solution():\n    pass\n',
  javascript: '// You can type or paste code here.\n// The AI interviewer can inspect your editor anytime you ask!\n\nfunction solution() {\n    \n}\n',
  typescript: '// TypeScript coding workspace\n\nfunction solution(): void {\n    \n}\n',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Ready")\n}\n',
  java: 'public class Solution {\n    public static void main(String[] args) {\n        \n    }\n}\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    return 0;\n}\n',
  rust: 'fn main() {\n    println!("Ready");\n}\n',
  sql: '-- Write your SQL query here\nSELECT * FROM candidates;\n',
};

export default function MonacoCodeEditor({
  room,
  activeTask,
  onTaskRejected,
  onCodeChange,
}) {
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(DEFAULT_SNIPPETS.python);
  const [syncStatus, setSyncStatus] = useState('synced');
  const [submittedBanner, setSubmittedBanner] = useState(false);
  const [showTests, setShowTests] = useState(true);
  const [selfCheck, setSelfCheck] = useState('');
  // Voice-first co-editing: agent patches + line highlights (no countdown anywhere)
  const [patchNotice, setPatchNotice] = useState(null);
  const [highlightNotice, setHighlightNotice] = useState(null);

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const syncTimeoutRef = useRef(null);
  const codeRef = useRef(code);
  const langRef = useRef(language);
  const taskRef = useRef(activeTask);
  const submittedRef = useRef(false);
  const prevCodeForUndoRef = useRef(null);
  const decorationsRef = useRef([]);
  const patchNoticeTimeoutRef = useRef(null);
  const highlightTimeoutRef = useRef(null);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);
  useEffect(() => {
    langRef.current = language;
  }, [language]);
  useEffect(() => {
    taskRef.current = activeTask;
  }, [activeTask]);

  const publishData = async (topic, payload) => {
    if (!room?.localParticipant) return false;
    try {
      const encoder = new TextEncoder();
      await room.localParticipant.publishData(encoder.encode(JSON.stringify(payload)), {
        reliable: true,
        topic,
      });
      return true;
    } catch (err) {
      console.warn(`[Monaco] Failed to publish ${topic}:`, err);
      return false;
    }
  };

  const publishCodeSync = async (codeToSync, currentLang, opts = {}) => {
    const ok = await publishData('code_sync', {
      type: 'code_sync',
      code: codeToSync,
      language: currentLang,
      taskId: taskRef.current?.taskId || null,
      timestamp: Date.now(),
      ...opts,
    });
    return ok;
  };

  // When agent presents a new coding task (no countdown — pacing is agent-side only)
  useEffect(() => {
    if (!activeTask) {
      setSubmittedBanner(false);
      setPatchNotice(null);
      setHighlightNotice(null);
      submittedRef.current = false;
      prevCodeForUndoRef.current = null;
      return;
    }

    submittedRef.current = false;
    setSubmittedBanner(false);
    setPatchNotice(null);
    setHighlightNotice(null);
    setSelfCheck('');
    prevCodeForUndoRef.current = null;

    if (activeTask.language) {
      setLanguage(activeTask.language);
      langRef.current = activeTask.language;
    }
    if (typeof activeTask.starterCode === 'string') {
      setCode(activeTask.starterCode);
      codeRef.current = activeTask.starterCode;
      // Seed the agent buffer immediately so grab_candidate_code never sees stale code
      publishCodeSync(activeTask.starterCode, activeTask.language || langRef.current, {
        taskId: activeTask.taskId,
        seed: true,
      });
      if (onCodeChange) onCodeChange(activeTask.starterCode, activeTask.language || langRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTask?.taskId]);

  // Debounced code sync over LiveKit data channel
  const handleEditorChange = (value) => {
    const newCode = value ?? '';
    setCode(newCode);
    codeRef.current = newCode;
    setSyncStatus(room?.localParticipant ? 'typing' : 'offline');
    if (onCodeChange) onCodeChange(newCode, langRef.current);

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(async () => {
      const ok = await publishCodeSync(newCode, langRef.current);
      setSyncStatus(ok ? 'synced' : 'offline');
    }, 350);
  };

  // Flush pending sync on unmount
  useEffect(() => () => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    if (patchNoticeTimeoutRef.current) clearTimeout(patchNoticeTimeoutRef.current);
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
  }, []);

  // Apply an agent line-patch to the current buffer (1-indexed, inclusive)
  const applyRemotePatch = (startLine, endLine, newText) => {
    const lines = (codeRef.current || '').split('');
    const all = (codeRef.current || '').split('\n');
    const total = all.length;
    const s = Math.max(1, Math.min(Number(startLine) || 1, total + 1));
    const e = Math.max(s, Math.min(Number(endLine) || s, Math.max(total, s)));
    const fresh = String(newText ?? '').split('\n');
    const merged = [...all.slice(0, s - 1), ...fresh, ...all.slice(e, total)];
    void lines;
    return { merged: merged.join('\n'), s, e };
  };

  // Listen for agent live-edits + highlights on the code_task channel
  useEffect(() => {
    if (!room) return undefined;
    // Ask for the current task snapshot (covers page reload mid-challenge)
    publishData('code_action', { type: 'snapshot_request', timestamp: Date.now() });

    const onData = (payload, _participant, _kind, topic) => {
      if (topic !== 'code_task') return;
      let msg;
      try {
        msg = JSON.parse(new TextDecoder().decode(payload));
      } catch {
        return;
      }
      const currentTaskId = taskRef.current?.taskId;
      if (msg.type === 'code_patch') {
        // Ignore patches for stale tasks
        if (currentTaskId && msg.taskId && msg.taskId !== currentTaskId) return;
        prevCodeForUndoRef.current = codeRef.current;
        const { merged, s, e } = applyRemotePatch(msg.startLine, msg.endLine, msg.newText ?? '');
        codeRef.current = merged;
        setCode(merged);
        if (onCodeChange) onCodeChange(merged, langRef.current);
        publishCodeSync(merged, langRef.current, { patchAck: msg.patchId || null });
        setSyncStatus('synced');
        // Flash the edited range in the editor
        try {
          const editor = editorRef.current;
          const monaco = monacoRef.current;
          if (editor && monaco) {
            decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [{
              range: new monaco.Range(s, 1, Math.max(s, e), 1),
              options: { isWholeLine: true, className: 'monaco-agent-patch-flash' },
            }]);
            editor.revealLineInCenter(s);
            setTimeout(() => {
              try { decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []); } catch { /* noop */ }
            }, 6000);
          }
        } catch { /* highlight is best-effort */ }
        setPatchNotice({
          text: `Interviewer updated lines ${s}–${e}${msg.reason ? ` — ${msg.reason}` : ''}`,
          canUndo: true,
        });
        if (patchNoticeTimeoutRef.current) clearTimeout(patchNoticeTimeoutRef.current);
        patchNoticeTimeoutRef.current = setTimeout(() => setPatchNotice(null), 12000);
      } else if (msg.type === 'code_highlight') {
        if (currentTaskId && msg.taskId && msg.taskId !== currentTaskId) return;
        const s = Number(msg.startLine) || 1;
        const e = Number(msg.endLine) || s;
        try {
          const editor = editorRef.current;
          const monaco = monacoRef.current;
          if (editor && monaco) {
            decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [{
              range: new monaco.Range(s, 1, e, 1),
              options: { isWholeLine: true, className: 'monaco-agent-patch-flash' },
            }]);
            editor.revealLineInCenter(s);
            setTimeout(() => {
              try { decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []); } catch { /* noop */ }
            }, 6000);
          }
        } catch { /* best-effort */ }
        setHighlightNotice(msg.message ? `Interviewer is pointing at lines ${s}–${e}: ${msg.message}` : `Interviewer highlighted lines ${s}–${e}`);
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = setTimeout(() => setHighlightNotice(null), 10000);
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      try { room.off(RoomEvent.DataReceived, onData); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  // Language switch (locked to task language while a challenge is active)
  const handleLanguageChange = (newLang) => {
    if (taskRef.current) return; // locked during active task — prevents agent/code mismatch
    setLanguage(newLang);
    langRef.current = newLang;
    const prevDefault = DEFAULT_SNIPPETS[language];
    if (codeRef.current.trim() === prevDefault?.trim()) {
      const nextSnippet = DEFAULT_SNIPPETS[newLang] || '';
      setCode(nextSnippet);
      codeRef.current = nextSnippet;
      publishCodeSync(nextSnippet, newLang);
    } else {
      publishCodeSync(codeRef.current, newLang);
    }
    if (onCodeChange) onCodeChange(codeRef.current, newLang);
  };

  // Reject / Skip task button
  const handleRejectTask = async () => {
    if (!taskRef.current) return;
    const task = taskRef.current;

    await publishData('code_action', {
      type: 'task_rejected',
      taskId: task.taskId,
      reason: 'Candidate clicked Reject / Skip Task',
    });

    if (onTaskRejected) onTaskRejected(task);
  };

  // Clear / Reset code in editor (resets to task starter when active)
  const handleClearEditor = () => {
    const fresh = taskRef.current?.starterCode ?? DEFAULT_SNIPPETS[langRef.current] ?? '';
    setCode(fresh);
    codeRef.current = fresh;
    publishCodeSync(fresh, langRef.current);
    if (onCodeChange) onCodeChange(fresh, langRef.current);
  };

  // Lightweight client-side self-check (no execution): syntax sanity + starter-diff
  const handleSelfCheck = () => {
    const cur = codeRef.current || '';
    const starter = taskRef.current?.starterCode || '';
    if (!cur.trim()) {
      setSelfCheck('Editor is empty — write something before submitting.');
      return;
    }
    if (starter && cur.trim() === starter.trim()) {
      setSelfCheck('Still matches the starter template — no changes detected yet.');
      return;
    }
    const lang = langRef.current;
    if (lang === 'python') {
      const lines = cur.split('\n');
      const badIndent = lines.some((l) => /\t/.test(l) && / {2,}/.test(l));
      if (badIndent) {
        setSelfCheck('Mixed tabs/spaces detected — normalize indentation.');
        return;
      }
    }
    if (lang === 'javascript' || lang === 'typescript') {
      const open = (cur.match(/{/g) || []).length - (cur.match(/}/g) || []).length;
      if (open !== 0) {
        setSelfCheck(`Braces look unbalanced (diff ${open}). Check for a missing } or extra {.`);
        return;
      }
    }
    const hasFunc = /(def |function |=>|SELECT|class )/i.test(cur);
    setSelfCheck(
      hasFunc
        ? `Looks submittable: ${cur.split('\n').length} lines, differs from starter. Hit Submit when ready.`
        : 'No function/query structure detected yet — make sure you implemented the required signature.',
    );
  };

  // Request a progressive hint from the agent (voice + no solution reveal)
  const handleRequestHint = async () => {
    if (!taskRef.current) return;
    setSelfCheck('Hint requested — the interviewer will guide you with the next step (no direct answer).');
    await publishData('code_action', {
      type: 'hint_requested',
      taskId: taskRef.current.taskId,
      code: codeRef.current,
      language: langRef.current,
      timestamp: Date.now(),
    });
  };

  // Voice-first submit: button is fallback, saying "I'm done" is primary.
  // No countdown anywhere — the agent paces invisibly and wraps up kindly.
  const submitCode = async (reason = 'manual') => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    const snapshot = codeRef.current;
    const snapLang = langRef.current;

    // 2. Publish final code snapshot (reliable, awaited)
    await publishCodeSync(snapshot, snapLang, { final: true });

    // 3. Notify agent over LiveKit data channel
    await publishData('code_action', {
      type: 'code_submitted',
      taskId: taskRef.current?.taskId || '',
      code: snapshot,
      language: snapLang,
      submitReason: reason,
      timestamp: Date.now(),
    });

    setSubmittedBanner(true);
    setTimeout(() => {
      setSubmittedBanner(false);
      // Dismiss active task challenge banner after submission
      if (taskRef.current && onTaskRejected) {
        onTaskRejected(taskRef.current);
      }
    }, 2200);
  };

  const handleManualSubmit = () => submitCode('manual');

  // Undo the most recent agent edit (keeps co-editing safe)
  const handleUndoPatch = async () => {
    if (prevCodeForUndoRef.current === null) return;
    const prev = prevCodeForUndoRef.current;
    prevCodeForUndoRef.current = null;
    codeRef.current = prev;
    setCode(prev);
    if (onCodeChange) onCodeChange(prev, langRef.current);
    await publishCodeSync(prev, langRef.current, { undoPatch: true });
    setPatchNotice({ text: 'Undid the interviewer edit — your version is restored.', canUndo: false });
    if (patchNoticeTimeoutRef.current) clearTimeout(patchNoticeTimeoutRef.current);
    patchNoticeTimeoutRef.current = setTimeout(() => setPatchNotice(null), 6000);
  };

  const difficultyLabel = { 1: 'Warm-up', 2: 'Core', 3: 'Stretch' };
  const testCases = Array.isArray(activeTask?.testCases) ? activeTask.testCases : [];

  return (
    <div className="monaco-wrapper">
      {/* Active Task Challenge Banner */}
      {activeTask && (
        <div className="monaco-task-banner">
          <div className="monaco-task-top">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className={`monaco-mode-pill is-${activeTask.mode}`}>
                {activeTask.mode === 'fix_bug' ? 'Debug & Fix' : 'Code Challenge'}
              </span>
              {activeTask.skill && activeTask.skill !== 'general' && (
                <span className="monaco-mode-pill" style={{ background: '#eef2ff', color: '#4338ca' }} title="Skill area">
                  {activeTask.skill.toUpperCase()}
                </span>
              )}
              {activeTask.difficulty && (
                <span className="monaco-mode-pill" style={{ background: '#f0fdf4', color: '#15803d' }} title="Difficulty">
                  {difficultyLabel[activeTask.difficulty] || `L${activeTask.difficulty}`}
                </span>
              )}
              <h3 className="monaco-task-title">{activeTask.title}</h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="monaco-sync-indicator" title="No rush — work at your pace and talk through your thinking" style={{ border: '1px solid #e2e8f0', borderRadius: '999px', padding: '4px 10px' }}>
                <span className="monaco-sync-dot is-synced" />
                <span className="monaco-sync-text">Take your time — say “I’m done” when ready</span>
              </span>

              <button
                type="button"
                className="monaco-btn-reject"
                onClick={handleRejectTask}
                title="Decline this coding challenge and ask for a different topic (or just say 'skip')"
              >
                ✕ Reject / Skip
              </button>
            </div>
          </div>

          {activeTask.description && (
            <p className="monaco-task-desc" style={{ whiteSpace: 'pre-wrap' }}>{activeTask.description}</p>
          )}

          {testCases.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <button
                type="button"
                className="monaco-btn-clear"
                onClick={() => setShowTests((s) => !s)}
                title="Toggle visible test cases"
              >
                {showTests ? '▾ Hide tests' : '▸ Show tests'} ({testCases.length})
                {typeof activeTask.hintsTotal === 'number' && activeTask.hintsTotal > 0 ? ` · ${activeTask.hintsTotal} hints available` : ''}
              </button>
              {showTests && (
                <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '0.82rem', color: '#334155' }}>
                  {testCases.map((t, i) => (
                    <li key={i} style={{ marginBottom: '4px' }}>
                      <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '6px' }}>{t.input}</code>
                      {' → '}
                      <strong>{t.expected}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Editor Control Toolbar */}
      <div className="monaco-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="monaco-lang-select" className="monaco-label">
            Language{activeTask ? ' (locked)' : ''}:
          </label>
          <select
            id="monaco-lang-select"
            className="monaco-lang-select"
            value={language}
            disabled={!!activeTask}
            onChange={(e) => handleLanguageChange(e.target.value)}
            title={activeTask ? 'Language is locked to the active challenge to keep you and the interviewer in sync' : 'Choose editor language'}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>

          <span className="monaco-sync-indicator" title={room?.localParticipant ? 'Code is continuously synced with the AI interviewer' : 'Voice room not connected — code will still be saved on End Interview'}>
            <span className={`monaco-sync-dot is-${syncStatus}`} />
            <span className="monaco-sync-text">
              {syncStatus === 'typing' ? 'Syncing…' : syncStatus === 'offline' ? 'Offline — saved locally' : 'Live with Interviewer'}
            </span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {activeTask && (
            <button
              type="button"
              className="monaco-btn-clear"
              onClick={handleRequestHint}
              title="Ask the interviewer for the next progressive hint (no direct answer)"
            >
              💡 Hint
            </button>
          )}
          <button
            type="button"
            className="monaco-btn-clear"
            onClick={handleSelfCheck}
            title="Run a quick local sanity check before submitting"
          >
            Self-check
          </button>
          <button
            type="button"
            className="monaco-btn-clear"
            onClick={handleClearEditor}
            title={activeTask ? 'Reset editor back to the challenge starter code' : 'Clear editor and start with a fresh template'}
          >
            {activeTask ? 'Reset to starter' : 'Clear Code'}
          </button>

          <button
            type="button"
            className="monaco-btn-submit"
            onClick={handleManualSubmit}
            title="Submit your code (or just say 'I'm done' — voice is primary)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>I&apos;m Done (Submit)</span>
          </button>
        </div>
      </div>

      {selfCheck && (
        <div className="monaco-submit-toast" style={{ background: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0' }}>
          {selfCheck}
        </div>
      )}

      {/* Submission Success Alert */}
      {submittedBanner && (
        <div className="monaco-submit-toast">
          ✓ Code submitted to interviewer! Reviewing your solution now…
        </div>
      )}
      {patchNotice && (
        <div className="monaco-submit-toast" style={{ background: '#eef2ff', color: '#3730a3', border: '1px solid #c7d2fe', display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>✏️ {patchNotice.text}</span>
          {patchNotice.canUndo && (
            <button type="button" className="monaco-btn-clear" onClick={handleUndoPatch} title="Restore your code from before the interviewer edit">
              Undo
            </button>
          )}
        </div>
      )}
      {highlightNotice && (
        <div className="monaco-submit-toast" style={{ background: '#fefce8', color: '#854d0e', border: '1px solid #fde68a' }}>
          🔦 {highlightNotice}
        </div>
      )}

      {/* Monaco Editor Container */}
      <div className="monaco-editor-frame">
        <Editor
          height="100%"
          language={language}
          value={code}
          theme="vs-light"
          onChange={handleEditorChange}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            monacoRef.current = monaco;
          }}
          options={{
            fontSize: 13.5,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace",
            lineNumbers: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            wordWrap: 'on',
            lineDecorationsWidth: 8,
            lineNumbersMinChars: 3,
            renderLineHighlight: 'all',
            padding: { top: 10, bottom: 10 },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
          }}
          loading={
            <div className="monaco-loading-placeholder">
              <div className="iv-pulse-loader" />
              <span>Initializing Monaco Editor…</span>
            </div>
          }
        />
      </div>
    </div>
  );
}
