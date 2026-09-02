export type WorldAlign = "left" | "right";

export interface World {
  id: string;
  index: number;
  tag: string;
  title: string;
  description: string;
  color: string;
  align: WorldAlign;
}

export const DEFAULT_ACCENT = "#5ff2ff";

export const WORLDS: World[] = [
  {
    id: "research",
    index: 0,
    tag: "Research Lab",
    title: "The core starts reading.",
    description:
      "Every paper, dataset and citation you touch gets pulled into one live knowledge graph. Ask it anything — it already read the sources.",
    color: "#3fe8c4",
    align: "left",
  },
  {
    id: "projects",
    index: 1,
    tag: "Project Studio",
    title: "The core starts building.",
    description:
      "Blueprints, architecture and code scaffolding generate in real time as you describe what you're building — a real workspace, not a chat window.",
    color: "#4d8dff",
    align: "right",
  },
  {
    id: "placement",
    index: 2,
    tag: "Placement Center",
    title: "The core starts tracking.",
    description:
      "Every internship, application and interview slot lands on one radar. Mission control for the entire hunt — nothing falls through.",
    color: "#ff7a45",
    align: "left",
  },
  {
    id: "resume",
    index: 3,
    tag: "Resume Builder",
    title: "The core starts assembling.",
    description:
      "Your projects, research and experience snap into a resume that rewrites itself for every role you target.",
    color: "#9d6bff",
    align: "right",
  },
];
