"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Heading1, Heading2, List, ListOrdered, Quote, Code, Link as LinkIcon,
  Eye, Pencil, Download, Pin, PinOff, RefreshCw, Trash2, Loader2, Check, X as XIcon, History, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { markdownToHtml } from "@/lib/ai/utils/formatter";
import {
  useNote,
  useUpdateNote,
  useDeleteNote,
  useRegenerateSummary,
  useFolders,
  useNoteVersions,
  useRestoreVersion,
  downloadNoteExport,
  type ApiFolder,
} from "@/lib/notes/hooks/use-notes";

type SaveStatus = "idle" | "saving" | "saved" | "error";

const TOOLBAR_ACTIONS: {
  icon: typeof Bold;
  label: string;
  wrap?: [string, string];
  linePrefix?: string;
}[] = [
  { icon: Bold, label: "Bold", wrap: ["**", "**"] },
  { icon: Italic, label: "Italic", wrap: ["*", "*"] },
  { icon: Heading1, label: "Heading 1", linePrefix: "# " },
  { icon: Heading2, label: "Heading 2", linePrefix: "## " },
  { icon: List, label: "Bullet list", linePrefix: "- " },
  { icon: ListOrdered, label: "Numbered list", linePrefix: "1. " },
  { icon: Quote, label: "Quote", linePrefix: "> " },
  { icon: Code, label: "Inline code", wrap: ["`", "`"] },
  { icon: LinkIcon, label: "Link", wrap: ["[", "](https://)"] },
];

const EXPORT_FORMATS = ["markdown", "html", "txt", "docx", "pdf", "csv", "json"] as const;

