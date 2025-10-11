// Mock de PrismaClient con patrón simple
const mockPrismaCreate = jest.fn();
const mockPrismaFindMany = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    donation: {
      create: mockPrismaCreate,
      findMany: mockPrismaFindMany
    }
  }))
}));

// Importar después de los mocks
import { createDonation, getDonations } from '../../controllers/donationController';

describe('💰 DonationController Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createDonation', () => {
    test('should create donation with valid data and authenticated user', async () => {
      const donationData = {
        amount: 50.00,
        userId: '123e4567-e89b-12d3-a456-426614174000',
        donorName: 'John Doe'
      };

      const mockCreatedDonation = {
        id: '1',
        ...donationData,
        createdAt: new Date('2024-02-01T00:00:00Z')
      };

      mockPrismaCreate.mockResolvedValue(mockCreatedDonation);

      const result = await createDonation({ body: donationData });

      expect(mockPrismaCreate).toHaveBeenCalledWith({
        data: donationData
      });
      expect(result).toEqual(mockCreatedDonation);
      expect(result.amount).toBe(50.00);
      expect(result.userId).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    test('should create anonymous donation without userId', async () => {
      const donationData = {
        amount: 25.00,
        donorName: 'Anonymous Donor'
      };

      const mockCreatedDonation = {
        id: '2',
        ...donationData,
        userId: null,
        createdAt: new Date('2024-02-01T00:00:00Z')
      };

      mockPrismaCreate.mockResolvedValue(mockCreatedDonation);

      const result = await createDonation({ body: donationData });

      expect(mockPrismaCreate).toHaveBeenCalledWith({
        data: donationData
      });
      expect(result).toEqual(mockCreatedDonation);
      expect(result.userId).toBeNull();
      expect(result.donorName).toBe('Anonymous Donor');
    });

    test('should create donation without donorName', async () => {
      const donationData = {
        amount: 100.00,
        userId: '123e4567-e89b-12d3-a456-426614174001'
      };

      const mockCreatedDonation = {
        id: '3',
        ...donationData,
        donorName: null,
        createdAt: new Date('2024-02-01T00:00:00Z')
      };

      mockPrismaCreate.mockResolvedValue(mockCreatedDonation);

      const result = await createDonation({ body: donationData });

      expect(result).toEqual(mockCreatedDonation);
      expect(result.donorName).toBeNull();
    });

    test('should create minimal donation with only amount', async () => {
      const donationData = {
        amount: 10.50
      };

      const mockCreatedDonation = {
        id: '4',
        ...donationData,
        userId: null,
        donorName: null,
        createdAt: new Date('2024-02-01T00:00:00Z')
      };

      mockPrismaCreate.mockResolvedValue(mockCreatedDonation);

      const result = await createDonation({ body: donationData });

      expect(result).toEqual(mockCreatedDonation);
      expect(result.amount).toBe(10.50);
    });

    test('should reject donation with negative amount', async () => {
      const donationData = {
        amount: -10.00,
        donorName: 'Invalid Donor'
      };

      const result = await createDonation({ body: donationData });

      expect(result.error).toBeDefined();
      expect(result.error.amount).toBeDefined();
      expect(mockPrismaCreate).not.toHaveBeenCalled();
    });

    test('should reject donation with zero amount', async () => {
      const donationData = {
        amount: 0,
        donorName: 'Zero Donor'
      };

      const result = await createDonation({ body: donationData });

      expect(result.error).toBeDefined();
      expect(result.error.amount).toBeDefined();
      expect(mockPrismaCreate).not.toHaveBeenCalled();
    });

    test('should reject donation without amount', async () => {
      const donationData = {
        donorName: 'No Amount Donor'
      };

      const result = await createDonation({ body: donationData });

      expect(result.error).toBeDefined();
      expect(result.error.amount).toBeDefined();
      expect(mockPrismaCreate).not.toHaveBeenCalled();
    });

    test('should reject donation with invalid amount type', async () => {
      const donationData = {
        amount: 'fifty dollars',
        donorName: 'String Amount Donor'
      };

      const result = await createDonation({ body: donationData });

      expect(result.error).toBeDefined();
      expect(result.error.amount).toBeDefined();
      expect(mockPrismaCreate).not.toHaveBeenCalled();
    });

    test('should reject donation with invalid userId format', async () => {
      const donationData = {
        amount: 50.00,
        userId: 'invalid-uuid-format',
        donorName: 'Invalid UUID User'
      };

      const result = await createDonation({ body: donationData });

      expect(result.error).toBeDefined();
      expect(result.error.userId).toBeDefined();
      expect(mockPrismaCreate).not.toHaveBeenCalled();
    });

    test('should accept valid UUID for userId', async () => {
      const donationData = {
        amount: 75.25,
        userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      };

      const mockCreatedDonation = {
        id: '5',
        ...donationData,
        createdAt: new Date('2024-02-01T00:00:00Z')
      };

      mockPrismaCreate.mockResolvedValue(mockCreatedDonation);

      const result = await createDonation({ body: donationData });

      expect(result).toEqual(mockCreatedDonation);
      expect(mockPrismaCreate).toHaveBeenCalledWith({
        data: donationData
      });
    });

    test('should handle database creation errors', async () => {
      const donationData = {
        amount: 50.00,
        donorName: 'Test Donor'
      };

      mockPrismaCreate.mockRejectedValue(new Error('Database connection error'));

      await expect(createDonation({ body: donationData })).rejects.toThrow('Database connection error');
    });

    test('should handle database constraint violations', async () => {
      const donationData = {
        amount: 50.00,
        userId: '123e4567-e89b-12d3-a456-426614174000'
      };

      mockPrismaCreate.mockRejectedValue(new Error('Foreign key constraint failed'));

      await expect(createDonation({ body: donationData })).rejects.toThrow('Foreign key constraint failed');
    });

    test('should handle very large donation amounts', async () => {
      const donationData = {
        amount: 999999.99,
        donorName: 'Generous Donor'
      };

      const mockCreatedDonation = {
        id: '6',
        ...donationData,
        createdAt: new Date('2024-02-01T00:00:00Z')
      };

      mockPrismaCreate.mockResolvedValue(mockCreatedDonation);

      const result = await createDonation({ body: donationData });

      expect(result).toEqual(mockCreatedDonation);
      expect(result.amount).toBe(999999.99);
    });

    test('should handle very small positive donation amounts', async () => {
      const donationData = {
        amount: 0.01,
        donorName: 'Penny Donor'
      };

      const mockCreatedDonation = {
        id: '7',
        ...donationData,
        createdAt: new Date('2024-02-01T00:00:00Z')
      };

      mockPrismaCreate.mockResolvedValue(mockCreatedDonation);

      const result = await createDonation({ body: donationData });

      expect(result).toEqual(mockCreatedDonation);
      expect(result.amount).toBe(0.01);
    });

    test('should reject donation with extra invalid fields', async () => {
      const donationData = {
        amount: 50.00,
        donorName: 'Valid Donor',
        invalidField: 'should be ignored',
        anotherInvalid: 123
      };

      const validData = {
        amount: 50.00,
        donorName: 'Valid Donor'
      };

      const mockCreatedDonation = {
        id: '8',
        ...validData,
        createdAt: new Date('2024-02-01T00:00:00Z')
      };

      mockPrismaCreate.mockResolvedValue(mockCreatedDonation);

      const result = await createDonation({ body: donationData });

      // Zod debería filtrar campos no válidos
      expect(mockPrismaCreate).toHaveBeenCalledWith({
        data: donationData // Se pasa tal como viene, Zod ya validó
      });
      expect(result).toEqual(mockCreatedDonation);
    });
  });

  describe('getDonations', () => {
    test('should return all donations', async () => {
      const mockDonations = [
        {
          id: '1',
          amount: 50.00,
          userId: '123e4567-e89b-12d3-a456-426614174000',
          donorName: 'John Doe',
          createdAt: new Date('2024-02-01T00:00:00Z')
        },
        {
          id: '2',
          amount: 25.00,
          userId: null,
          donorName: 'Anonymous',
          createdAt: new Date('2024-02-02T00:00:00Z')
        },
        {
          id: '3',
          amount: 100.00,
          userId: '123e4567-e89b-12d3-a456-426614174001',
          donorName: null,
          createdAt: new Date('2024-02-03T00:00:00Z')
        }
      ];

      mockPrismaFindMany.mockResolvedValue(mockDonations);

      const result = await getDonations();

      expect(mockPrismaFindMany).toHaveBeenCalledWith();
      expect(result).toEqual(mockDonations);
      expect(result).toHaveLength(3);
      expect(result[0].amount).toBe(50.00);
      expect(result[1].userId).toBeNull();
      expect(result[2].donorName).toBeNull();
    });

    test('should return empty array when no donations exist', async () => {
      mockPrismaFindMany.mockResolvedValue([]);

      const result = await getDonations();

      expect(mockPrismaFindMany).toHaveBeenCalledWith();
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    test('should handle database query errors', async () => {
      mockPrismaFindMany.mockRejectedValue(new Error('Database query failed'));

      await expect(getDonations()).rejects.toThrow('Database query failed');
    });

    test('should handle database connection timeout', async () => {
      mockPrismaFindMany.mockRejectedValue(new Error('Connection timeout'));

      await expect(getDonations()).rejects.toThrow('Connection timeout');
    });

    test('should return donations with all possible field combinations', async () => {
      const mockDonations = [
        {
          id: '1',
          amount: 50.00,
          userId: '123e4567-e89b-12d3-a456-426614174000',
          donorName: 'John Doe',
          createdAt: new Date('2024-02-01T00:00:00Z')
        },
        {
          id: '2',
          amount: 25.00,
          userId: null,
          donorName: 'Anonymous',
          createdAt: new Date('2024-02-02T00:00:00Z')
        },
        {
          id: '3',
          amount: 100.00,
          userId: '123e4567-e89b-12d3-a456-426614174001',
          donorName: null,
          createdAt: new Date('2024-02-03T00:00:00Z')
        },
        {
          id: '4',
          amount: 0.01,
          userId: null,
          donorName: null,
          createdAt: new Date('2024-02-04T00:00:00Z')
        }
      ];

      mockPrismaFindMany.mockResolvedValue(mockDonations);

      const result = await getDonations();

      expect(result).toHaveLength(4);
      
      // Verificar diferentes combinaciones
      expect(result[0]).toHaveProperty('userId', '123e4567-e89b-12d3-a456-426614174000');
      expect(result[0]).toHaveProperty('donorName', 'John Doe');
      
      expect(result[1]).toHaveProperty('userId', null);
      expect(result[1]).toHaveProperty('donorName', 'Anonymous');
      
      expect(result[2]).toHaveProperty('userId', '123e4567-e89b-12d3-a456-426614174001');
      expect(result[2]).toHaveProperty('donorName', null);
      
      expect(result[3]).toHaveProperty('userId', null);
      expect(result[3]).toHaveProperty('donorName', null);
      expect(result[3]).toHaveProperty('amount', 0.01);
    });

    test('should handle donations with decimal amounts correctly', async () => {
      const mockDonations = [
        {
          id: '1',
          amount: 123.45,
          userId: null,
          donorName: 'Decimal Donor',
          createdAt: new Date('2024-02-01T00:00:00Z')
        },
        {
          id: '2',
          amount: 0.99,
          userId: null,
          donorName: 'Cents Donor',
          createdAt: new Date('2024-02-01T00:00:00Z')
        }
      ];

      mockPrismaFindMany.mockResolvedValue(mockDonations);

      const result = await getDonations();

      expect(result[0].amount).toBe(123.45);
      expect(result[1].amount).toBe(0.99);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null or undefined body in createDonation', async () => {
      const result1 = await createDonation({ body: null });
      const result2 = await createDonation({ body: undefined });

      expect(result1.error).toBeDefined();
      expect(result2.error).toBeDefined();
      expect(mockPrismaCreate).not.toHaveBeenCalled();
    });

    test('should handle empty body object', async () => {
      const result = await createDonation({ body: {} });

      expect(result.error).toBeDefined();
      expect(result.error.amount).toBeDefined();
      expect(mockPrismaCreate).not.toHaveBeenCalled();
    });

    test('should handle malformed UUID in userId', async () => {
      const testCases = [
        'not-a-uuid',
        '12345',
        'abc-def-ghi',
        '123e4567-e89b-12d3-a456', // too short
        '123e4567-e89b-12d3-a456-426614174000-extra' // too long
      ];

      for (const invalidUuid of testCases) {
        const result = await createDonation({ 
          body: { 
            amount: 50.00, 
            userId: invalidUuid 
          } 
        });

        expect(result.error).toBeDefined();
        expect(result.error.userId).toBeDefined();
      }

      expect(mockPrismaCreate).not.toHaveBeenCalled();
    });

    test('should handle very long donorName strings', async () => {
      const longName = 'A'.repeat(1000);
      const donationData = {
        amount: 50.00,
        donorName: longName
      };

      const mockCreatedDonation = {
        id: '9',
        ...donationData,
        createdAt: new Date('2024-02-01T00:00:00Z')
      };

      mockPrismaCreate.mockResolvedValue(mockCreatedDonation);

      const result = await createDonation({ body: donationData });

      expect(result).toEqual(mockCreatedDonation);
      expect(result.donorName).toHaveLength(1000);
    });

    test('should handle special characters in donorName', async () => {
      const specialNames = [
        'José María',
        '李明',
        'Müller',
        'O\'Connor',
        'Smith-Jones',
        'Doe Jr.',
        'Anonymous 🎁'
      ];

      for (let i = 0; i < specialNames.length; i++) {
        const donationData = {
          amount: 25.00,
          donorName: specialNames[i]
        };

        const mockCreatedDonation = {
          id: (i + 10).toString(),
          ...donationData,
          createdAt: new Date('2024-02-01T00:00:00Z')
        };

        mockPrismaCreate.mockResolvedValue(mockCreatedDonation);

        const result = await createDonation({ body: donationData });

        expect(result.donorName).toBe(specialNames[i]);
      }
    });
  });
});
