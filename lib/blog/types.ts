export interface BlogCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export interface BlogTag {
  id: string;
  slug: string;
  name: string;
}

export interface BlogAuthor {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
}

export interface BlogPostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  readTimeMinutes: number;
  isFeatured: boolean;
  viewCount: number;
  publishedAt: string | null;
  category: BlogCategory | null;
  tags: BlogTag[];
  author: BlogAuthor | null;
}

export interface BlogPost extends BlogPostSummary {
  contentMarkdown: string;
}
