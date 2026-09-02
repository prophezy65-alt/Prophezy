/**
 * checklist-generator.ts
 * Static, deterministic baseline checklists for submission, presentation,
 * demo, and judging prep. Used as the always-available default; AI Core
 * can add hackathon-specific items on top (see planner.service.ts).
 */

import { ChecklistItem, Checklist, HackathonId } from "../models/hackathon.model";

function item(id: string, label: string, category: ChecklistItem["category"]): ChecklistItem {
  return { id, label, done: false, category };
}

export function buildBaselineChecklist(hackathonId: HackathonId): Checklist {
  const items: ChecklistItem[] = [
    item("sub-1", "Repository is public and README explains setup + usage", "submission"),
    item("sub-2", "Submission form fields (title, tagline, description) filled out", "submission"),
    item("sub-3", "Demo video recorded and uploaded within time limit", "submission"),
    item("sub-4", "All required links (repo, demo, deployed app) working", "submission"),
    item("sub-5", "Team members and contributions listed", "submission"),
    item("pres-1", "Slide deck covers problem, solution, demo, impact, next steps", "presentation"),
    item("pres-2", "Presentation timed and within the allotted slot", "presentation"),
    item("pres-3", "Backup slides/screenshots ready in case live demo fails", "presentation"),
    item("demo-1", "Demo script written and rehearsed end-to-end", "demo"),
    item("demo-2", "Demo environment tested on the actual presentation setup/network", "demo"),
    item("demo-3", "Fallback recorded demo video ready as backup", "demo"),
    item("judge-1", "Reviewed evaluation criteria and mapped features to each criterion", "judging"),
    item("judge-2", "Prepared answers for likely judge questions (scalability, next steps, business model)", "judging"),
  ];

  return { hackathonId, items };
}

export function calculateChecklistProgress(checklist: Checklist): number {
  if (checklist.items.length === 0) return 0;
  const done = checklist.items.filter((i) => i.done).length;
  return Math.round((done / checklist.items.length) * 100);
}

export function markChecklistItem(checklist: Checklist, itemId: string, done: boolean): Checklist {
  return {
    ...checklist,
    items: checklist.items.map((i) => (i.id === itemId ? { ...i, done } : i)),
  };
}