export function NoteEditor({
  noteId,
  onDeleted,
  onToast,
  onBack,
}: {
  noteId: string;
  onDeleted: () => void;
  onToast: (message: string, tone: "success" | "error" | "info") => void;
  onBack: () => void;
}) {
  const { data: note, isLoading, isError } = useNote(noteId);
  const { data: folders } = useFolders();
  const updateNote = useUpdateNote(noteId);
  const deleteNote = useDeleteNote();
  const regenerateSummary = useRegenerateSummary(noteId);

  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [previewMode, setPreviewMode] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedNoteId = useRef<string | null>(null);

  const { data: versions, isLoading: versionsLoading } = useNoteVersions(noteId, showHistory);
  const restoreVersion = useRestoreVersion(noteId);

  // Reset local editor state whenever a different note loads.
  useEffect(() => {
    if (note && loadedNoteId.current !== note.id) {
      setContent(note.contentMd ?? "");
      setTitle(note.title);
      setSaveStatus("idle");
      loadedNoteId.current = note.id;
    }
  }, [note]);

  function scheduleAutoSave(nextContent: string) {
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateNote.mutate(
        { contentMd: nextContent },
        {
          onSuccess: () => setSaveStatus("saved"),
          onError: () => {
            setSaveStatus("error");
            onToast("Couldn't save your changes — check your connection.", "error");
          },
        }
      );
    }, 1200);
  }

  function handleContentChange(next: string) {
    setContent(next);
    scheduleAutoSave(next);
  }

  function handleTitleBlur() {
    if (!note || title === note.title) return;
    updateNote.mutate(
      { title },
      {
        onSuccess: () => onToast("Title updated", "success"),
        onError: () => onToast("Couldn't update the title", "error"),
      }
    );
  }

  function applyToolbarAction(action: (typeof TOOLBAR_ACTIONS)[number]) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd, value } = textarea;
    let next: string;
    let cursorPos: number;

    if (action.wrap) {
      const [before, after] = action.wrap;
      const selected = value.slice(selectionStart, selectionEnd) || "text";
      next = value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd);
      cursorPos = selectionStart + before.length + selected.length + after.length;
    } else if (action.linePrefix) {
      const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
      next = value.slice(0, lineStart) + action.linePrefix + value.slice(lineStart);
      cursorPos = selectionEnd + action.linePrefix.length;
    } else {
      return;
    }

    handleContentChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  }

  function handleTogglePin() {
    if (!note) return;
    updateNote.mutate(
      { isPinned: !note.isPinned },
      { onSuccess: () => onToast(note.isPinned ? "Unpinned" : "Pinned", "success") }
    );
  }

  function handleFolderChange(folderId: string) {
    updateNote.mutate(
      { folderId: folderId || null },
      { onSuccess: () => onToast("Moved to folder", "success"), onError: () => onToast("Couldn't move note", "error") }
    );
  }

  function handleAddTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || !note) return;
    e.preventDefault();
    const tag = tagInput.trim();
    if (!tag || note.tags.includes(tag)) {
      setTagInput("");
      return;
    }
    updateNote.mutate({ tags: [...note.tags, tag] });
    setTagInput("");
  }

  function handleRemoveTag(tag: string) {
    if (!note) return;
    updateNote.mutate({ tags: note.tags.filter((t) => t !== tag) });
  }

  function handleDelete() {
    if (!confirm("Delete this note? This can't be undone.")) return;
    deleteNote.mutate(noteId, {
      onSuccess: () => {
        onToast("Note deleted", "success");
        onDeleted();
      },
      onError: () => onToast("Couldn't delete this note", "error"),
    });
  }

  function handleRegenerateSummary() {
    regenerateSummary.mutate(undefined, {
      onSuccess: () => onToast("Summary regenerated", "success"),
      onError: () => onToast("Couldn't regenerate the summary", "error"),
    });
  }

  function handleRestoreVersion(versionId: string) {
    if (!confirm("Restore this version? Your current content will be saved to history first, so you can always undo this.")) return;
    restoreVersion.mutate(versionId, {
      onSuccess: (data) => {
        setContent(data.note.contentMd);
        setShowHistory(false);
        onToast("Version restored", "success");
      },
      onError: () => onToast("Couldn't restore this version", "error"),
    });
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-mist">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (isError || !note) {
    return <div className="flex h-full items-center justify-center text-sm text-danger">This note couldn&apos;t be loaded.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            title="Back to notes"
            className="mt-0.5 shrink-0"
          >
            <ArrowLeft size={16} />
          </Button>
          <div className="min-w-0 flex-1">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              className="w-full truncate bg-transparent font-display text-xl font-medium text-ink focus:outline-none"
              placeholder="Untitled notes"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {note.tags.map((tag) => (
                <Badge key={tag} tone="signal" className="cursor-pointer" onClick={() => handleRemoveTag(tag)}>
                  {tag} <XIcon size={10} />
                </Badge>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="+ tag"
                className="w-16 bg-transparent text-xs text-mist placeholder:text-mist/50 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <select
            value={note.folderId ?? ""}
            onChange={(e) => handleFolderChange(e.target.value)}
            className="h-8 rounded-lg border border-border bg-surface/40 px-2 text-xs text-ink focus:border-signal focus:outline-none"
          >
            <option value="">No folder</option>
            {(folders ?? []).map((f: ApiFolder) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          <Button variant="ghost" size="sm" onClick={handleTogglePin} title={note.isPinned ? "Unpin" : "Pin"}>
            {note.isPinned ? <Pin size={16} className="text-pulse" /> : <PinOff size={16} />}
          </Button>

          <div className="relative">
            <Button variant="ghost" size="sm" onClick={() => setShowHistory((s) => !s)} title="Version history">
              <History size={16} className={cn(showHistory && "text-signal")} />
            </Button>
            {showHistory && (
              <div className="absolute right-0 top-full z-20 mt-1 max-h-80 w-72 overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-glass-sm">
                {versionsLoading && (
                  <div className="flex items-center justify-center py-4 text-mist">
                    <Loader2 size={14} className="animate-spin" />
                  </div>
                )}
                {!versionsLoading && (versions ?? []).length === 0 && (
                  <p className="px-2 py-3 text-center text-xs text-mist">
                    No earlier versions yet — history starts after your first edit.
                  </p>
                )}
                {(versions ?? []).map((version) => (
                  <button
                    key={version.id}
                    onClick={() => handleRestoreVersion(version.id)}
                    disabled={restoreVersion.isPending}
                    className="block w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-ink/5 disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between text-mist">
                      <span>{new Date(version.createdAt).toLocaleString()}</span>
                      <span>{version.wordCount.toLocaleString()}w</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-ink/80">{version.preview}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative group">
            <Button variant="ghost" size="sm">
              <Download size={16} />
            </Button>
            <div className="absolute right-0 top-full z-10 hidden min-w-[140px] rounded-xl border border-border bg-surface p-1 shadow-glass-sm group-hover:block">
              {EXPORT_FORMATS.map((format) => (
                <button
                  key={format}
                  onClick={() => downloadNoteExport(noteId, format)}
                  className="block w-full rounded-lg px-3 py-1.5 text-left text-xs text-ink hover:bg-ink/5"
                >
                  {format.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={handleDelete} title="Delete note">
            <Trash2 size={16} className="text-danger" />
          </Button>
        </div>
      </div>

      {note.summary && (
        <div className="flex items-start justify-between gap-3 border-b border-border bg-surface/30 px-6 py-3">
          <p className="text-sm text-mist">{note.summary}</p>
          <button
            onClick={handleRegenerateSummary}
            disabled={regenerateSummary.isPending}
            className="flex shrink-0 items-center gap-1 text-xs text-signal hover:underline disabled:opacity-50"
          >
            <RefreshCw size={12} className={cn(regenerateSummary.isPending && "animate-spin")} />
            Regenerate
          </button>
        </div>
      )}

      <div className="flex items-center justify-between border-b border-border px-6 py-2">
        <div className="flex items-center gap-1">
          {TOOLBAR_ACTIONS.map((action) => (
            <button
              key={action.label}
              title={action.label}
              onClick={() => applyToolbarAction(action)}
              disabled={previewMode}
              className="rounded-lg p-1.5 text-mist transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-30"
            >
              <action.icon size={15} />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="hud-readout flex items-center gap-1.5 text-xs text-mist">
            {saveStatus === "saving" && (
              <>
                <Loader2 size={12} className="animate-spin" /> Saving…
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <Check size={12} className="text-success" /> Saved
              </>
            )}
            {saveStatus === "error" && <span className="text-danger">Save failed</span>}
          </span>

          <button
            onClick={() => setPreviewMode((p) => !p)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-mist hover:bg-ink/5 hover:text-ink"
          >
            {previewMode ? <Pencil size={13} /> : <Eye size={13} />}
            {previewMode ? "Edit" : "Preview"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {previewMode ? (
  <div>
    <div
      className="note-preview text-sm text-ink"
      dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
    />
    <style jsx>{`
      .note-preview :global(h1) { font-size: 1.5rem; font-weight: 600; margin: 1.75rem 0 0.75rem; line-height: 1.3; }
      .note-preview :global(h1:first-child) { margin-top: 0; }
      .note-preview :global(h2) { font-size: 1.25rem; font-weight: 600; margin: 1.5rem 0 0.6rem; line-height: 1.35; }
      .note-preview :global(h3) { font-size: 1.05rem; font-weight: 600; margin: 1.25rem 0 0.5rem; opacity: 0.92; }
      .note-preview :global(h4) { font-size: 0.95rem; font-weight: 600; margin: 1rem 0 0.4rem; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.02em; }
      .note-preview :global(p) { margin: 0 0 0.9rem; line-height: 1.7; }
      .note-preview :global(ul), .note-preview :global(ol) { margin: 0 0 1rem; padding-left: 1.4rem; }
      .note-preview :global(li) { margin: 0.3rem 0; line-height: 1.65; }
      .note-preview :global(li > ul), .note-preview :global(li > ol) { margin: 0.3rem 0 0.3rem 0.2rem; }
      .note-preview :global(strong) { font-weight: 600; color: inherit; }
      .note-preview :global(blockquote) { border-left: 2px solid var(--signal, #5ff2ff); padding-left: 1rem; margin: 1rem 0; opacity: 0.85; font-style: italic; }
      .note-preview :global(code) { background: rgba(255,255,255,0.06); padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.85em; }
      .note-preview :global(pre) { background: rgba(255,255,255,0.05); padding: 0.9rem 1rem; border-radius: 8px; overflow-x: auto; margin: 1rem 0; }
      .note-preview :global(pre code) { background: none; padding: 0; }
      .note-preview :global(a) { color: var(--signal, #5ff2ff); text-decoration: underline; text-underline-offset: 2px; }
      .note-preview :global(hr) { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 1.5rem 0; }
    `}</style>
  </div>
) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            className="h-full w-full resize-none bg-transparent font-mono text-sm leading-relaxed text-ink focus:outline-none"
            placeholder="Start writing, or generate notes with AI…"
            spellCheck={false}
          />
        )}
      </div>

      <div className="hud-readout border-t border-border px-6 py-2 text-xs text-mist">
        {content.trim() ? content.trim().split(/\s+/).length.toLocaleString() : 0} words
      </div>
    </div>
  );
}
