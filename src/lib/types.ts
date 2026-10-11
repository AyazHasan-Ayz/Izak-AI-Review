export type Business = {
  name: string;
  category: string;
  city: string;
  description: string;
  logo_url: string;
  google_review_url: string;
};
export type BusinessSettings = {
  language: 'English' | 'Hindi' | 'Hinglish';
  products: string[];
};
