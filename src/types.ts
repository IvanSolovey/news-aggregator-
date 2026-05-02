export interface UserSettings {
  translate: boolean;
}

export interface FeedInfo {
  url: string;
  name: string;
}

export interface Article {
  title: string;
  link: string;
  summary: string;
  imageUrl?: string;
  pubDate?: Date;
  feedName: string;
  feedUrl: string;
}

export interface TranslatedArticle extends Article {
  translatedTitle?: string;
  translatedSummary?: string;
}
