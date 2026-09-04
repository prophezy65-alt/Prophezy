"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderPlus, Pin, Search, Sparkles, NotebookPen, Loader2, Trash2, Pencil, ChevronDown, Radar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useNotesList,
  useFolders,
  useCreateFolder,
  useRenameFolder,
  useDeleteFolder,
  type ApiFolder,
  type NotesFilter,
} from "@/lib/notes/hooks/use-notes";
import { GenerateNoteDialog } from "./generate-note-dialog";
import { NoteEditor } from "./note-editor";
import { NotesToastViewport, useNotesToast } from "./notes-toast";

const FOLDER_COLORS = ["#5ff2ff", "#f2a65f", "#a65ff2", "#5ff28d", "#f25f8d"];

type ViewTab = "all" | "pinned" | "unfiled";

const MOTTOS = [
  "Ideas decay fast. Write them down before they do.",
  "A note taken today is a shortcut tomorrow.",
  "Knowledge unwritten is knowledge lost.",
  "Small notes, compounded, become mastery.",
  "Your memory forgets. Your notes don't.",
  "Every expert's notebook started out messy.",
];

/** Theme tokens applied as inline CSS custom properties — guaranteed to apply
 *  regardless of stylesheet load order, caching, or hot-reload quirks. */
const HUD_VARS: Record<string, string> = {
  "--void": "220 26% 6%",
  "--surface": "220 22% 10%",
  "--surface-raised": "220 20% 14%",
  "--ink": "210 25% 93%",
  "--mist": "215 12% 58%",
  "--signal": "158 64% 55%",
  "--signal-soft": "158 64% 55% / 0.12",
  "--pulse": "34 92% 58%",
  "--pulse-soft": "34 92% 58% / 0.16",
  "--success": "158 64% 55%",
  "--danger": "356 80% 62%",
  "--border": "216 20% 20%",
};

const HUD_STYLE: CSSProperties = {
  ...HUD_VARS,
  color: "hsl(210 25% 93%)",
  background:
    "repeating-linear-gradient(180deg, hsl(0 0% 100% / 0.015) 0px, hsl(0 0% 100% / 0.015) 1px, transparent 1px, transparent 3px), radial-gradient(ellipse at top, hsl(220 30% 9%), hsl(220 28% 4%) 70%)",
} as CSSProperties;

/** A small interactive "transmission" console — click to cycle through mottos. */
function MottoConsole() {
  const [index, setIndex] = useState(0);
  return (
    <button
      type="button"
      onClick={() => setIndex((i) => (i + 1) % MOTTOS.length)}
      className="group mt-2 flex w-full max-w-sm flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-surface/30 px-4 py-3 text-center transition-colors hover:border-signal/40 hover:bg-surface/50"
    >
      <span className="hud-readout flex items-center gap-1.5 text-[9px] uppercase tracking-[0.22em] text-mist/60">
        <Radar size={10} className="text-signal/70" /> Transmission
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22 }}
          className="font-display text-sm italic text-ink/90"
        >
          "{MOTTOS[index]}"
        </motion.p>
      </AnimatePresence>
      <span className="hud-readout text-[9px] text-mist/50 opacity-0 transition-opacity group-hover:opacity-100">
        tap for another
      </span>
    </button>
  );
}

