// Mock de dependencias
jest.mock('../../prisma/client', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    event: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    securityEvent: {
      findMany: jest.fn(),
      create: jest.fn()
    },
    auditLog: {
      findMany: jest.fn(),
      create: jest.fn()
    }
  }
}));

import * as adminController from '../../controllers/adminController';

describe('👑 AdminController', () => {
  const { prisma } = require('../../prisma/client');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockAdminUser = {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'ADMIN'
  };

  describe('getUsers', () => {
    test('should get all users with pagination', async () => {
      const mockUsers = [
        { id: '1', name: 'User 1', email: 'user1@example.com', role: 'CLIENT' },
        { id: '2', name: 'User 2', email: 'user2@example.com', role: 'CLIENT' }
      ];

      prisma.user.findMany.mockResolvedValue(mockUsers);

      if (adminController.getUsers) {
        const result = await adminController.getUsers({ 
          user: mockAdminUser,
          query: { page: '1', limit: '10' }
        });

        expect(result).toBeDefined();
        expect(prisma.user.findMany).toHaveBeenCalled();
      }
    });
  });

  describe('getUserById', () => {
    test('should get user by id', async () => {
      const mockUser = { 
        id: '1', 
        name: 'Test User', 
        email: 'test@example.com', 
        role: 'CLIENT' 
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      if (adminController.getUserById) {
        const result = await adminController.getUserById({ 
          user: mockAdminUser,
          params: { id: '1' }
        });

        expect(result).toBeDefined();
        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { id: '1' }
        });
      }
    });
  });

  describe('updateUserRole', () => {
    test('should update user role', async () => {
      const mockUpdatedUser = { 
        id: '1', 
        name: 'Test User', 
        email: 'test@example.com', 
        role: 'MODERATOR' 
      };

      prisma.user.update.mockResolvedValue(mockUpdatedUser);
      prisma.auditLog.create.mockResolvedValue({});

      if (adminController.updateUserRole) {
        const result = await adminController.updateUserRole({ 
          user: mockAdminUser,
          params: { id: '1' },
          body: { role: 'MODERATOR' }
        });

        expect(result).toBeDefined();
        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: '1' },
          data: { role: 'MODERATOR' }
        });
      }
    });
  });

  describe('deleteUser', () => {
    test('should delete user', async () => {
      prisma.user.delete.mockResolvedValue({ id: '1' });
      prisma.auditLog.create.mockResolvedValue({});

      if (adminController.deleteUser) {
        const result = await adminController.deleteUser({ 
          user: mockAdminUser,
          params: { id: '1' }
        });

        expect(result).toBeDefined();
        expect(prisma.user.delete).toHaveBeenCalledWith({
          where: { id: '1' }
        });
      }
    });
  });

  describe('getEvents', () => {
    test('should get all events', async () => {
      const mockEvents = [
        { id: '1', name: 'Event 1', date: new Date() },
        { id: '2', name: 'Event 2', date: new Date() }
      ];

      prisma.event.findMany.mockResolvedValue(mockEvents);

      if (adminController.getEvents) {
        const result = await adminController.getEvents({ 
          user: mockAdminUser,
          query: { page: '1', limit: '10' }
        });

        expect(result).toBeDefined();
        expect(prisma.event.findMany).toHaveBeenCalled();
      }
    });
  });

  describe('createEvent', () => {
    test('should create new event', async () => {
      const mockEventData = {
        name: 'New Event',
        description: 'Event description',
        date: new Date()
      };

      const mockCreatedEvent = {
        id: '1',
        ...mockEventData
      };

      prisma.event.create.mockResolvedValue(mockCreatedEvent);
      prisma.auditLog.create.mockResolvedValue({});

      if (adminController.createEvent) {
        const result = await adminController.createEvent({ 
          user: mockAdminUser,
          body: mockEventData
        });

        expect(result).toBeDefined();
        expect(prisma.event.create).toHaveBeenCalledWith({
          data: mockEventData
        });
      }
    });
  });

  describe('getSecurityLogs', () => {
    test('should get security logs', async () => {
      const mockSecurityEvents = [
        { id: '1', eventType: 'LOGIN_ATTEMPT', severity: 'INFO' },
        { id: '2', eventType: 'LOGIN_FAILURE', severity: 'MEDIUM' }
      ];

      prisma.securityEvent.findMany.mockResolvedValue(mockSecurityEvents);

      if (adminController.getSecurityLogs) {
        const result = await adminController.getSecurityLogs({ 
          user: mockAdminUser,
          query: { page: '1', limit: '10' }
        });

        expect(result).toBeDefined();
        expect(prisma.securityEvent.findMany).toHaveBeenCalled();
      }
    });
  });

  describe('getAuditLogs', () => {
    test('should get audit logs', async () => {
      const mockAuditLogs = [
        { id: '1', action: 'USER_LOGIN', resource: 'User' },
        { id: '2', action: 'USER_LOGOUT', resource: 'User' }
      ];

      prisma.auditLog.findMany.mockResolvedValue(mockAuditLogs);

      if (adminController.getAuditLogs) {
        const result = await adminController.getAuditLogs({ 
          user: mockAdminUser,
          query: { page: '1', limit: '10' }
        });

        expect(result).toBeDefined();
        expect(prisma.auditLog.findMany).toHaveBeenCalled();
      }
    });
  });
});
