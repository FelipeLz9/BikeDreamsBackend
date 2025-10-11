import { Elysia } from "elysia";
import { getNews, getNewsById } from "../controllers/newsController.js";

export const newsRoutes = new Elysia()
    // Get all news from both USABMX and UCI sources
    .get("/news", async ({ query }) => {
        const { q, source } = query; // search query and source filter
        
        const result = await getNews();
        let { news } = result;
        
        // Apply source filter if provided
        if (source && typeof source === 'string') {
            const sourceFilter = source.toUpperCase();
            if (['USABMX', 'UCI'].includes(sourceFilter)) {
                news = news.filter((item: any) => item.source === sourceFilter);
            }
        }
        
        // Apply search filter if provided
        if (q && typeof q === 'string') {
            const search = q.toLowerCase();
            news = news.filter((item: any) =>
                item.title?.toLowerCase().includes(search) ||
                item.excerpt?.toLowerCase().includes(search) ||
                item.category?.toLowerCase().includes(search)
            );
        }
        
        return {
            total: news.length,
            news,
            sources: result.sources,
            filtered: !!(q || source)
        };
    })
    
    // Get specific news by ID (searches in both sources)
    .get("/news/:id", async ({ params }) => {
        const news = await getNewsById(params.id);
        
        if (!news) {
            return {
                error: "News not found",
                id: params.id
            };
        }
        
        return news;
    });
