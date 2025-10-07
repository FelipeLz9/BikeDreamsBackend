import { normalizeNews } from "../utils/normalizers.js";

export async function getNews() {
  const res = await fetch("http://localhost:4000/news");
  const data = await res.json();

  const news = (data.news || []).map(normalizeNews);

  return { total: news.length, news };
}
