import { Elysia } from "elysia";

const SCRAPER_API_URL = "http://localhost:4000";

async function fetchNews(endpoint: string) {
    const res = await fetch(`${SCRAPER_API_URL}${endpoint}`);
    const data = await res.json();

    // 🔹 Si es un array directo lo usamos tal cual
    // 🔹 Si es un objeto con { news: [...] } usamos el array
    return Array.isArray(data) ? data : data?.news || [];
}

export const newsRoutes = new Elysia()
    // Todas las noticias
    .get("/news", async () => {
        const news = await fetchNews("/news");
        return { total: news.length, news };
    })

    // Noticias por ID
    .get("/news/:id", async ({ params }) => {
        const news = await fetchNews(`/news/id/${params.id}`);
        return { total: news.length, news };
    });
