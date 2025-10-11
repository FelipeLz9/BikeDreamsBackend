import { getUsers, getUserById, getMe, updateMe, changePassword } from '../../controllers/userController';
import jwt from 'jsonwebtoken';

// Mock Prisma
jest.mock('../../prisma/client', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    }
  }
}));

// Mock JWT
jest.mock('jsonwebtoken');
const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('👤 UserController', () => {
  const { prisma } = require('../../prisma/client');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUsers', () => {
    test('should return all users', async () => {
      const mockUsers = [
        { id: '1', name: 'User 1', email: 'user1@example.com' },
        { id: '2', name: 'User 2', email: 'user2@example.com' }
      ];
      prisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await getUsers();

      expect(result).toEqual(mockUsers);
      expect(prisma.user.findMany).toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    test('should return user by id', async () => {
      const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getUserById({ params: { id: '1' } });

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });

  describe('getMe', () => {
    test('should return current user data with valid token', async () => {
      const mockUser = { 
        id: '1', 
        name: 'Test User', 
        email: 'test@example.com',
        role: 'CLIENT',
        avatar: null,
        racesWon: 0,
        createdAt: new Date()
      };
      
      mockJwt.verify.mockReturnValue({ id: '1', email: 'test@example.com' } as any);
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await getMe({ 
        headers: { authorization: 'Bearer valid-token' }
      });

      expect(result).toEqual(mockUser);
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', expect.any(String));
    });

    test('should return error without authorization header', async () => {
      const result = await getMe({ headers: {} });

      expect(result).toEqual({ error: 'No autorizado' });
    });

    test('should return error with invalid token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await getMe({ 
        headers: { authorization: 'Bearer invalid-token' }
      });

      expect(result).toEqual({ error: 'Token inválido' });
    });
  });

  describe('updateMe', () => {
    test('should update user profile successfully', async () => {
      const mockUpdatedUser = {
        id: '1',
        name: 'Updated Name',
        email: 'test@example.com',
        role: 'CLIENT',
        avatar: 'new-avatar.jpg',
        racesWon: 0,
        createdAt: new Date()
      };

      mockJwt.verify.mockReturnValue({ id: '1', email: 'test@example.com' } as any);
      prisma.user.update.mockResolvedValue(mockUpdatedUser);

      const result = await updateMe({
        headers: { authorization: 'Bearer valid-token' },
        body: { name: 'Updated Name', avatar: 'new-avatar.jpg' }
      });

      expect(result.message).toBe('Perfil actualizado');
      expect(result.user).toEqual(mockUpdatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { name: 'Updated Name', avatar: 'new-avatar.jpg' },
        select: expect.any(Object)
      });
    });
  });
});
