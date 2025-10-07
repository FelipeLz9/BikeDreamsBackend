export function normalizeEvent(event: any) {
  return {
    id: event.id || crypto.randomUUID(),
    title: event.title || "Evento sin título",
    date: event.start_date || event.date || new Date().toISOString(),
    location: event.location || "Ubicación no disponible",
    type: event.type || "competition",
    attendees: event.attendees || 0,
  };
}

export function normalizeNews(item: any) {
  return {
    id: item.id || crypto.randomUUID(),
    title: item.title || "Noticia sin título",
    date: item.published_at || item.date || new Date().toISOString(),
    author: item.author || "Desconocido",
    category: item.category || "General",
    excerpt: item.summary || "",
    url: item.url || "#",
  };
}