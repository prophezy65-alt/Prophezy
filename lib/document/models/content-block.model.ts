/**
 * lib/document/models/content-block.model.ts
 * Structured content extracted alongside plain text: tables, figures,
 * images, code, formulas — each anchored to a page + optional bounding box.
 */

import type { BoundingBox } from "../types/document.types";

export interface TableBlock {
  id: string;
  pageIndex: number;
  caption: string | null;
  headers: string[];
  rows: string[][];
  boundingBox: BoundingBox | null;
}

export interface Figure {
  id: string;
  pageIndex: number;
  caption: string | null;
  imageRef: string | null; // storage path, if extracted
  boundingBox: BoundingBox | null;
}

export interface ImageBlock {
  id: string;
  pageIndex: number;
  storageRef: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  ocrText: string | null;
}

export interface CodeBlock {
  id: string;
  pageIndex: number;
  language: string | null;
  code: string;
}

export interface Formula {
  id: string;
  pageIndex: number;
  raw: string; // LaTeX-ish or plain-text representation
  isInline: boolean;
}

export interface Hyperlink {
  text: string;
  url: string;
  pageIndex: number;
}
