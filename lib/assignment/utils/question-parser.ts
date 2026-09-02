// lib/assignment/utils/question-parser.ts
// Deterministic, regex-based heuristic that splits raw document text into
// candidate question blocks BEFORE we hand it to the AI classifier. This
// cuts token usage (we can batch reasonably-sized chunks) and gives the AI
// prompt a head start via the `questionNumber` hints already present in text.
// The AI classification pass (question-detection.ts) remains the source of
// truth for classification; this is purely a segmentation aid.
//
// KNOWN FAILURE MODE (fixed below): a question that instructs the student
// with an embedded numbered list — e.g. "Design a data structure...
// consider: 1. Use an array. 2. Use a hash map. 3. Combine them." — used to
// get split into extra phantom "questions" at each "1.", "2.", "3.", since
// the regex can't tell embedded instructional numbering apart from real
// top-level question numbering. The fix: real top-level questions in an
// assignment almost always number upward across the WHOLE document (1, 2,
// 3, 4...); embedded sub-steps restart at 1 for each question. A bare
// number (no "Q"/"Question" prefix) that doesn't continue the ascending
// top-level sequence is treated as a sub-step and merged back into the
// block it belongs to, instead of starting a new one.

export interface CandidateQuestionBlock {
  questionNumberHint: string;
  text: string;
  startOffset: number;
  endOffset: number;
}

// Matches common academic numbering styles at the start of a line:
// "1.", "Q1.", "Q1)", "1)", "(a)", "a)", "i.", "ii)", "1(a)", "Question 3:"
const NUMBERING_PATTERN =
  /^(?:\s*)((?:Q(?:uestion)?\s*)?\d{1,3}(?:\s*[.):]|\s*\(\s*[a-zA-Z]\s*\))|(?:\(\s*[a-ivxlc]{1,4}\s*\))|(?:[a-z]\s*\))|(?:[ivxlc]{1,4}\s*[.)]))\s*/gim;

/** True if a matched label has an explicit "Q"/"Question" word in front of
 * the number — those are unambiguous top-level question markers regardless
 * of ordering (e.g. a paper numbered "Q1", "Q2a", "Q3" out of sequence is
 * still clearly top-level, since nothing else uses that prefix). */
function hasQuestionPrefix(label: string): boolean {
  return /^q(?:uestion)?\s*\d/i.test(label);
}

/** Extracts the leading integer from a bare numeric label like "3." or "12)"
 * — returns null for anything else (lettered/roman-numeral sub-parts, or
 * labels that already have a Q/Question prefix, which are handled by
 * hasQuestionPrefix instead). */
function bareNumericValue(label: string): number | null {
  if (hasQuestionPrefix(label)) return null;
  const match = /^(\d{1,3})/.exec(label);
  return match ? parseInt(match[1]!, 10) : null;
}

export function splitIntoCandidateQuestions(fullText: string): CandidateQuestionBlock[] {
  const normalized = fullText.replace(/\r\n/g, "\n");
  const rawMatches: { index: number; label: string }[] = [];

  let match: RegExpExecArray | null;
  const re = new RegExp(NUMBERING_PATTERN);
  while ((match = re.exec(normalized)) !== null) {
    // Guard against false positives inside a line (e.g. a decimal number like "3.14")
    const lineStart = normalized.lastIndexOf("\n", match.index) + 1;
    const isAtLineStart = match.index === lineStart || normalized.slice(lineStart, match.index).trim() === "";
    if (isAtLineStart) {
      rawMatches.push({ index: match.index, label: match[1]!.trim() });
    }
    if (re.lastIndex === match.index) re.lastIndex++; // avoid infinite loop on zero-width match
  }

  // Filter out bare numeric matches that look like embedded instructional
  // steps rather than real top-level questions — i.e. a bare number that
  // doesn't continue the ascending top-level sequence we've seen so far.
  // Q/Question-prefixed matches and lettered/roman sub-part matches
  // ("(a)", "i.") are never filtered here; only bare "N." / "N)" labels are
  // subject to this check, since those are the ambiguous case.
  let lastTopLevelNumber = 0;
  const matches = rawMatches.filter((m) => {
    const bareValue = bareNumericValue(m.label);
    if (bareValue === null) return true; // not a bare-numeric label — keep as-is
    if (bareValue > lastTopLevelNumber) {
      lastTopLevelNumber = bareValue;
      return true; // continues the ascending sequence — genuine top-level question
    }
    return false; // doesn't continue the sequence — treat as an embedded sub-step
  });

  if (matches.length === 0) {
    // No detectable numbering — treat the whole document as one block so
    // downstream AI classification can still attempt full extraction.
    return normalized.trim().length > 0
      ? [{ questionNumberHint: "unnumbered", text: normalized.trim(), startOffset: 0, endOffset: normalized.length }]
      : [];
  }

  const blocks: CandidateQuestionBlock[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i]!.index;
    const end = i + 1 < matches.length ? matches[i + 1]!.index : normalized.length;
    const text = normalized.slice(start, end).trim();
    if (text.length === 0) continue;
    blocks.push({
      questionNumberHint: matches[i]!.label,
      text,
      startOffset: start,
      endOffset: end,
    });
  }

  return mergeTooSmallBlocks(blocks);
}

// Sub-parts like "(a)" immediately following a parent "Q3" are often meant to
// be read together for context even if graded separately downstream — but a
// block under 15 characters is almost always a mis-split (e.g. a stray
// "a)" inside prose). Merge those into the previous block.
function mergeTooSmallBlocks(blocks: CandidateQuestionBlock[]): CandidateQuestionBlock[] {
  const MIN_BLOCK_LENGTH = 15;
  const merged: CandidateQuestionBlock[] = [];
  for (const block of blocks) {
    if (block.text.length < MIN_BLOCK_LENGTH && merged.length > 0) {
      const prev = merged[merged.length - 1]!;
      prev.text = `${prev.text}\n${block.text}`;
      prev.endOffset = block.endOffset;
    } else {
      merged.push({ ...block });
    }
  }
  return merged;
}

/** Batches candidate blocks into groups that fit comfortably within a single
 * classification prompt, respecting an approximate character budget so we
 * don't blow the AI Core Engine's per-request token ceiling. */
export function batchCandidateBlocks(
  blocks: CandidateQuestionBlock[],
  maxCharsPerBatch = 6000
): CandidateQuestionBlock[][] {
  const batches: CandidateQuestionBlock[][] = [];
  let current: CandidateQuestionBlock[] = [];
  let currentChars = 0;

  for (const block of blocks) {
    if (currentChars + block.text.length > maxCharsPerBatch && current.length > 0) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(block);
    currentChars += block.text.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}
