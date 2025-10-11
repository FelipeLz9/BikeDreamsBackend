export function normalizeEvent(event: any) {
  // Handle null/undefined input
  if (!event) {
    event = {};
  }
  
  // Determinar la fuente del evento
  const source = event.country ? 'UCI' : 'USABMX';
  
  // Para eventos UCI, usar diferentes campos
  let location;
  if (source === 'UCI') {
    const loc = event.location || '';
    const country = event.country || '';
    location = `${loc}${country ? ', ' + country : ''}`.trim();
    if (!location) {
      location = "Ubicación no disponible";
    }
  } else {
    location = event.location || event.city || "Ubicación no disponible";
  }
  
  const date = event.start_date || event.date || new Date().toISOString();
  
  return {
    id: event.id || crypto.randomUUID(),
    title: event.title || event.name || "Evento sin título",
    date: date,
    end_date: event.end_date || date,
    location: location,
    city: event.city || null,
    state: event.state || null,
    country: event.country || 'USA',
    continent: event.continent || null,
    type: event.type || "competition",
    attendees: event.attendees !== null && event.attendees !== undefined ? event.attendees : 0,
    source: source,
    details_url: event.details_url || event.url || null,
    is_uci_event: event.is_uci_event || false,
    latitude: event.latitude !== null && event.latitude !== undefined ? event.latitude : null,
    longitude: event.longitude !== null && event.longitude !== undefined ? event.longitude : null
  };
}

export function normalizeNews(item: any) {
  // Handle null/undefined input
  if (!item) {
    item = {};
  }
  
  // Determinar la fuente de la noticia
  const source = item.image || item.summary ? 'UCI' : 'USABMX';
  
  return {
    id: item.id || crypto.randomUUID(),
    title: item.title || "Noticia sin título",
    date: item.published_at || item.date || new Date().toISOString(),
    author: item.author || "Desconocido",
    category: item.category || "General",
    excerpt: item.summary || item.excerpt || "",
    url: item.url || "#",
    source: source,
    image: item.image !== undefined ? item.image : null
  };
}