export default function NotesWorkspace() {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>("all");
  const [activeFolderId, setActiveFolderId] = useState<string | undefined>(undefined);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState<string | undefined>(undefined);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);

  const { toasts, show, dismiss } = useNotesToast();

  const filter: NotesFilter = useMemo(() => {
    const base: NotesFilter = { q: searchQuery };
    if (activeTab === "pinned") return { ...base, pinnedOnly: true };
    if (activeTab === "unfiled") return { ...base, unfiled: true };
    if (activeFolderId) return { ...base, folderId: activeFolderId };
    return base;
  }, [activeTab, activeFolderId, searchQuery]);

  const { data: notes, isLoading, isError } = useNotesList(filter);
  const { data: folders } = useFolders();
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();

  const activeFolder = useMemo(
    () => (folders ?? []).find((f) => f.id === activeFolderId),
    [folders, activeFolderId]
  );

  function runSearch() {
    setSearchQuery(searchInput.trim() || undefined);
  }

  function selectTab(tab: ViewTab) {
    setActiveTab(tab);
    setActiveFolderId(undefined);
    setSelectedNoteId(null);
  }

  function selectFolder(folderId: string) {
    setActiveTab("all");
    setActiveFolderId(folderId);
    setSelectedNoteId(null);
  }

  function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    const color = FOLDER_COLORS[(folders?.length ?? 0) % FOLDER_COLORS.length];
    createFolder.mutate(
      { name, color },
      {
        onSuccess: () => {
          setNewFolderName("");
          setShowNewFolder(false);
          show("Folder created", "success");
        },
        onError: (err) => show(err instanceof Error ? err.message : "Couldn't create folder", "error"),
      }
    );
  }

  function handleRenameFolder(folder: ApiFolder) {
    const name = window.prompt("Rename folder", folder.name);
    if (!name || name === folder.name) return;
    renameFolder.mutate({ id: folder.id, name }, { onError: () => show("Couldn't rename folder", "error") });
  }

  function handleDeleteFolder(folder: ApiFolder) {
    if (!confirm(`Delete "${folder.name}"? Notes inside will become unfiled.`)) return;
    deleteFolder.mutate(folder.id, {
      onSuccess: () => {
        if (activeFolderId === folder.id) selectTab("all");
        show("Folder deleted", "success");
      },
      onError: () => show("Couldn't delete folder", "error"),
    });
  }

  const listTitle = activeFolder ? activeFolder.name : activeTab === "pinned" ? "Pinned" : activeTab === "unfiled" ? "Unfiled" : "All notes";

  return (
    <div
      className="notes-hud relative flex h-[calc(100vh-6rem)] gap-4 overflow-hidden rounded-[28px] p-2"
      style={HUD_STYLE}
    >
      <style jsx global>{`
        .notes-hud ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .notes-hud ::-webkit-scrollbar-thumb {
          background: hsl(var(--signal) / 0.35);
          border-radius: 9999px;
        }
        .notes-hud ::-webkit-scrollbar-track {
          background: transparent;
        }

        .hud-readout {
          font-family: var(--font-mono), "JetBrains Mono", ui-monospace, monospace;
          letter-spacing: 0.03em;
        }

        .hud-glow {
          text-shadow: 0 0 14px hsl(var(--signal) / 0.45);
        }

        .hud-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: hsl(var(--signal));
          box-shadow: 0 0 0 0 hsl(var(--signal) / 0.55);
          animation: hud-pulse 2.2s infinite;
        }

        @keyframes hud-pulse {
          0% {
            box-shadow: 0 0 0 0 hsl(var(--signal) / 0.55);
          }
          70% {
            box-shadow: 0 0 0 7px hsl(var(--signal) / 0);
          }
          100% {
            box-shadow: 0 0 0 0 hsl(var(--signal) / 0);
          }
        }

        .hud-frame {
          position: relative;
        }
        .hud-frame::before {
          content: "";
          position: absolute;
          inset: 9px;
          pointer-events: none;
          z-index: 2;
          opacity: 0.5;
          background-image: linear-gradient(to right, hsl(var(--signal)) 2px, transparent 2px),
            linear-gradient(to bottom, hsl(var(--signal)) 2px, transparent 2px),
            linear-gradient(to left, hsl(var(--signal)) 2px, transparent 2px),
            linear-gradient(to bottom, hsl(var(--signal)) 2px, transparent 2px),
            linear-gradient(to right, hsl(var(--signal)) 2px, transparent 2px),
            linear-gradient(to top, hsl(var(--signal)) 2px, transparent 2px),
            linear-gradient(to left, hsl(var(--signal)) 2px, transparent 2px),
            linear-gradient(to top, hsl(var(--signal)) 2px, transparent 2px);
          background-repeat: no-repeat;
          background-size:
            12px 2px, 2px 12px,
            12px 2px, 2px 12px,
            12px 2px, 2px 12px,
            12px 2px, 2px 12px;
          background-position:
            top left, top left,
            top right, top right,
            bottom left, bottom left,
            bottom right, bottom right;
        }
      `}</style>
      {/* Unified sidebar: actions, search, filters, folders, and the note
          list all live in one panel. Fixed at 320px (w-80) on desktop, but
          that same fixed width squeezed the editor panel into a sliver on
          mobile viewports (~380px) with no way to see it — reported by a
          customer as the two panels "overlapping". Below md, only one of
          sidebar/editor is shown at a time (matching the mobile
          back-navigation NoteEditor's onBack prop already expects), each
          taking the full width; at md+ both show side-by-side as before. */}
      <Card
        className={`hud-frame relative ${
          selectedNoteId ? "hidden md:flex" : "flex"
        } w-full flex-col overflow-hidden p-0 md:w-80 md:shrink-0`}
      >
        <div className="flex items-center justify-between px-4 pb-1 pt-3.5">
          <div className="flex items-center gap-2">
            <span className="hud-dot" />
            <span className="hud-readout hud-glow text-[10px] uppercase tracking-[0.22em] text-ink/90">
              Notes Console
            </span>
          </div>
          <span className="hud-readout text-[9px] text-mist/50">v2.1</span>
        </div>

        <div className="space-y-3 border-b border-border p-4 pt-2.5">
          <Button onClick={() => setShowGenerateDialog(true)} className="w-full justify-center">
            <Sparkles size={16} /> Generate notes
          </Button>

          <div className="flex gap-1.5">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Search notes…"
              className="flex-1"
            />
            <Button variant="outline" size="md" onClick={runSearch} aria-label="Search">
              <Search size={16} />
            </Button>
          </div>

          <div className="flex rounded-xl bg-ink/5 p-1">
            {(["all", "pinned", "unfiled"] as ViewTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => selectTab(tab)}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition-colors",
                  activeTab === tab && !activeFolderId ? "bg-signal/15 text-signal" : "text-mist hover:text-ink"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="border-b border-border">
          <button
            onClick={() => setFoldersOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left"
          >
            <span className="text-[11px] font-medium uppercase tracking-wide text-mist">Folders</span>
            <div className="flex items-center gap-1">
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNewFolder((s) => !s);
                  setFoldersOpen(true);
                }}
                className="rounded p-0.5 text-mist hover:text-ink"
                aria-label="New folder"
              >
                <FolderPlus size={13} />
              </span>
              <ChevronDown size={13} className={cn("text-mist transition-transform", !foldersOpen && "-rotate-90")} />
            </div>
          </button>

          {foldersOpen && (
            <div className="max-h-40 overflow-y-auto px-2 pb-2">
              {showNewFolder && (
                <div className="mb-1.5 flex gap-1 px-1">
                  <Input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                    placeholder="Folder name"
                    className="h-8 text-xs"
                  />
                  <Button size="sm" onClick={handleCreateFolder} disabled={createFolder.isPending}>
                    Add
                  </Button>
                </div>
              )}

              {(folders ?? []).length === 0 && !showNewFolder && (
                <p className="px-2.5 py-1.5 text-xs text-mist/70">No folders yet.</p>
              )}

              {(folders ?? []).map((folder) => (
                <div
                  key={folder.id}
                  className={cn(
                    "group flex items-center justify-between rounded-lg border-l-2 px-2.5 py-1.5 text-sm transition-colors",
                    activeFolderId === folder.id
                      ? "border-signal bg-signal/10 text-signal"
                      : "border-transparent text-ink hover:border-signal/30 hover:bg-ink/5"
                  )}
                >
                  <button onClick={() => selectFolder(folder.id)} className="flex flex-1 items-center gap-2 truncate text-left">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: folder.color }} />
                    <span className="truncate text-xs">{folder.name}</span>
                  </button>
                  <div className="hidden items-center gap-0.5 group-hover:flex">
                    <button onClick={() => handleRenameFolder(folder)} className="rounded p-1 text-mist hover:text-ink">
                      <Pencil size={11} />
                    </button>
                    <button onClick={() => handleDeleteFolder(folder)} className="rounded p-1 text-mist hover:text-danger">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2">
          <h3 className="hud-readout text-[10px] font-medium uppercase tracking-[0.18em] text-mist">{listTitle}</h3>
          {!isLoading && (
            <span className="hud-readout flex items-center gap-1.5 text-[10px] text-mist/70">
              <span className="hud-dot" /> {(notes ?? []).length}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto border-t border-border/60">
          {isLoading && (
            <div className="flex h-32 items-center justify-center text-mist">
              <Loader2 size={18} className="animate-spin" />
            </div>
          )}

          {isError && <p className="p-4 text-sm text-danger">Failed to load notes.</p>}

          {!isLoading && !isError && (notes ?? []).length === 0 && (
            <div className="p-6 text-center text-sm text-mist">
              No notes here yet. Generate your first one to get started.
            </div>
          )}

          {(notes ?? []).map((note) => (
            <motion.button
              key={note.id}
              onClick={() => setSelectedNoteId(note.id)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                "group relative block w-full border-b border-border/40 py-3 pl-5 pr-4 text-left transition-colors",
                selectedNoteId === note.id ? "bg-signal/10" : "hover:bg-ink/5"
              )}
            >
              <span
                className={cn(
                  "absolute left-0 top-0 h-full w-0.5 transition-colors",
                  selectedNoteId === note.id
                    ? "bg-signal"
                    : note.isPinned
                    ? "bg-pulse/70"
                    : "bg-transparent group-hover:bg-signal/30"
                )}
              />
              <div className="flex items-center gap-1.5">
                {note.isPinned && <Pin size={11} className="shrink-0 text-pulse" />}
                <span className="truncate text-sm font-medium text-ink">{note.title}</span>
              </div>
              {note.summary && <p className="mt-1 line-clamp-2 text-xs text-mist">{note.summary}</p>}
              <div className="mt-1.5 flex items-center gap-1.5">
                <Badge tone="neutral" className="text-[10px]">
                  {note.noteType.replace(/_/g, " ")}
                </Badge>
                <span className="hud-readout text-[10px] text-mist/70">{note.wordCount.toLocaleString()}w</span>
              </div>
            </motion.button>
          ))}
        </div>
      </Card>

      {/* Editor */}
      <Card
        className={`hud-frame relative ${
          selectedNoteId ? "flex" : "hidden md:flex"
        } w-full flex-1 overflow-hidden p-0`}
      >
        {selectedNoteId ? (
          <NoteEditor
            noteId={selectedNoteId}
            onDeleted={() => setSelectedNoteId(null)}
            onBack={() => setSelectedNoteId(null)}
            onToast={(message, tone) => show(message, tone)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-signal/30 bg-signal/5">
              <span className="hud-dot absolute -right-1 -top-1" />
              <NotebookPen size={26} className="text-signal" strokeWidth={1.5} />
            </div>
            <div>
              <p className="hud-readout text-[10px] uppercase tracking-[0.28em] text-signal/80">System standby</p>
              <p className="mt-2 font-display text-lg font-medium text-ink">Select or generate a note</p>
              <p className="mt-1.5 max-w-xs text-sm text-mist">
                Pick a note from the list, or generate new AI notes from your study material.
              </p>
            </div>
            <Button onClick={() => setShowGenerateDialog(true)} variant="pulse" size="sm">
              <Sparkles size={14} /> Generate notes
            </Button>
            <MottoConsole />
          </div>
        )}
      </Card>

      <GenerateNoteDialog
        open={showGenerateDialog}
        onClose={() => setShowGenerateDialog(false)}
        defaultFolderId={activeFolderId ?? null}
        onCreated={(noteId) => {
          setSelectedNoteId(noteId);
          show("Notes generated", "success");
        }}
        onError={(message) => show(message, "error")}
      />

      <NotesToastViewport toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
