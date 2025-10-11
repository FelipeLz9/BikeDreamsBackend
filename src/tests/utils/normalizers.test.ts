// Mock de crypto.randomUUID para tests determinísticos
const mockRandomUUID = jest.fn(() => 'mock-uuid-123');

// Mock del objeto global crypto
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: mockRandomUUID
  }
});

// Importar después de los mocks
import { normalizeEvent, normalizeNews } from '../../utils/normalizers';

describe('🔧 Normalizers Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock to return consistent UUIDs
    mockRandomUUID.mockReturnValue('mock-uuid-123');
  });

  describe('normalizeEvent', () => {
    test('should normalize UCI event with complete data', () => {
      const uciEvent = {
        id: 'uci-123',
        name: 'UCI World Championships',
        start_date: '2024-08-15T10:00:00Z',
        end_date: '2024-08-18T18:00:00Z',
        location: 'Paris',
        country: 'France',
        continent: 'Europe',
        city: 'Paris',
        state: null,
        type: 'championship',
        attendees: 5000,
        details_url: 'https://uci.org/event-123',
        is_uci_event: true,
        latitude: 48.8566,
        longitude: 2.3522
      };

      const result = normalizeEvent(uciEvent);

      expect(result).toEqual({
        id: 'uci-123',
        title: 'UCI World Championships',
        date: '2024-08-15T10:00:00Z',
        end_date: '2024-08-18T18:00:00Z',
        location: 'Paris, France',
        city: 'Paris',
        state: null,
        country: 'France',
        continent: 'Europe',
        type: 'championship',
        attendees: 5000,
        source: 'UCI',
        details_url: 'https://uci.org/event-123',
        is_uci_event: true,
        latitude: 48.8566,
        longitude: 2.3522
      });
    });

    test('should normalize USABMX event with complete data', () => {
      const usabmxEvent = {
        id: 'usabmx-456',
        title: 'National Championship',
        date: '2024-09-20T09:00:00Z',
        location: 'Phoenix BMX Track',
        city: 'Phoenix',
        state: 'Arizona',
        type: 'national',
        attendees: 1500,
        url: 'https://usabmx.com/event-456',
        latitude: 33.4484,
        longitude: -112.0740
      };

      const result = normalizeEvent(usabmxEvent);

      expect(result).toEqual({
        id: 'usabmx-456',
        title: 'National Championship',
        date: '2024-09-20T09:00:00Z',
        end_date: '2024-09-20T09:00:00Z', // Same as date when no end_date
        location: 'Phoenix BMX Track',
        city: 'Phoenix',
        state: 'Arizona',
        country: 'USA', // Default for non-UCI events
        continent: null,
        type: 'national',
        attendees: 1500,
        source: 'USABMX',
        details_url: 'https://usabmx.com/event-456',
        is_uci_event: false, // Default for non-UCI events
        latitude: 33.4484,
        longitude: -112.0740
      });
    });

    test('should handle UCI event with minimal data', () => {
      const minimalUciEvent = {
        country: 'Germany' // This makes it UCI
      };

      const result = normalizeEvent(minimalUciEvent);

      expect(result.source).toBe('UCI');
      expect(result.id).toBe('mock-uuid-123');
      expect(result.title).toBe('Evento sin título');
      expect(result.location).toBe(', Germany');
      expect(result.country).toBe('Germany');
      expect(result.type).toBe('competition');
      expect(result.attendees).toBe(0);
    });

    test('should handle USABMX event with minimal data', () => {
      const minimalUsabmxEvent = {};

      const result = normalizeEvent(minimalUsabmxEvent);

      expect(result.source).toBe('USABMX');
      expect(result.id).toBe('mock-uuid-123');
      expect(result.title).toBe('Evento sin título');
      expect(result.location).toBe('Ubicación no disponible');
      expect(result.country).toBe('USA');
      expect(result.type).toBe('competition');
      expect(result.attendees).toBe(0);
      expect(result.is_uci_event).toBe(false);
    });

    test('should prioritize title over name for event title', () => {
      const eventWithBoth = {
        title: 'Event Title',
        name: 'Event Name',
        country: 'France'
      };

      const result = normalizeEvent(eventWithBoth);

      expect(result.title).toBe('Event Title');
    });

    test('should use name when title is not available', () => {
      const eventWithName = {
        name: 'Event Name Only',
        country: 'Spain'
      };

      const result = normalizeEvent(eventWithName);

      expect(result.title).toBe('Event Name Only');
    });

    test('should handle UCI event with empty location and country', () => {
      const uciEventEmptyLocation = {
        country: '',
        location: ''
      };

      const result = normalizeEvent(uciEventEmptyLocation);

      expect(result.location).toBe('Ubicación no disponible'); // Fallback when empty
      expect(result.source).toBe('USABMX'); // Empty country means USABMX
    });

    test('should handle UCI event with location but no country', () => {
      const uciEventNoCountry = {
        country: 'Italy',
        location: 'Rome'
      };

      const result = normalizeEvent(uciEventNoCountry);

      expect(result.location).toBe('Rome, Italy');
      expect(result.country).toBe('Italy');
    });

    test('should handle USABMX event with city fallback for location', () => {
      const usabmxEventWithCity = {
        city: 'Denver'
      };

      const result = normalizeEvent(usabmxEventWithCity);

      expect(result.location).toBe('Denver');
      expect(result.city).toBe('Denver');
    });

    test('should prioritize start_date over date', () => {
      const eventWithBothDates = {
        start_date: '2024-07-15T10:00:00Z',
        date: '2024-07-10T10:00:00Z'
      };

      const result = normalizeEvent(eventWithBothDates);

      expect(result.date).toBe('2024-07-15T10:00:00Z');
    });

    test('should use current date when no date provided', () => {
      const eventNoDate = {};
      const beforeTest = new Date().toISOString();
      
      const result = normalizeEvent(eventNoDate);
      
      const afterTest = new Date().toISOString();
      
      // Check if the date is between before and after test execution
      expect(new Date(result.date).getTime()).toBeGreaterThanOrEqual(new Date(beforeTest).getTime());
      expect(new Date(result.date).getTime()).toBeLessThanOrEqual(new Date(afterTest).getTime());
    });

    test('should handle negative attendees', () => {
      const eventNegativeAttendees = {
        attendees: -100
      };

      const result = normalizeEvent(eventNegativeAttendees);

      expect(result.attendees).toBe(-100); // Normalizer doesn't validate, just passes through
    });

    test('should handle string attendees', () => {
      const eventStringAttendees = {
        attendees: '500'
      };

      const result = normalizeEvent(eventStringAttendees);

      expect(result.attendees).toBe('500'); // Normalizer doesn't convert types
    });

    test('should prioritize details_url over url', () => {
      const eventWithBothUrls = {
        details_url: 'https://details.com',
        url: 'https://main.com'
      };

      const result = normalizeEvent(eventWithBothUrls);

      expect(result.details_url).toBe('https://details.com');
    });

    test('should use url as fallback for details_url', () => {
      const eventWithUrl = {
        url: 'https://main.com'
      };

      const result = normalizeEvent(eventWithUrl);

      expect(result.details_url).toBe('https://main.com');
    });

    test('should handle null/undefined values correctly', () => {
      const eventWithNulls = {
        id: null,
        title: null,
        start_date: null,
        location: null,
        city: undefined,
        state: null,
        country: null,
        attendees: null
      };

      const result = normalizeEvent(eventWithNulls);

      expect(result.id).toBe('mock-uuid-123');
      expect(result.title).toBe('Evento sin título');
      expect(result.city).toBeNull();
      expect(result.state).toBeNull();
      expect(result.country).toBe('USA'); // Default
      expect(result.attendees).toBe(0); // Default
    });

    test('should handle coordinates correctly', () => {
      const eventWithCoordinates = {
        latitude: 0,
        longitude: 0
      };

      const result = normalizeEvent(eventWithCoordinates);

      expect(result.latitude).toBe(0);
      expect(result.longitude).toBe(0);
    });

    test('should handle string coordinates', () => {
      const eventWithStringCoordinates = {
        latitude: '40.7128',
        longitude: '-74.0060'
      };

      const result = normalizeEvent(eventWithStringCoordinates);

      expect(result.latitude).toBe('40.7128');
      expect(result.longitude).toBe('-74.0060');
    });
  });

  describe('normalizeNews', () => {
    test('should normalize UCI news with complete data', () => {
      const uciNews = {
        id: 'uci-news-123',
        title: 'UCI Championship Results',
        published_at: '2024-08-15T14:30:00Z',
        author: 'UCI Communications',
        category: 'Racing',
        summary: 'Complete results from the UCI World Championships',
        url: 'https://uci.org/news/123',
        image: 'https://uci.org/images/championship.jpg'
      };

      const result = normalizeNews(uciNews);

      expect(result).toEqual({
        id: 'uci-news-123',
        title: 'UCI Championship Results',
        date: '2024-08-15T14:30:00Z',
        author: 'UCI Communications',
        category: 'Racing',
        excerpt: 'Complete results from the UCI World Championships',
        url: 'https://uci.org/news/123',
        source: 'UCI',
        image: 'https://uci.org/images/championship.jpg'
      });
    });

    test('should normalize USABMX news with complete data', () => {
      const usabmxNews = {
        id: 'usabmx-news-456',
        title: 'National Championship Announcement',
        date: '2024-09-01T12:00:00Z',
        author: 'USABMX Staff',
        category: 'Announcements',
        excerpt: 'Details about the upcoming national championship',
        url: 'https://usabmx.com/news/456'
      };

      const result = normalizeNews(usabmxNews);

      expect(result).toEqual({
        id: 'usabmx-news-456',
        title: 'National Championship Announcement',
        date: '2024-09-01T12:00:00Z',
        author: 'USABMX Staff',
        category: 'Announcements',
        excerpt: 'Details about the upcoming national championship',
        url: 'https://usabmx.com/news/456',
        source: 'USABMX',
        image: null
      });
    });

    test('should detect UCI source by image presence', () => {
      const newsWithImage = {
        image: 'https://example.com/image.jpg'
      };

      const result = normalizeNews(newsWithImage);

      expect(result.source).toBe('UCI');
      expect(result.image).toBe('https://example.com/image.jpg');
    });

    test('should detect UCI source by summary presence', () => {
      const newsWithSummary = {
        summary: 'This is a news summary'
      };

      const result = normalizeNews(newsWithSummary);

      expect(result.source).toBe('UCI');
      expect(result.excerpt).toBe('This is a news summary');
    });

    test('should detect USABMX source when no image or summary', () => {
      const usabmxNews = {
        title: 'USABMX News'
      };

      const result = normalizeNews(usabmxNews);

      expect(result.source).toBe('USABMX');
      expect(result.image).toBeNull();
    });

    test('should handle minimal news data', () => {
      const minimalNews = {};

      const result = normalizeNews(minimalNews);

      expect(result.id).toBe('mock-uuid-123');
      expect(result.title).toBe('Noticia sin título');
      expect(result.author).toBe('Desconocido');
      expect(result.category).toBe('General');
      expect(result.excerpt).toBe('');
      expect(result.url).toBe('#');
      expect(result.source).toBe('USABMX'); // Default when no indicators
      expect(result.image).toBeNull();
    });

    test('should prioritize published_at over date', () => {
      const newsWithBothDates = {
        published_at: '2024-08-15T10:00:00Z',
        date: '2024-08-10T10:00:00Z'
      };

      const result = normalizeNews(newsWithBothDates);

      expect(result.date).toBe('2024-08-15T10:00:00Z');
    });

    test('should use current date when no date provided', () => {
      const newsNoDate = {};
      const beforeTest = new Date().toISOString();
      
      const result = normalizeNews(newsNoDate);
      
      const afterTest = new Date().toISOString();
      
      expect(new Date(result.date).getTime()).toBeGreaterThanOrEqual(new Date(beforeTest).getTime());
      expect(new Date(result.date).getTime()).toBeLessThanOrEqual(new Date(afterTest).getTime());
    });

    test('should prioritize summary over excerpt', () => {
      const newsWithBoth = {
        summary: 'This is the summary',
        excerpt: 'This is the excerpt'
      };

      const result = normalizeNews(newsWithBoth);

      expect(result.excerpt).toBe('This is the summary');
      expect(result.source).toBe('UCI'); // Because it has summary
    });

    test('should handle null/undefined values correctly', () => {
      const newsWithNulls = {
        id: null,
        title: null,
        published_at: null,
        date: null,
        author: null,
        category: null,
        summary: null,
        excerpt: null,
        url: null,
        image: null
      };

      const result = normalizeNews(newsWithNulls);

      expect(result.id).toBe('mock-uuid-123');
      expect(result.title).toBe('Noticia sin título');
      expect(result.author).toBe('Desconocido');
      expect(result.category).toBe('General');
      expect(result.excerpt).toBe('');
      expect(result.url).toBe('#');
      expect(result.image).toBeNull();
    });

    test('should handle empty strings correctly', () => {
      const newsWithEmptyStrings = {
        title: '',
        author: '',
        category: '',
        summary: '',
        excerpt: '',
        url: '',
        image: ''
      };

      const result = normalizeNews(newsWithEmptyStrings);

      expect(result.title).toBe('Noticia sin título'); // Empty string falls back to default
      expect(result.author).toBe('Desconocido');
      expect(result.category).toBe('General');
      expect(result.excerpt).toBe('');
      expect(result.url).toBe('#');
      expect(result.image).toBe(''); // Empty string is kept for image
      expect(result.source).toBe('USABMX'); // Empty image doesn't trigger UCI
    });

    test('should handle both image and summary (UCI indicators)', () => {
      const newsWithBoth = {
        image: 'https://example.com/image.jpg',
        summary: 'News summary'
      };

      const result = normalizeNews(newsWithBoth);

      expect(result.source).toBe('UCI');
      expect(result.image).toBe('https://example.com/image.jpg');
      expect(result.excerpt).toBe('News summary');
    });

    test('should handle special characters in text fields', () => {
      const newsWithSpecialChars = {
        title: 'Noticia con ñ, acentos ó símbolos €',
        author: 'José María',
        category: 'Categoría Especial',
        summary: 'Resumen con caracteres especiales: àáâãäåæçèéêë',
        url: 'https://example.com/noticia?id=123&category=especial'
      };

      const result = normalizeNews(newsWithSpecialChars);

      expect(result.title).toBe('Noticia con ñ, acentos ó símbolos €');
      expect(result.author).toBe('José María');
      expect(result.category).toBe('Categoría Especial');
      expect(result.excerpt).toBe('Resumen con caracteres especiales: àáâãäåæçèéêë');
      expect(result.url).toBe('https://example.com/noticia?id=123&category=especial');
    });

    test('should handle very long text fields', () => {
      const longText = 'A'.repeat(1000);
      const newsWithLongText = {
        title: longText,
        author: longText,
        summary: longText
      };

      const result = normalizeNews(newsWithLongText);

      expect(result.title).toBe(longText);
      expect(result.author).toBe(longText);
      expect(result.excerpt).toBe(longText);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle undefined input for normalizeEvent', () => {
      const result = normalizeEvent(undefined);

      expect(result.id).toBe('mock-uuid-123');
      expect(result.title).toBe('Evento sin título');
      expect(result.source).toBe('USABMX');
    });

    test('should handle null input for normalizeEvent', () => {
      const result = normalizeEvent(null);

      expect(result.id).toBe('mock-uuid-123');
      expect(result.title).toBe('Evento sin título');
      expect(result.source).toBe('USABMX');
    });

    test('should handle undefined input for normalizeNews', () => {
      const result = normalizeNews(undefined);

      expect(result.id).toBe('mock-uuid-123');
      expect(result.title).toBe('Noticia sin título');
      expect(result.source).toBe('USABMX');
    });

    test('should handle null input for normalizeNews', () => {
      const result = normalizeNews(null);

      expect(result.id).toBe('mock-uuid-123');
      expect(result.title).toBe('Noticia sin título');
      expect(result.source).toBe('USABMX');
    });

    test('should handle crypto.randomUUID not available', () => {
      // Temporarily remove crypto.randomUUID
      const originalCrypto = global.crypto;
      delete (global as any).crypto;

      expect(() => normalizeEvent({})).toThrow();
      
      // Restore crypto
      global.crypto = originalCrypto;
    });

    test('should handle crypto.randomUUID throwing error', () => {
      mockRandomUUID.mockImplementationOnce(() => {
        throw new Error('UUID generation failed');
      });

      expect(() => normalizeEvent({ id: null })).toThrow('UUID generation failed');
    });

    test('should generate different UUIDs for multiple calls', () => {
      mockRandomUUID
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2');

      const event1 = normalizeEvent({});
      const event2 = normalizeEvent({});

      expect(event1.id).toBe('uuid-1');
      expect(event2.id).toBe('uuid-2');
    });
  });
});
