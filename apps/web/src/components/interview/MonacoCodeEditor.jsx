'use client';

import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';

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
  const [timeLeft, setTimeLeft] = useState(null);
  const [syncStatus, setSyncStatus] = useState('synced');
  const [submittedBanner, setSubmittedBanner] = useState(false);

  const editorRef = useRef(null);
  const syncTimeoutRef = useRef(null);
  const timerRef = useRef(null);

  // When agent presents a new coding task
  useEffect(() => {
    if (!activeTask) {
      setTimeLeft(null);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (activeTask.language) {
      setLanguage(activeTask.language);
    }
    if (activeTask.starterCode) {
      setCode(activeTask.starterCode);
    }

    if (activeTask.timeLimitSec) {
      setTimeLeft(activeTask.timeLimitSec);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTask]);

  // Debounced code sync over LiveKit data channel
  const handleEditorChange = (value) => {
    const newCode = value ?? '';
    setCode(newCode);
    setSyncStatus('typing');
    if (onCodeChange) onCodeChange(newCode, language);

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      publishCodeSync(newCode, language);
      setSyncStatus('synced');
    }, 350);
  };

  const publishCodeSync = async (codeToSync, currentLang) => {
    if (!room || !room.localParticipant) return;
    try {
      const payload = {
        type: 'code_sync',
        code: codeToSync,
        language: currentLang,
        timestamp: Date.now(),
      };
      const encoder = new TextEncoder();
      await room.localParticipant.publishData(encoder.encode(JSON.stringify(payload)), {
        reliable: true,
        topic: 'code_sync',
      });
    } catch (err) {
      console.warn('[Monaco] Failed to publish code sync:', err);
    }
  };

  // Language switch
  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    // If editor has default snippet of previous lang, swap to new default
    const prevDefault = DEFAULT_SNIPPETS[language];
    if (!activeTask && code.trim() === prevDefault?.trim()) {
      const nextSnippet = DEFAULT_SNIPPETS[newLang] || '';
      setCode(nextSnippet);
      publishCodeSync(nextSnippet, newLang);
    } else {
      publishCodeSync(code, newLang);
    }
    if (onCodeChange) onCodeChange(code, newLang);
  };

  // Reject / Skip task button
  const handleRejectTask = async () => {
    if (!activeTask) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(null);

    if (room && room.localParticipant) {
      try {
        const payload = {
          type: 'task_rejected',
          taskId: activeTask.taskId,
          reason: 'Candidate clicked Reject / Skip Task',
        };
        const encoder = new TextEncoder();
        await room.localParticipant.publishData(encoder.encode(JSON.stringify(payload)), {
          reliable: true,
          topic: 'code_action',
        });
      } catch (err) {
        console.warn('[Monaco] Failed to publish task rejection:', err);
      }
    }

    if (onTaskRejected) onTaskRejected(activeTask);
  };

  // Manual "I'm Done" submit trigger
  const handleManualSubmit = () => {
    publishCodeSync(code, language);
    setSubmittedBanner(true);
    setTimeout(() => setSubmittedBanner(false), 4000);
  };

  const formatTimer = (sec) => {
    if (sec === null) return '';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const timerColor =
    timeLeft === null
      ? '#2563eb'
      : timeLeft <= 30
      ? '#dc2626'
      : timeLeft <= 60
      ? '#d97706'
      : '#2563eb';

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
              <h3 className="monaco-task-title">{activeTask.title}</h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {timeLeft !== null && (
                <div
                  className="monaco-timer-badge"
                  style={{ color: timerColor, borderColor: `${timerColor}40` }}
                  title="Challenge countdown timer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>{formatTimer(timeLeft)}</span>
                </div>
              )}

              <button
                type="button"
                className="monaco-btn-reject"
                onClick={handleRejectTask}
                title="Decline this coding challenge and ask for a different topic"
              >
                ✕ Reject / Skip
              </button>
            </div>
          </div>

          {activeTask.description && (
            <p className="monaco-task-desc">{activeTask.description}</p>
          )}
        </div>
      )}

      {/* Editor Control Toolbar */}
      <div className="monaco-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="monaco-lang-select" className="monaco-label">
            Language:
          </label>
          <select
            id="monaco-lang-select"
            className="monaco-lang-select"
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>

          <span className="monaco-sync-indicator" title="Code is continuously synced with the AI interviewer">
            <span className={`monaco-sync-dot is-${syncStatus}`} />
            <span className="monaco-sync-text">
              {syncStatus === 'typing' ? 'Syncing…' : 'Live with Interviewer'}
            </span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="monaco-btn-submit"
            onClick={handleManualSubmit}
            title="Send your code and notify the interviewer"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>I'm Done (Submit)</span>
          </button>
        </div>
      </div>

      {/* Submission Success Alert */}
      {submittedBanner && (
        <div className="monaco-submit-toast">
          ✓ Code synchronized with interviewer! Say <em>"I'm done with the solution"</em> or explain your approach aloud.
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
          onMount={(editor) => {
            editorRef.current = editor;
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
