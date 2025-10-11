// Mock Prisma Client first
const mockPrismaUser = {
  findMany: jest.fn(),
  findUnique: jest.fn()
};

jest.mock('../../prisma/client.js', () => ({
  prisma: {
    user: mockPrismaUser
  }
}));

import { getRiders, getRiderById } from '../../controllers/riderController';

describe('🚴‍♂️ RiderController Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRiders', () => {
    it('should return all CLIENT users (riders) with basic info', async () => {
      const expectedRiders = [
        {
          id: 'rider-1',
          name: 'Juan Pérez',
          racesWon: 5,
          avatar: 'juan.jpg'
        },
        {
          id: 'rider-2', 
          name: 'María García',
          racesWon: 3,
          avatar: 'maria.jpg'
        },
        {
          id: 'rider-3',
          name: 'Carlos López',
          racesWon: 0,
          avatar: null
        }
      ];

      mockPrismaUser.findMany.mockResolvedValue(expectedRiders);

      const result = await getRiders();

      expect(mockPrismaUser.findMany).toHaveBeenCalledWith({
        where: { role: 'CLIENT' },
        select: { 
          id: true, 
          name: true, 
          racesWon: true, 
          avatar: true 
        }
      });
      expect(result).toEqual(expectedRiders);
    });

    it('should return empty array when no riders exist', async () => {
      mockPrismaUser.findMany.mockResolvedValue([]);

      const result = await getRiders();

      expect(result).toEqual([]);
      expect(mockPrismaUser.findMany).toHaveBeenCalledWith({
        where: { role: 'CLIENT' },
        select: { 
          id: true, 
          name: true, 
          racesWon: true, 
          avatar: true 
        }
      });
    });

    it('should handle riders with null values correctly', async () => {
      const ridersWithNulls = [
        {
          id: 'rider-null',
          name: 'Rider Sin Avatar',
          racesWon: 0,
          avatar: null
        },
        {
          id: 'rider-empty',
          name: null,
          racesWon: null,
          avatar: null
        }
      ];

      mockPrismaUser.findMany.mockResolvedValue(ridersWithNulls);

      const result = await getRiders();

      expect(result).toEqual(ridersWithNulls);
      expect(mockPrismaUser.findMany).toHaveBeenCalledWith({
        where: { role: 'CLIENT' },
        select: { 
          id: true, 
          name: true, 
          racesWon: true, 
          avatar: true 
        }
      });
    });

    it('should handle riders with high number of races won', async () => {
      const championRiders = [
        {
          id: 'champion-1',
          name: 'Super Champion',
          racesWon: 999,
          avatar: 'champion.jpg'
        },
        {
          id: 'champion-2',
          name: 'Mega Winner',
          racesWon: 1500,
          avatar: 'winner.jpg'
        }
      ];

      mockPrismaUser.findMany.mockResolvedValue(championRiders);

      const result = await getRiders();

      expect(result).toEqual(championRiders);
      expect(mockPrismaUser.findMany).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaUser.findMany.mockRejectedValue(new Error('Database connection failed'));

      await expect(getRiders())
        .rejects.toThrow('Database connection failed');

      expect(mockPrismaUser.findMany).toHaveBeenCalledWith({
        where: { role: 'CLIENT' },
        select: { 
          id: true, 
          name: true, 
          racesWon: true, 
          avatar: true 
        }
      });
    });

    it('should only filter users with CLIENT role', async () => {
      const allRiders = [
        {
          id: 'client-1',
          name: 'Real Client',
          racesWon: 2,
          avatar: 'client.jpg'
        }
      ];

      mockPrismaUser.findMany.mockResolvedValue(allRiders);

      const result = await getRiders();

      expect(mockPrismaUser.findMany).toHaveBeenCalledWith({
        where: { role: 'CLIENT' },
        select: { 
          id: true, 
          name: true, 
          racesWon: true, 
          avatar: true 
        }
      });
      expect(result).toEqual(allRiders);
    });

    it('should handle very long rider names', async () => {
      const longNameRider = [{
        id: 'long-name-rider',
        name: 'A'.repeat(200), // Very long name
        racesWon: 1,
        avatar: 'long.jpg'
      }];

      mockPrismaUser.findMany.mockResolvedValue(longNameRider);

      const result = await getRiders();

      expect(result).toEqual(longNameRider);
      expect(mockPrismaUser.findMany).toHaveBeenCalled();
    });

    it('should handle database timeout', async () => {
      mockPrismaUser.findMany.mockRejectedValue(new Error('Connection timeout'));

      await expect(getRiders())
        .rejects.toThrow('Connection timeout');

      expect(mockPrismaUser.findMany).toHaveBeenCalled();
    });
  });

  describe('getRiderById', () => {
    const validParams = { params: { id: 'rider-123' } };

    it('should return rider by valid ID with extended info including photos', async () => {
      const expectedRider = {
        id: 'rider-123',
        name: 'Juan Pérez',
        racesWon: 5,
        avatar: 'juan.jpg',
        photos: [
          { id: 'photo-1', url: 'photo1.jpg' },
          { id: 'photo-2', url: 'photo2.jpg' }
        ]
      };

      mockPrismaUser.findUnique.mockResolvedValue(expectedRider);

      const result = await getRiderById(validParams);

      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { id: 'rider-123' },
        select: { 
          id: true, 
          name: true, 
          racesWon: true, 
          avatar: true, 
          photos: true 
        }
      });
      expect(result).toEqual(expectedRider);
    });

    it('should return null for non-existent rider ID', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const result = await getRiderById({ params: { id: 'non-existent' } });

      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent' },
        select: { 
          id: true, 
          name: true, 
          racesWon: true, 
          avatar: true, 
          photos: true 
        }
      });
      expect(result).toBeNull();
    });

    it('should return rider with null photos array', async () => {
      const riderWithoutPhotos = {
        id: 'rider-123',
        name: 'Juan Sin Fotos',
        racesWon: 2,
        avatar: 'juan.jpg',
        photos: null
      };

      mockPrismaUser.findUnique.mockResolvedValue(riderWithoutPhotos);

      const result = await getRiderById(validParams);

      expect(result).toEqual(riderWithoutPhotos);
      expect(mockPrismaUser.findUnique).toHaveBeenCalled();
    });

    it('should return rider with empty photos array', async () => {
      const riderWithEmptyPhotos = {
        id: 'rider-123',
        name: 'Juan Sin Fotos',
        racesWon: 0,
        avatar: null,
        photos: []
      };

      mockPrismaUser.findUnique.mockResolvedValue(riderWithEmptyPhotos);

      const result = await getRiderById(validParams);

      expect(result).toEqual(riderWithEmptyPhotos);
      expect(mockPrismaUser.findUnique).toHaveBeenCalled();
    });

    it('should return rider with multiple photos', async () => {
      const riderWithManyPhotos = {
        id: 'rider-photo-lover',
        name: 'Photo Lover',
        racesWon: 10,
        avatar: 'lover.jpg',
        photos: Array.from({ length: 50 }, (_, i) => ({ 
          id: `photo-${i}`, 
          url: `photo-${i}.jpg` 
        }))
      };

      mockPrismaUser.findUnique.mockResolvedValue(riderWithManyPhotos);

      const result = await getRiderById({ params: { id: 'rider-photo-lover' } });

      expect(result).toEqual(riderWithManyPhotos);
      expect(result.photos).toHaveLength(50);
      expect(mockPrismaUser.findUnique).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockPrismaUser.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(getRiderById(validParams))
        .rejects.toThrow('Database error');

      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { id: 'rider-123' },
        select: { 
          id: true, 
          name: true, 
          racesWon: true, 
          avatar: true, 
          photos: true 
        }
      });
    });

    it('should handle empty ID parameter', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const result = await getRiderById({ params: { id: '' } });

      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { id: '' },
        select: { 
          id: true, 
          name: true, 
          racesWon: true, 
          avatar: true, 
          photos: true 
        }
      });
      expect(result).toBeNull();
    });

    it('should handle UUID format ID', async () => {
      const uuidRider = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'UUID Rider',
        racesWon: 7,
        avatar: 'uuid.jpg',
        photos: [{ id: 'uuid-photo', url: 'uuid-photo.jpg' }]
      };

      mockPrismaUser.findUnique.mockResolvedValue(uuidRider);

      const result = await getRiderById({ 
        params: { id: '550e8400-e29b-41d4-a716-446655440000' } 
      });

      expect(result).toEqual(uuidRider);
      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440000' },
        select: { 
          id: true, 
          name: true, 
          racesWon: true, 
          avatar: true, 
          photos: true 
        }
      });
    });

    it('should handle special characters in ID', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const result = await getRiderById({ 
        params: { id: 'rider-@#$%^&*()' } 
      });

      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { id: 'rider-@#$%^&*()' },
        select: { 
          id: true, 
          name: true, 
          racesWon: true, 
          avatar: true, 
          photos: true 
        }
      });
      expect(result).toBeNull();
    });

    it('should return rider with negative races won', async () => {
      const riderWithNegativeRaces = {
        id: 'rider-negative',
        name: 'Negative Rider',
        racesWon: -1, // Edge case: negative value
        avatar: 'negative.jpg',
        photos: []
      };

      mockPrismaUser.findUnique.mockResolvedValue(riderWithNegativeRaces);

      const result = await getRiderById({ params: { id: 'rider-negative' } });

      expect(result).toEqual(riderWithNegativeRaces);
      expect(mockPrismaUser.findUnique).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing params object in getRiderById', async () => {
      await expect(getRiderById({} as any))
        .rejects.toThrow();
    });

    it('should handle database connection issues in both functions', async () => {
      const connectionError = new Error('Connection refused');
      
      mockPrismaUser.findMany.mockRejectedValue(connectionError);
      mockPrismaUser.findUnique.mockRejectedValue(connectionError);

      await expect(getRiders()).rejects.toThrow('Connection refused');
      
      await expect(getRiderById({ 
        params: { id: 'test-id' } 
      })).rejects.toThrow('Connection refused');
    });

    it('should handle database timeout in both functions', async () => {
      const timeoutError = new Error('Query timeout');
      
      mockPrismaUser.findMany.mockRejectedValue(timeoutError);
      mockPrismaUser.findUnique.mockRejectedValue(timeoutError);

      await expect(getRiders()).rejects.toThrow('Query timeout');
      
      await expect(getRiderById({ 
        params: { id: 'test-id' } 
      })).rejects.toThrow('Query timeout');
    });

    it('should handle very long ID parameter', async () => {
      const veryLongId = 'a'.repeat(1000);
      
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const result = await getRiderById({ params: { id: veryLongId } });

      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { id: veryLongId },
        select: { 
          id: true, 
          name: true, 
          racesWon: true, 
          avatar: true, 
          photos: true 
        }
      });
      expect(result).toBeNull();
    });

    it('should handle malformed database response', async () => {
      // Simulating malformed response from database
      const malformedResponse = {
        id: 'rider-malformed',
        // Missing required fields
        unexpectedField: 'unexpected'
      };

      mockPrismaUser.findUnique.mockResolvedValue(malformedResponse);

      const result = await getRiderById({ params: { id: 'rider-malformed' } });

      expect(result).toEqual(malformedResponse);
      expect(mockPrismaUser.findUnique).toHaveBeenCalled();
    });
  });
});
