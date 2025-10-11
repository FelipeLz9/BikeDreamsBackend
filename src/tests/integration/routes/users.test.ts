import { describe, expect, it, beforeEach, beforeAll, afterAll } from '@jest/globals';
import { Elysia } from 'elysia';
import { userRoutes } from '../../../routes/users.js';

// Mock de los controladores de usuarios
const mockUserController = {
  getUsers: jest.fn(),
  getUserById: jest.fn(),
  getMe: jest.fn(),
  updateMe: jest.fn(),
  changePassword: jest.fn()
};

jest.mock('../../../controllers/userController.js', () => mockUserController);

// Mock del middleware de auth
jest.mock('../../../middleware/auth.js', () => ({
  authMiddleware: new (require('elysia').Elysia)().derive(() => ({
    user: { id: 'user-123', name: 'Test User', email: 'test@example.com', role: 'CLIENT' },
    isAuthenticated: true,
    clientIp: '192.168.1.100',
    userAgent: 'test-agent/1.0'
  }))
}));

describe('👥 User Routes Integration Tests', () => {
  let app: Elysia;

  beforeEach(() => {
    jest.clearAllMocks();
    app = new Elysia().use(userRoutes);
  });

  describe('GET /users', () => {
    const mockUsersData = {
      users: [
        {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          role: 'CLIENT',
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          name: 'Jane Smith',
          email: 'jane@example.com',
          role: 'MODERATOR',
          isActive: true,
          createdAt: '2024-01-02T00:00:00Z'
        },
        {
          id: '3',
          name: 'Admin User',
          email: 'admin@example.com',
          role: 'ADMIN',
          isActive: true,
          createdAt: '2024-01-03T00:00:00Z'
        }
      ],
      total: 3,
      page: 1,
      limit: 10
    };

    it('should get all users successfully', async () => {
      mockUserController.getUsers.mockResolvedValue(mockUsersData);

      const response = await app.handle(new Request('http://localhost/users'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockUsersData);
      expect(mockUserController.getUsers).toHaveBeenCalledTimes(1);
    });

    it('should handle empty user list', async () => {
      mockUserController.getUsers.mockResolvedValue({
        users: [],
        total: 0,
        page: 1,
        limit: 10
      });

      const response = await app.handle(new Request('http://localhost/users'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.users).toHaveLength(0);
      expect(responseBody.total).toBe(0);
    });

    it('should handle controller errors gracefully', async () => {
      mockUserController.getUsers.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await app.handle(new Request('http://localhost/users'));

      expect(response.status).toBe(500);
    });

    it('should handle pagination parameters', async () => {
      const paginatedData = {
        users: [mockUsersData.users[0]],
        total: 3,
        page: 1,
        limit: 1
      };

      mockUserController.getUsers.mockResolvedValue(paginatedData);

      const response = await app.handle(
        new Request('http://localhost/users?page=1&limit=1')
      );

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.users).toHaveLength(1);
      expect(responseBody.page).toBe(1);
      expect(responseBody.limit).toBe(1);
    });

    it('should handle search parameters', async () => {
      const searchData = {
        users: [mockUsersData.users[0]],
        total: 1,
        page: 1,
        limit: 10,
        search: 'john'
      };

      mockUserController.getUsers.mockResolvedValue(searchData);

      const response = await app.handle(
        new Request('http://localhost/users?search=john')
      );

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.users).toHaveLength(1);
      expect(responseBody.search).toBe('john');
    });

    it('should handle role filtering', async () => {
      const adminUsers = {
        users: [mockUsersData.users[2]],
        total: 1,
        page: 1,
        limit: 10,
        role: 'ADMIN'
      };

      mockUserController.getUsers.mockResolvedValue(adminUsers);

      const response = await app.handle(
        new Request('http://localhost/users?role=ADMIN')
      );

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.users).toHaveLength(1);
      expect(responseBody.users[0].role).toBe('ADMIN');
    });
  });

  describe('GET /users/me', () => {
    const mockCurrentUser = {
      id: 'user-123',
      name: 'Current User',
      email: 'current@example.com',
      role: 'CLIENT',
      isActive: true,
      profile: {
        avatar: 'avatar-url',
        bio: 'User bio'
      }
    };

    it('should get current user profile successfully', async () => {
      mockUserController.getMe.mockResolvedValue(mockCurrentUser);

      const response = await app.handle(new Request('http://localhost/users/me'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockCurrentUser);
      expect(mockUserController.getMe).toHaveBeenCalledTimes(1);
    });

    it('should handle authentication context', async () => {
      mockUserController.getMe.mockImplementation((context) => {
        expect(context).toHaveProperty('user');
        expect(context.user.id).toBe('user-123');
        return Promise.resolve(mockCurrentUser);
      });

      const response = await app.handle(new Request('http://localhost/users/me'));

      expect(response.status).toBe(200);
    });

    it('should handle controller errors', async () => {
      mockUserController.getMe.mockRejectedValue(
        new Error('User not found')
      );

      const response = await app.handle(new Request('http://localhost/users/me'));

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /users/me', () => {
    const mockUpdateData = {
      name: 'Updated Name',
      bio: 'Updated bio',
      avatar: 'new-avatar-url'
    };

    const mockUpdatedUser = {
      id: 'user-123',
      name: 'Updated Name',
      email: 'current@example.com',
      role: 'CLIENT',
      isActive: true,
      profile: {
        avatar: 'new-avatar-url',
        bio: 'Updated bio'
      },
      updatedAt: '2024-01-15T00:00:00Z'
    };

    it('should update current user profile successfully', async () => {
      mockUserController.updateMe.mockResolvedValue(mockUpdatedUser);

      const response = await app.handle(new Request('http://localhost/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockUpdateData)
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockUpdatedUser);
      expect(responseBody.name).toBe('Updated Name');
      expect(mockUserController.updateMe).toHaveBeenCalledTimes(1);
    });

    it('should handle partial updates', async () => {
      const partialUpdate = { name: 'Only Name Update' };
      const partiallyUpdated = {
        ...mockUpdatedUser,
        name: 'Only Name Update'
      };

      mockUserController.updateMe.mockResolvedValue(partiallyUpdated);

      const response = await app.handle(new Request('http://localhost/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partialUpdate)
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.name).toBe('Only Name Update');
    });

    it('should handle validation errors', async () => {
      mockUserController.updateMe.mockRejectedValue(
        new Error('Invalid email format')
      );

      const response = await app.handle(new Request('http://localhost/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid-email' })
      }));

      expect(response.status).toBe(500);
    });

    it('should handle malformed JSON', async () => {
      const response = await app.handle(new Request('http://localhost/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{'
      }));

      expect(response.status).not.toBe(200);
    });

    it('should handle empty request body', async () => {
      mockUserController.updateMe.mockResolvedValue(mockUpdatedUser);

      const response = await app.handle(new Request('http://localhost/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }));

      expect(response.status).toBe(200);
    });
  });

  describe('PUT /users/me/password', () => {
    const mockPasswordChange = {
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword456',
      confirmPassword: 'newPassword456'
    };

    const mockPasswordChangeResponse = {
      success: true,
      message: 'Contraseña actualizada correctamente',
      timestamp: '2024-01-15T00:00:00Z'
    };

    it('should change password successfully', async () => {
      mockUserController.changePassword.mockResolvedValue(mockPasswordChangeResponse);

      const response = await app.handle(new Request('http://localhost/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockPasswordChange)
      }));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.success).toBe(true);
      expect(responseBody.message).toBe('Contraseña actualizada correctamente');
      expect(mockUserController.changePassword).toHaveBeenCalledTimes(1);
    });

    it('should handle incorrect current password', async () => {
      mockUserController.changePassword.mockRejectedValue(
        new Error('Current password is incorrect')
      );

      const response = await app.handle(new Request('http://localhost/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...mockPasswordChange,
          currentPassword: 'wrongPassword'
        })
      }));

      expect(response.status).toBe(500);
    });

    it('should handle password confirmation mismatch', async () => {
      mockUserController.changePassword.mockRejectedValue(
        new Error('Password confirmation does not match')
      );

      const response = await app.handle(new Request('http://localhost/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...mockPasswordChange,
          confirmPassword: 'differentPassword'
        })
      }));

      expect(response.status).toBe(500);
    });

    it('should handle weak password', async () => {
      mockUserController.changePassword.mockRejectedValue(
        new Error('Password does not meet security requirements')
      );

      const response = await app.handle(new Request('http://localhost/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...mockPasswordChange,
          newPassword: '123'
        })
      }));

      expect(response.status).toBe(500);
    });

    it('should handle missing required fields', async () => {
      mockUserController.changePassword.mockRejectedValue(
        new Error('Current password is required')
      );

      const response = await app.handle(new Request('http://localhost/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword: 'newPassword456'
          // missing currentPassword
        })
      }));

      expect(response.status).toBe(500);
    });
  });

  describe('GET /users/:id', () => {
    const mockUserProfile = {
      id: 'user-456',
      name: 'Public User',
      email: 'public@example.com',
      role: 'CLIENT',
      isActive: true,
      profile: {
        avatar: 'avatar-url',
        bio: 'Public bio',
        location: 'Madrid, Spain'
      },
      publicStats: {
        eventsAttended: 5,
        forumPosts: 12,
        joinedDate: '2023-06-15T00:00:00Z'
      }
    };

    it('should get user by id successfully', async () => {
      mockUserController.getUserById.mockResolvedValue(mockUserProfile);

      const response = await app.handle(new Request('http://localhost/users/user-456'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody).toEqual(mockUserProfile);
      expect(responseBody.id).toBe('user-456');
      expect(mockUserController.getUserById).toHaveBeenCalledTimes(1);
    });

    it('should handle user not found', async () => {
      mockUserController.getUserById.mockRejectedValue(
        new Error('User not found')
      );

      const response = await app.handle(new Request('http://localhost/users/nonexistent-user'));

      expect(response.status).toBe(500);
    });

    it('should handle invalid user id format', async () => {
      mockUserController.getUserById.mockRejectedValue(
        new Error('Invalid user ID format')
      );

      const response = await app.handle(new Request('http://localhost/users/invalid-id'));

      expect(response.status).toBe(500);
    });

    it('should handle inactive users', async () => {
      const inactiveUser = {
        ...mockUserProfile,
        isActive: false
      };

      mockUserController.getUserById.mockResolvedValue(inactiveUser);

      const response = await app.handle(new Request('http://localhost/users/inactive-user'));

      expect(response.status).toBe(200);
      
      const responseBody = await response.json();
      expect(responseBody.isActive).toBe(false);
    });

    it('should pass correct parameters to controller', async () => {
      mockUserController.getUserById.mockImplementation((context) => {
        expect(context).toHaveProperty('params');
        expect(context.params.id).toBe('test-user-123');
        return Promise.resolve(mockUserProfile);
      });

      const response = await app.handle(new Request('http://localhost/users/test-user-123'));

      expect(response.status).toBe(200);
    });
  });

  describe('Route Integration and Error Handling', () => {
    it('should handle requests with various HTTP methods', async () => {
      const endpoints = [
        { path: '/users', method: 'GET' },
        { path: '/users/me', method: 'GET' },
        { path: '/users/me', method: 'PUT' },
        { path: '/users/me/password', method: 'PUT' },
        { path: '/users/test-id', method: 'GET' }
      ];

      for (const endpoint of endpoints) {
        mockUserController.getUsers.mockResolvedValue({ users: [], total: 0 });
        mockUserController.getMe.mockResolvedValue({ id: 'test' });
        mockUserController.updateMe.mockResolvedValue({ id: 'test' });
        mockUserController.changePassword.mockResolvedValue({ success: true });
        mockUserController.getUserById.mockResolvedValue({ id: 'test-id' });

        const requestOptions: RequestInit = {
          method: endpoint.method,
          headers: { 'Content-Type': 'application/json' }
        };

        if (endpoint.method === 'PUT') {
          requestOptions.body = JSON.stringify({});
        }

        const response = await app.handle(
          new Request(`http://localhost${endpoint.path}`, requestOptions)
        );

        expect(response.status).not.toBe(404);
      }
    });

    it('should handle content type validation', async () => {
      mockUserController.updateMe.mockResolvedValue({ id: 'test' });

      const response = await app.handle(new Request('http://localhost/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: 'plain text body'
      }));

      // Should handle non-JSON content gracefully
      expect(response.status).not.toBe(200);
    });

    it('should handle large request bodies', async () => {
      const largeData = {
        name: 'Test User',
        bio: 'A'.repeat(10000) // Large bio
      };

      mockUserController.updateMe.mockResolvedValue({ id: 'test', ...largeData });

      const response = await app.handle(new Request('http://localhost/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(largeData)
      }));

      expect(response.status).toBe(200);
    });

    it('should handle concurrent requests', async () => {
      mockUserController.getUsers.mockResolvedValue({ users: [], total: 0 });
      
      const requests = Array.from({ length: 5 }, (_, i) => 
        app.handle(new Request(`http://localhost/users?page=${i + 1}`))
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockUserController.getUsers).toHaveBeenCalledTimes(5);
    });
  });

  describe('Security and Authentication Context', () => {
    it('should provide authentication context to protected routes', async () => {
      mockUserController.getMe.mockImplementation((context) => {
        expect(context.user).toBeDefined();
        expect(context.isAuthenticated).toBe(true);
        return Promise.resolve({ id: context.user.id });
      });

      const response = await app.handle(new Request('http://localhost/users/me'));

      expect(response.status).toBe(200);
    });

    it('should handle requests with user context properly', async () => {
      mockUserController.updateMe.mockImplementation((context) => {
        expect(context.user.id).toBe('user-123');
        expect(context.user.email).toBe('test@example.com');
        return Promise.resolve({ id: context.user.id });
      });

      const response = await app.handle(new Request('http://localhost/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' })
      }));

      expect(response.status).toBe(200);
    });
  });
});
