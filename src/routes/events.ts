import { Elysia } from "elysia";
import { getEvents, getUpcomingEvents, getPastEvents } from "../controllers/eventController.js";

export const eventRoutes = new Elysia()
    .get("/events", async ({ query }) => {
        const { q } = query; // search query parameter
        
        // Get all events from unified controller
        const result = await getEvents();
        let { events } = result;
        
        // Apply search filter if provided
        if (q && typeof q === 'string') {
            const search = q.toLowerCase();
            events = events.filter((event: any) =>
                event.title?.toLowerCase().includes(search) ||
                event.location?.toLowerCase().includes(search) ||
                event.city?.toLowerCase().includes(search) ||
                event.country?.toLowerCase().includes(search)
            ) as any[];
        }
        
        return {
            total: events.length,
            events,
            sources: result.sources,
            filtered: !!q
        };
    })
    .get("/events/upcoming", async () => {
        return await getUpcomingEvents();
    })
    .get("/events/past", async () => {
        return await getPastEvents();
    });
