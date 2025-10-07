import { Elysia } from "elysia";

const SCRAPER_API_URL = "http://localhost:4000";

async function fetchEvents(endpoint: string) {
    const res = await fetch(`${SCRAPER_API_URL}${endpoint}`);
    const data = await res.json();
    return Array.isArray(data) ? data : data?.events || [];
}

export const eventRoutes = new Elysia()
    .get("/events", async ({ query }) => {
        const { q } = query; // <-- busca en query string
        let events = await fetchEvents("/events");

        if (q) {
            const search = q.toLowerCase();
            events = events.filter((e: any) =>
                e.name.toLowerCase().includes(search)
            );
        }

        return { total: events.length, events };
    })
    .get("/events/upcoming", async () => {
        const events = await fetchEvents("/events/upcoming");
        return { total: events.length, events };
    })
    .get("/events/past", async () => {
        const events = await fetchEvents("/events/past");
        return { total: events.length, events };
    });
