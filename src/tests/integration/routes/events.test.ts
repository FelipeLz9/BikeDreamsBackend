import { describe, expect, it, beforeEach, beforeAll, afterAll } from '@jest/globals';
import { Elysia } from 'elysia';
import { eventRoutes } from '../../../routes/events.js';

// Mock de los controladores de eventos
const mockEventController = {
  getEvents: jest.fn(),
  getUpcomingEvents: jest.fn(),
  getPastEvents: jest.fn()
};

jest.mock('../../../controllers/eventController.js', () => mockEventController);

describe('📅 Event Routes Integration Tests', () => {
  let app: Elysia;

  beforeEach(() => {
    jest.clearAllMocks();
    app = new Elysia().use(eventRoutes);
  });

  describe('GET /events', () => {
    const mockEventsData = {
      events: [
        {
          id: '1',
          title: 'BMX Competition Madrid',
          location: 'Madrid Skatepark',
          city: 'Madrid',
          country: 'Spain',
          date: '2024-06-15',
          type: 'competition'
        },
        {
          id: '2',
          title: 'Urban Cycling Tour Barcelona',
          location: 'Barcelona Center',
          city: 'Barcelona',
          country: 'Spain',
          date: '2024-06-20',
          type: 'tour'
        },
        {
          id: '3',
          title: 'Mountain Bike Valencia',
          location: 'Valencia Hills',
          city: 'Valencia',
          country: 'Spain',
          date: '2024-06-25',
          type: 'mountain'
        }
      ],
      sources: ['internal', 'external_api'],
      total: 3
    };

    it('should get all events without search query', async () => {
      mockEventController.getEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(new Request('http://localhost/events'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        total: 3,
        events: mockEventsData.events,
        sources: mockEventsData.sources,
        filtered: false
      });

      expect(mockEventController.getEvents).toHaveBeenCalledTimes(1);
    });

    it('should filter events by search query in title', async () => {
      mockEventController.getEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(
        new Request('http://localhost/events?q=BMX')
      );

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.total).toBe(1);
      expect(responseBody.events).toHaveLength(1);
      expect(responseBody.events[0].title).toContain('BMX');
      expect(responseBody.filtered).toBe(true);
    });

    it('should filter events by search query in location', async () => {
      mockEventController.getEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(
        new Request('http://localhost/events?q=madrid')
      );

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.total).toBe(1);
      expect(responseBody.events).toHaveLength(1);
      expect(responseBody.events[0].city.toLowerCase()).toBe('madrid');
      expect(responseBody.filtered).toBe(true);
    });

    it('should filter events by search query in city', async () => {
      mockEventController.getEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(
        new Request('http://localhost/events?q=barcelona')
      );

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.total).toBe(1);
      expect(responseBody.events[0].city.toLowerCase()).toBe('barcelona');
      expect(responseBody.filtered).toBe(true);
    });

    it('should filter events by search query in country', async () => {
      mockEventController.getEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(
        new Request('http://localhost/events?q=spain')
      );

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.total).toBe(3); // Todos los eventos son en España
      expect(responseBody.filtered).toBe(true);
    });

    it('should return empty results for non-matching search', async () => {
      mockEventController.getEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(
        new Request('http://localhost/events?q=nonexistent')
      );

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.total).toBe(0);
      expect(responseBody.events).toHaveLength(0);
      expect(responseBody.filtered).toBe(true);
    });

    it('should be case insensitive for search queries', async () => {
      mockEventController.getEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(
        new Request('http://localhost/events?q=BARCELONA')
      );

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.total).toBe(1);
      expect(responseBody.events[0].city.toLowerCase()).toBe('barcelona');
    });

    it('should handle multiple search terms', async () => {
      mockEventController.getEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(
        new Request('http://localhost/events?q=urban cycling')
      );

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.total).toBe(1);
      expect(responseBody.events[0].title.toLowerCase()).toContain('urban');
      expect(responseBody.events[0].title.toLowerCase()).toContain('cycling');
    });

    it('should handle empty search query', async () => {
      mockEventController.getEvents.mockResolvedValue(mockEventsData);

      const response = await app.handle(
        new Request('http://localhost/events?q=')
      );

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.total).toBe(3);
      expect(responseBody.filtered).toBe(false); // Empty string is falsy
    });

    it('should handle controller errors gracefully', async () => {
      mockEventController.getEvents.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await app.handle(new Request('http://localhost/events'));

      expect(response.status).toBe(500);
    });
  });

  describe('GET /events/upcoming', () => {
    const mockUpcomingEvents = {
      events: [
        {
          id: '1',
          title: 'Next Week BMX Competition',
          date: '2024-07-01',
          location: 'Future Park'
        },
        {
          id: '2',
          title: 'Monthly Mountain Bike Tour',
          date: '2024-07-15',
          location: 'Mountain Range'
        }
      ],
      total: 2,
      sources: ['internal']
    };

    it('should get upcoming events successfully', async () => {
      mockEventController.getUpcomingEvents.mockResolvedValue(mockUpcomingEvents);

      const response = await app.handle(
        new Request('http://localhost/events/upcoming')
      );

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockUpcomingEvents);
      expect(mockEventController.getUpcomingEvents).toHaveBeenCalledTimes(1);
    });

    it('should handle empty upcoming events', async () => {
      mockEventController.getUpcomingEvents.mockResolvedValue({
        events: [],
        total: 0,
        sources: []
      });

      const response = await app.handle(
        new Request('http://localhost/events/upcoming')
      );

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.events).toHaveLength(0);
      expect(responseBody.total).toBe(0);
    });

    it('should handle controller errors', async () => {
      mockEventController.getUpcomingEvents.mockRejectedValue(
        new Error('Service unavailable')
      );

      const response = await app.handle(
        new Request('http://localhost/events/upcoming')
      );

      expect(response.status).toBe(500);
    });
  });

  describe('GET /events/past', () => {
    const mockPastEvents = {
      events: [
        {
          id: '10',
          title: 'Last Month BMX Championship',
          date: '2024-04-20',
          location: 'Historic Park'
        },
        {
          id: '11',
          title: 'Spring Cycling Festival',
          date: '2024-04-15',
          location: 'City Center'
        }
      ],
      total: 2,
      sources: ['internal', 'archive']
    };

    it('should get past events successfully', async () => {
      mockEventController.getPastEvents.mockResolvedValue(mockPastEvents);

      const response = await app.handle(
        new Request('http://localhost/events/past')
      );

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockPastEvents);
      expect(mockEventController.getPastEvents).toHaveBeenCalledTimes(1);
    });

    it('should handle empty past events', async () => {
      mockEventController.getPastEvents.mockResolvedValue({
        events: [],
        total: 0,
        sources: []
      });

      const response = await app.handle(
        new Request('http://localhost/events/past')
      );

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.events).toHaveLength(0);
      expect(responseBody.total).toBe(0);
    });

    it('should handle controller errors', async () => {
      mockEventController.getPastEvents.mockRejectedValue(
        new Error('Archive service down')
      );

      const response = await app.handle(
        new Request('http://localhost/events/past')
      );

      expect(response.status).toBe(500);
    });
  });

  describe('Route Parameters and Query Handling', () => {
    it('should handle multiple query parameters', async () => {
      mockEventController.getEvents.mockResolvedValue({
        events: [],
        sources: [],
        total: 0
      });

      const response = await app.handle(
        new Request('http://localhost/events?q=test&other=param')
      );

      expect(response.status).toBe(200);
      expect(mockEventController.getEvents).toHaveBeenCalled();
    });

    it('should handle special characters in search query', async () => {
      mockEventController.getEvents.mockResolvedValue({
        events: [
          {
            id: '1',
            title: 'BMX & Mountain Bike Festival',
            location: 'Test Location',
            city: 'Test City',
            country: 'Test Country'
          }
        ],
        sources: ['test'],
        total: 1
      });

      const response = await app.handle(
        new Request('http://localhost/events?q=BMX%20%26%20Mountain')
      );

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.total).toBe(1);
    });

    it('should handle URL encoded search queries', async () => {
      mockEventController.getEvents.mockResolvedValue({
        events: [
          {
            id: '1',
            title: 'Test Event',
            location: 'Location with spaces',
            city: 'Test City',
            country: 'Test Country'
          }
        ],
        sources: ['test'],
        total: 1
      });

      const response = await app.handle(
        new Request('http://localhost/events?q=Location%20with%20spaces')
      );

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.total).toBe(1);
    });
  });

  describe('Response Format Validation', () => {
    it('should return consistent response format for all endpoints', async () => {
      const mockData = {
        events: [{ id: '1', title: 'Test Event' }],
        sources: ['test'],
        total: 1
      };

      // Test all endpoints return similar structure
      mockEventController.getEvents.mockResolvedValue(mockData);
      mockEventController.getUpcomingEvents.mockResolvedValue(mockData);
      mockEventController.getPastEvents.mockResolvedValue(mockData);

      const endpoints = ['/events', '/events/upcoming', '/events/past'];
      
      for (const endpoint of endpoints) {
        const response = await app.handle(
          new Request(`http://localhost${endpoint}`)
        );
        
        expect(response.status).toBe(200);
        
        const body = await response.json();
        expect(body).toHaveProperty('events');
        expect(Array.isArray(body.events)).toBe(true);
        
        // Check additional properties for main events endpoint
        if (endpoint === '/events') {
          expect(body).toHaveProperty('total');
          expect(body).toHaveProperty('sources');
          expect(body).toHaveProperty('filtered');
        }
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null events from controller', async () => {
      mockEventController.getEvents.mockResolvedValue({
        events: null,
        sources: [],
        total: 0
      });

      const response = await app.handle(new Request('http://localhost/events'));
      expect(response.status).toBe(500);
    });

    it('should handle invalid query parameter types', async () => {
      mockEventController.getEvents.mockResolvedValue({
        events: [],
        sources: [],
        total: 0
      });

      // Test with non-string query parameter (simulated)
      const response = await app.handle(
        new Request('http://localhost/events?q[]=test')
      );

      expect(response.status).toBe(200);
    });

    it('should handle very long search queries', async () => {
      mockEventController.getEvents.mockResolvedValue({
        events: [],
        sources: [],
        total: 0
      });

      const longQuery = 'a'.repeat(1000);
      const response = await app.handle(
        new Request(`http://localhost/events?q=${longQuery}`)
      );

      expect(response.status).toBe(200);
    });
  });
});
