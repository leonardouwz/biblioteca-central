export interface Book {
  id: string;
  title: string;
  author: string;
  /** URL de portada externa (Open Library), opcional. `null` si no se cargó ninguna. */
  coverUrl: string | null;
  /** Año de primera publicación, opcional. */
  publishYear: number | null;
}
