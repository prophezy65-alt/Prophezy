/**
 * lib/document/models/metadata.model.ts
 */

export interface DocumentMetadata {
  title: string | null;
  subtitle: string | null;
  authors: string[];
  institution: string | null;
  createdDate: string | null;
  modifiedDate: string | null;
  pageCount: number;
  wordCount: number;
  fileSizeBytes: number;
  mimeType: string;
  hasToc: boolean;
  hasBookmarks: boolean;
  custom: Record<string, unknown>;
}

export const EMPTY_METADATA: DocumentMetadata = {
  title: null,
  subtitle: null,
  authors: [],
  institution: null,
  createdDate: null,
  modifiedDate: null,
  pageCount: 0,
  wordCount: 0,
  fileSizeBytes: 0,
  mimeType: "",
  hasToc: false,
  hasBookmarks: false,
  custom: {},
};
