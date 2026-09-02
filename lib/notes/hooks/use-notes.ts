"use client";

/**
 * lib/notes/hooks/use-notes.ts
 *
 * React Query hooks for the Notes AI workspace UI. Talks to app/api/notes/*
 * only — no direct Supabase access from the client, consistent with every
 * other wired feature in the app.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  NoteType,
  LearningMode,
  OutputStyle,
  SourceKind,
} from "../models/types";

export interface ApiNote {
  id: string;
  title: string;
  noteType: NoteType;
  learningMode: LearningMode | null;
  outputStyle: OutputStyle | null;
  folderId: string | null;
  tags: string[];
  isPinned: boolean;
  status: "pending" | "processing" | "ready" | "failed";
  summary: string | null;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
  contentMd?: string;
}

export interface ApiFolder {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotesFilter {
  folderId?: string;
  unfiled?: boolean;
  tag?: string;
  pinnedOnly?: boolean;
  q?: string;
}

type LengthHintValue = "very_short" | "short" | "medium" | "long";

export interface GenerateNotePayload {
  noteType: NoteType;
  sourceKind: SourceKind;
  sourceText: string;
  sourceTitle?: string;
  uploadId?: string;
  learningMode?: LearningMode;
  outputStyle?: OutputStyle;
  focusTopic?: string;
  lengthHint?: LengthHintValue;
  folderId?: string | null;
  tags?: string[];
}

/**
 * Safely parses a fetch Response as JSON, with two defensive checks that
 * matter a lot in practice: if the request got redirected (almost always
 * an expired session bouncing to the login page, which returns 200 OK
 * HTML — so `res.ok` alone doesn't catch this) or the response simply
 * isn't JSON for any other reason, this throws a clear, actionable error
 * instead of letting `res.json()` throw a cryptic
 * `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` deep inside a
 * try/catch where it's meaningless to whoever reads it.
 */
export async function parseJsonResponse<T>(res: Response): Promise<T> {
  if (res.redirected) {
    throw new Error("Your session may have expired. Please refresh the page and sign in again.");
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      res.ok
        ? "The server returned an unexpected response. Please refresh the page and try again."
        : `Request failed (${res.status}). Please refresh the page and try again.`
    );
  }

  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error((body as { error?: string })?.error ?? `Request failed (${res.status})`);
  }
  return body;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  return parseJsonResponse<T>(res);
}

function notesQueryKey(filter: NotesFilter) {
  return ["notes", filter] as const;
}

export function useNotesList(filter: NotesFilter = {}) {
  const params = new URLSearchParams();
  if (filter.folderId) params.set("folderId", filter.folderId);
  if (filter.unfiled) params.set("unfiled", "true");
  if (filter.tag) params.set("tag", filter.tag);
  if (filter.pinnedOnly) params.set("pinnedOnly", "true");
  if (filter.q) params.set("q", filter.q);

  return useQuery({
    queryKey: notesQueryKey(filter),
    queryFn: () => apiFetch<{ notes: ApiNote[] }>(`/api/notes?${params.toString()}`),
    select: (data) => data.notes,
  });
}

export function useNote(id: string | null) {
  return useQuery({
    queryKey: ["notes", "detail", id],
    queryFn: () => apiFetch<{ note: ApiNote }>(`/api/notes/${id}`),
    select: (data) => data.note,
    enabled: !!id,
  });
}

export function useGenerateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GenerateNotePayload) =>
      apiFetch<{ note: ApiNote }>("/api/notes", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

/** Auto-save / manual edits — content and/or metadata, any subset. Optimistically updates the note-list cache. */
export function useUpdateNote(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      patch: Partial<Pick<ApiNote, "title" | "folderId" | "tags" | "isPinned">> & { contentMd?: string }
    ) => apiFetch<{ note: ApiNote }>(`/api/notes/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: (data) => {
      queryClient.setQueryData(["notes", "detail", id], { note: data.note });
      queryClient.invalidateQueries({ queryKey: ["notes"], exact: false, predicate: (q) => q.queryKey[0] === "notes" && q.queryKey[1] !== "detail" });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ success: true }>(`/api/notes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

export function useRegenerateSummary(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ summary: string | null }>(`/api/notes/${id}/summary`, { method: "POST" }),
    onSuccess: (data) => {
      queryClient.setQueryData<{ note: ApiNote } | undefined>(["notes", "detail", id], (prev) =>
        prev ? { note: { ...prev.note, summary: data.summary } } : prev
      );
      queryClient.invalidateQueries({ queryKey: ["notes"], exact: false, predicate: (q) => q.queryKey[0] === "notes" && q.queryKey[1] !== "detail" });
    },
  });
}

export interface ApiNoteVersion {
  id: string;
  wordCount: number;
  createdAt: string;
  preview: string;
}

export function useNoteVersions(noteId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["notes", "versions", noteId],
    queryFn: () => apiFetch<{ versions: ApiNoteVersion[] }>(`/api/notes/${noteId}/versions`),
    select: (data) => data.versions,
    enabled,
  });
}

export function useRestoreVersion(noteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) =>
      apiFetch<{ note: { id: string; contentMd: string; wordCount: number; updatedAt: string } }>(
        `/api/notes/${noteId}/versions/${versionId}/restore`,
        { method: "POST" }
      ),
    onSuccess: (data) => {
      queryClient.setQueryData<{ note: ApiNote } | undefined>(["notes", "detail", noteId], (prev) =>
        prev
          ? {
              note: {
                ...prev.note,
                contentMd: data.note.contentMd,
                wordCount: data.note.wordCount,
                updatedAt: data.note.updatedAt,
              },
            }
          : prev
      );
      queryClient.invalidateQueries({ queryKey: ["notes", "versions", noteId] });
    },
  });
}

export function useFolders() {
  return useQuery({
    queryKey: ["notes", "folders"],
    queryFn: () => apiFetch<{ folders: ApiFolder[] }>("/api/notes/folders"),
    select: (data) => data.folders,
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color?: string }) =>
      apiFetch<{ folder: ApiFolder }>("/api/notes/folders", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", "folders"] });
    },
  });
}

export function useRenameFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name?: string; color?: string }) =>
      apiFetch<{ folder: ApiFolder }>(`/api/notes/folders/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", "folders"] });
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ success: true }>(`/api/notes/folders/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

/** Triggers a browser download of the exported file — not a query, just a navigation helper. */
export function downloadNoteExport(id: string, format: "markdown" | "html" | "txt" | "json" | "csv" | "docx" | "pdf") {
  window.open(`/api/notes/${id}/export?format=${format}`, "_blank");
}
