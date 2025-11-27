// backend/routes/search.ts
import { Elysia } from "elysia";
import { normalizeEvent } from "../utils/normalizers";
import { normalizeNews } from "../utils/normalizers";

const API_URL = "http://localhost:4000";

async function fetchData(endpoint: string) {
    const res = await fetch(`${API_URL}${endpoint}`);
    const data = await res.json();
    return Array.isArray(data) ? data : data?.events || data?.news || [];
}

export const searchRoutes = new Elysia().get("/search", async ({ query }) => {
    const searchQuery = (query?.q || "").toLowerCase();

    // Traemos todos los datos
    const [events] = await Promise.all([
        fetchData("/events")
    ]);

    const [news] = await Promise.all([
      fetchData("/news")
    ])

    // Normalizamos los datos para asegurar formato consistente
    const normalizedEvents = events.map(normalizeEvent);
    const normalizedNews = news.map(normalizeNews);

    // Filtramos según el query
    const filteredEvents = normalizedEvents.filter((e: any) =>
        e.title?.toLowerCase().includes(searchQuery)
    );

    const filteredNews = normalizedNews.filter((n: any) =>
        n.title?.toLowerCase().includes(searchQuery)
    );

    return {
        events: filteredEvents,
        news: filteredNews,
        totalResults: filteredEvents.length + filteredNews.length 
    };
});
