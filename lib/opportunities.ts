export type SourcePlatform =
  | "Internshala"
  | "LinkedIn"
  | "Wellfound"
  | "Indeed"
  | "Naukri"
  | "Unstop"
  | "Google Careers"
  | "Microsoft Careers"
  | "Amazon Careers"
  | "Atlassian Careers"
  | "Razorpay Careers"
  | "PhonePe Careers";

export const SOURCE_STYLES: Record<SourcePlatform, { color: string; url: string }> = {
  Internshala: { color: "#34d399", url: "https://internshala.com" },
  LinkedIn: { color: "#0a66c2", url: "https://linkedin.com/jobs" },
  Wellfound: { color: "#b9c2c9", url: "https://wellfound.com" },
  Indeed: { color: "#4285f4", url: "https://indeed.com" },
  Naukri: { color: "#ff7555", url: "https://naukri.com" },
  Unstop: { color: "#ffb020", url: "https://unstop.com" },
  "Google Careers": { color: "#fbbc05", url: "https://careers.google.com" },
  "Microsoft Careers": { color: "#00a4ef", url: "https://careers.microsoft.com" },
  "Amazon Careers": { color: "#ff9900", url: "https://amazon.jobs" },
  "Atlassian Careers": { color: "#2684ff", url: "https://atlassian.com/careers" },
  "Razorpay Careers": { color: "#5ff2ff", url: "https://razorpay.com/jobs" },
  "PhonePe Careers": { color: "#9d6bff", url: "https://phonepe.com/careers" },
};

export type OpportunityCategory =
  | "AI/ML"
  | "Web Development"
  | "Backend"
  | "Cloud"
  | "Cyber Security"
  | "Data Science"
  | "Android"
  | "Game Development"
  | "Research";

export interface Opportunity {
  id: string;
  company: string;
  logoInitial: string;
  role: string;
  location: string;
  remote: boolean;
  stipend: string;
  duration: string;
  deadline: string;
  source: SourcePlatform;
  category: OpportunityCategory;
  trending: boolean;
  recommended: boolean;
  topCompany: boolean;
  matchReasons: string[];
  resumeScore: number;
  difficulty: "Easy" | "Medium" | "Hard";
}

export const OPPORTUNITIES: Opportunity[] = [
  {
    id: "google-aiml",
    company: "Google",
    logoInitial: "G",
    role: "AI/ML Intern",
    location: "Bengaluru",
    remote: false,
    stipend: "₹1,10,000/mo",
    duration: "6 months",
    deadline: "Aug 20",
    source: "Google Careers",
    category: "AI/ML",
    trending: true,
    recommended: true,
    topCompany: true,
    matchReasons: ["Matches your AI/ML skills", "Fits Semester 5", "Resume Score 92%"],
    resumeScore: 92,
    difficulty: "Hard",
  },
  {
    id: "razorpay-backend",
    company: "Razorpay",
    logoInitial: "R",
    role: "Backend Engineering Intern",
    location: "Remote",
    remote: true,
    stipend: "₹60,000/mo",
    duration: "3 months",
    deadline: "Aug 5",
    source: "Razorpay Careers",
    category: "Backend",
    trending: true,
    recommended: true,
    topCompany: true,
    matchReasons: ["Matches Node.js + Postgres stack", "Remote", "Interview Difficulty Medium"],
    resumeScore: 88,
    difficulty: "Medium",
  },
  {
    id: "microsoft-cloud",
    company: "Microsoft",
    logoInitial: "M",
    role: "Cloud Engineering Intern",
    location: "Hyderabad",
    remote: false,
    stipend: "₹1,00,000/mo",
    duration: "6 months",
    deadline: "Sep 1",
    source: "Microsoft Careers",
    category: "Cloud",
    trending: false,
    recommended: true,
    topCompany: true,
    matchReasons: ["Matches Azure coursework", "Fits Semester 5"],
    resumeScore: 81,
    difficulty: "Hard",
  },
  {
    id: "phonepe-web",
    company: "PhonePe",
    logoInitial: "P",
    role: "Frontend Intern",
    location: "Bengaluru",
    remote: true,
    stipend: "₹50,000/mo",
    duration: "4 months",
    deadline: "Jul 30",
    source: "PhonePe Careers",
    category: "Web Development",
    trending: true,
    recommended: false,
    topCompany: false,
    matchReasons: ["Matches React skills", "Remote", "Resume Score 85%"],
    resumeScore: 85,
    difficulty: "Medium",
  },
  {
    id: "atlassian-security",
    company: "Atlassian",
    logoInitial: "A",
    role: "Security Engineering Intern",
    location: "Remote",
    remote: true,
    stipend: "₹95,000/mo",
    duration: "5 months",
    deadline: "Aug 12",
    source: "Atlassian Careers",
    category: "Cyber Security",
    trending: false,
    recommended: true,
    topCompany: true,
    matchReasons: ["Matches security coursework", "Remote"],
    resumeScore: 76,
    difficulty: "Hard",
  },
  {
    id: "wellfound-ds",
    company: "Nimbus Labs",
    logoInitial: "N",
    role: "Data Science Intern",
    location: "Pune",
    remote: false,
    stipend: "₹40,000/mo",
    duration: "3 months",
    deadline: "Jul 28",
    source: "Wellfound",
    category: "Data Science",
    trending: false,
    recommended: true,
    topCompany: false,
    matchReasons: ["Matches Python + pandas skills", "Fits Semester 5", "Resume Score 79%"],
    resumeScore: 79,
    difficulty: "Easy",
  },
  {
    id: "internshala-android",
    company: "Loop Studio",
    logoInitial: "L",
    role: "Android Developer Intern",
    location: "Remote",
    remote: true,
    stipend: "₹25,000/mo",
    duration: "2 months",
    deadline: "Jul 25",
    source: "Internshala",
    category: "Android",
    trending: false,
    recommended: false,
    topCompany: false,
    matchReasons: ["Matches Kotlin skills", "Remote"],
    resumeScore: 71,
    difficulty: "Easy",
  },
  {
    id: "amazon-research",
    company: "Amazon",
    logoInitial: "A",
    role: "Applied Research Intern",
    location: "Chennai",
    remote: false,
    stipend: "₹1,20,000/mo",
    duration: "6 months",
    deadline: "Sep 10",
    source: "Amazon Careers",
    category: "Research",
    trending: true,
    recommended: false,
    topCompany: true,
    matchReasons: ["Matches published coursework", "Interview Difficulty Hard"],
    resumeScore: 83,
    difficulty: "Hard",
  },
];

export const CATEGORY_FILTERS: { id: string; label: string; emoji: string }[] = [
  { id: "recommended", emoji: "⭐", label: "Recommended For You" },
  { id: "trending", emoji: "🔥", label: "Trending Today" },
  { id: "top", emoji: "🏢", label: "Top Companies" },
  { id: "remote", emoji: "💻", label: "Remote" },
  { id: "AI/ML", emoji: "🤖", label: "AI/ML" },
  { id: "Web Development", emoji: "🌐", label: "Web Development" },
  { id: "Android", emoji: "📱", label: "Android" },
  { id: "Backend", emoji: "⚡", label: "Backend" },
  { id: "Cloud", emoji: "☁️", label: "Cloud" },
  { id: "Cyber Security", emoji: "🔐", label: "Cyber Security" },
  { id: "Data Science", emoji: "📊", label: "Data Science" },
  { id: "Game Development", emoji: "🎮", label: "Game Development" },
  { id: "Research", emoji: "🧠", label: "Research" },
];
