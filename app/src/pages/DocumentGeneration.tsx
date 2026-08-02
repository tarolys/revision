import { useEffect, useRef, useState } from "react";
import { TerminalFrame } from "../components/TerminalFrame";
import { TextArea } from "../components/TextArea";
import { PromptInput } from "../components/PromptInput";
import { Button } from "../components/Button";
import {
  getAllTemplates,
  createTemplate,
  updateTemplateSource,
  getFieldDrafts,
  saveFieldDraft,
} from "../lib/db/documents";
import { placeholderLabel, substitutePlaceholders } from "../lib/document/placeholders";
import { renderLatexToPdf } from "../lib/document/compiler";
import type { DocumentTemplate } from "../lib/types";
import styles from "./DocumentGeneration.module.css";

const SAMPLE = `\\documentclass{article}
\\begin{document}
\\section*{[^title^]}
Prepared for [^student_name^] on [^date^].

[^^body^]
\\end{document}`;

const FIELD_SAVE_DELAY_MS = 400;

export function DocumentGeneration() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSource, setNewSource] = useState(SAMPLE);

  const [editSource, setEditSource] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldEditorOpen, setFieldEditorOpen] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [compileLog, setCompileLog] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const fieldSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  async function refreshTemplates() {
    setTemplates(await getAllTemplates());
  }

  useEffect(() => {
    void refreshTemplates();
  }, []);

  const selected = templates.find((t) => t.id === selectedId);

  useEffect(() => {
    if (!selected) return;
    setEditSource(selected.latexSource);
    setPdfUrl(null);
    setCompileLog(null);
    (async () => {
      const drafts = await getFieldDrafts(selected.id);
      const values: Record<string, string> = {};
      drafts.forEach((d) => {
        values[d.fieldName] = d.value;
      });
      setFieldValues(values);
    })();
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    };
  }, []);

  async function onSaveNewTemplate() {
    if (newName.trim().length === 0 || newSource.trim().length === 0) return;
    const template = await createTemplate({ name: newName, latexSource: newSource });
    setCreating(false);
    setNewName("");
    setNewSource(SAMPLE);
    await refreshTemplates();
    setSelectedId(template.id);
  }

  async function onSaveSourceEdit() {
    if (!selected) return;
    const updated = await updateTemplateSource(selected.id, editSource);
    await refreshTemplates();
    const drafts = await getFieldDrafts(updated.id);
    const values: Record<string, string> = {};
    drafts.forEach((d) => {
      values[d.fieldName] = d.value;
    });
    setFieldValues(values);
  }

  function onFieldChange(name: string, value: string) {
    setFieldValues((v) => ({ ...v, [name]: value }));
    if (!selected) return;
    clearTimeout(fieldSaveTimers.current[name]);
    fieldSaveTimers.current[name] = setTimeout(() => {
      void saveFieldDraft(selected.id, name, value);
    }, FIELD_SAVE_DELAY_MS);
  }

  const missingFields = selected?.placeholders.filter((p) => !(fieldValues[p] ?? "").trim()) ?? [];

  async function onGenerate() {
    if (!selected || missingFields.length > 0) return;
    setGenerating(true);
    setCompileLog(null);
    setStatusMessage("loading XeLaTeX engine…");
    try {
      const substituted = substitutePlaceholders(selected.latexSource, fieldValues);
      const result = await renderLatexToPdf(substituted, (p) => setStatusMessage(p.message));
      if (result.pdf.byteLength === 0) {
        setCompileLog(result.log);
        setStatusMessage("compile failed");
      } else {
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        const url = URL.createObjectURL(new Blob([result.pdf], { type: "application/pdf" }));
        pdfUrlRef.current = url;
        setPdfUrl(url);
        setStatusMessage("done");
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
    <TerminalFrame command="generate :doc">
      <div className={styles.layout}>
        <div className={styles.list}>
          {templates.map((t) => (
            <button
              key={t.id}
              className={`${styles.listItem} ${t.id === selectedId ? styles.active : ""}`}
              onClick={() => {
                setCreating(false);
                setSelectedId(t.id);
              }}
            >
              {t.name}
            </button>
          ))}
          <Button variant="ghost" className={styles.newButton} onClick={() => setCreating(true)}>
            new template
          </Button>
        </div>

        <div>
          {creating && (
            <>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="docgen-name">
                  NAME
                </label>
                <PromptInput id="docgen-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Practice exam cover sheet" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="docgen-source">
                  LATEX SOURCE — use [^placeholder_name^] for a single line, [^^placeholder_name^] for a paragraph field
                </label>
                <TextArea id="docgen-source" variant="code" rows={14} value={newSource} onChange={(e) => setNewSource(e.target.value)} />
              </div>
              <div className={styles.sourceActions}>
                <Button variant="ghost" onClick={() => setCreating(false)}>
                  cancel
                </Button>
                <Button variant="primary" onClick={() => void onSaveNewTemplate()}>
                  save template
                </Button>
              </div>
            </>
          )}

          {!creating && !selected && (
            <div className={styles.empty}>select a template on the left, or create a new one.</div>
          )}

          {!creating && selected && (
            <>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="docgen-edit-source">
                  LATEX SOURCE
                </label>
                <TextArea id="docgen-edit-source" variant="code" rows={14} value={editSource} onChange={(e) => setEditSource(e.target.value)} />
                <div className={styles.sourceActions}>
                  <Button variant="ghost" onClick={() => void onSaveSourceEdit()} disabled={editSource === selected.latexSource}>
                    save source changes
                  </Button>
                </div>
              </div>

              {selected.placeholders.length > 0 && (
                <div className={styles.fieldsSummary}>
                  <div className={styles.sectionTitle}>
                    {selected.placeholders.length} field{selected.placeholders.length === 1 ? "" : "s"} detected
                    {missingFields.length > 0 && ` — ${missingFields.length} empty`}
                  </div>
                  <Button variant="ghost" onClick={() => setFieldEditorOpen(true)}>
                    edit fields
                  </Button>
                </div>
              )}

              <div className={styles.generateBar}>
                <Button
                  variant="primary"
                  disabled={generating || selected.placeholders.length === 0 || missingFields.length > 0}
                  onClick={() => void onGenerate()}
                >
                  {generating ? "compiling…" : "generate PDF"}
                </Button>
                {missingFields.length > 0 && (
                  <span className={styles.status}>fill in every field before generating</span>
                )}
                {generating && <span className={styles.status}>{statusMessage}</span>}
                {!generating && pdfUrl && (
                  <a className={styles.downloadLink} href={pdfUrl} download={`${selected.name}.pdf`}>
                    &gt;&gt; download {selected.name}.pdf
                  </a>
                )}
              </div>

              {compileLog && <pre className={styles.log}>{compileLog}</pre>}
            </>
          )}
        </div>
      </div>
    </TerminalFrame>

    {fieldEditorOpen && selected && (
      <div className={styles.fieldEditorOverlay}>
        <TerminalFrame
          command={`edit :fields ${selected.name}`}
          actions={
            <Button variant="primary" onClick={() => setFieldEditorOpen(false)}>
              done
            </Button>
          }
        >
          {selected.placeholders.map((name) => {
            const isParagraph = selected.paragraphFields?.includes(name);
            return (
              <div className={styles.field} key={name}>
                <label className={styles.fieldLabel} htmlFor={`docgen-field-${name}`}>
                  {placeholderLabel(name).toUpperCase()}
                </label>
                {isParagraph ? (
                  <TextArea
                    id={`docgen-field-${name}`}
                    variant="prose"
                    rows={10}
                    value={fieldValues[name] ?? ""}
                    onChange={(e) => onFieldChange(name, e.target.value)}
                    placeholder={`[^^${name}^]`}
                  />
                ) : (
                  <PromptInput
                    id={`docgen-field-${name}`}
                    value={fieldValues[name] ?? ""}
                    onChange={(e) => onFieldChange(name, e.target.value)}
                    placeholder={`[^${name}^]`}
                  />
                )}
              </div>
            );
          })}
        </TerminalFrame>
      </div>
    )}
    </>
  );
}
