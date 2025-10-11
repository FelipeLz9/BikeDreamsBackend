import { Elysia } from 'elysia';
import { Role, PermissionAction } from '@prisma/client';

console.log('🚀 Starting REAL RBAC Middleware Integration Tests');

// Mock data - usuarios con diferentes roles para testing
const mockUsers = {
  client: {
    id: 'user-client-123',
    name: 'Client User',
    email: 'client@example.com',
    role: 'CLIENT' as Role,
    isActive: true,
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  moderator: {
    id: 'user-moderator-456',
    name: 'Moderator User',
    email: 'moderator@example.com',
    role: 'MODERATOR' as Role,
    isActive: true,
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  admin: {
    id: 'user-admin-789',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'ADMIN' as Role,
    isActive: true,
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  superAdmin: {
    id: 'user-superadmin-000',
    name: 'Super Admin',
    email: 'superadmin@example.com',
    role: 'SUPER_ADMIN' as Role,
    isActive: true,
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  }
};

// Mock services (database and business logic)
const mockPrisma = {
  user: {
    findUnique: jest.fn()
  },
  securityEvent: {
    create: jest.fn()
  }
};

const mockAuthService = {
  verifyToken: jest.fn()
};

const mockRBACService = {
  checkPermission: jest.fn(),
  canManageUser: jest.fn()
};

const mockRbacController = {
  getRoles: jest.fn(),
  getPermissions: jest.fn(),
  getUserPermissions: jest.fn(),
  assignUserRole: jest.fn(),
  revokeUserRole: jest.fn(),
  grantUserPermission: jest.fn(),
  revokeUserPermission: jest.fn(),
  getUsersWithRoles: jest.fn(),
  checkUserPermission: jest.fn(),
  getRBACStats: jest.fn(),
  initializePermissions: jest.fn()
};

// Mock only the services, not the middleware
jest.mock('../../prisma/client.js', () => ({
  prisma: mockPrisma
}));

jest.mock('../../services/authService.js', () => ({
  AuthService: mockAuthService
}));

jest.mock('../../services/rbacService.js', () => ({
  RBACService: mockRBACService,
  ROLE_HIERARCHY: {
    SUPER_ADMIN: { level: 100 },
    ADMIN: { level: 90 },
    MODERATOR: { level: 70 },
    EDITOR: { level: 60 },
    EVENT_MANAGER: { level: 50 },
    USER_MANAGER: { level: 50 },
    VIEWER: { level: 30 },
    CLIENT: { level: 20 },
    GUEST: { level: 10 }
  }
}));

jest.mock('../../controllers/rbacController.js', () => mockRbacController);

// Import the real routes with real middleware
import { rbacRoutes } from '../../routes/rbac';

describe('🔐 RBAC Middleware - Real Integration Tests', () => {
  let app: Elysia;

  // Helper to create valid JWT tokens for different users
  const createToken = (userType: keyof typeof mockUsers) => {
    return `valid-token-${userType}`;
  };

  // Helper to create request headers with auth
  const createAuthHeaders = (userType: keyof typeof mockUsers) => ({
    'Authorization': `Bearer ${createToken(userType)}`,
    'x-real-ip': '192.168.1.100',
    'user-agent': 'test-agent/1.0',
    'Content-Type': 'application/json'
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default successful responses
    mockPrisma.securityEvent.create.mockResolvedValue({});
    mockRBACService.checkPermission.mockResolvedValue({
      allowed: true,
      reason: 'Permission granted'
    });
    mockRBACService.canManageUser.mockResolvedValue(true);

    // Setup auth service to validate tokens
    mockAuthService.verifyToken.mockImplementation((token: string) => {
      if (token.startsWith('valid-token-')) {
        const userType = token.replace('valid-token-', '') as keyof typeof mockUsers;
        return Promise.resolve({
          valid: true,
          payload: { id: mockUsers[userType].id, email: mockUsers[userType].email }
        });
      }
      return Promise.resolve({ valid: false, error: 'Invalid token' });
    });

    // Setup user lookups
    mockPrisma.user.findUnique.mockImplementation(({ where }: any) => {
      const user = Object.values(mockUsers).find(u => u.id === where.id);
      return Promise.resolve(user || null);
    });

    // Setup controller default responses
    mockRbacController.getUserPermissions.mockResolvedValue({
      success: true,
      data: { permissions: [] }
    });
    mockRbacController.getRoles.mockResolvedValue({
      success: true,
      data: { roles: [] }
    });

    // Create app with real middleware
    app = new Elysia().use(rbacRoutes);
  });

  describe('🔒 Authentication Layer', () => {
    it('should deny access without token', async () => {
      console.log('🧪 Test: No token provided');
      
      const response = await app.handle(new Request('http://localhost/rbac/my-permissions'));
      
      console.log('📊 Response status (no token):', response.status);
      const body = await response.json();
      console.log('📄 Response body (no token):', body);

      expect(response.status).toBe(401);
      expect(body.error).toBe('Unauthorized');
    });

    it('should deny access with invalid token', async () => {
      console.log('🧪 Test: Invalid token');
      
      const response = await app.handle(new Request('http://localhost/rbac/my-permissions', {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      }));
      
      console.log('📊 Response status (invalid token):', response.status);
      const body = await response.json();
      console.log('📄 Response body (invalid token):', body);

      expect(response.status).toBe(401);
      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('invalid-token');
    });

    it('should allow access with valid token', async () => {
      console.log('🧪 Test: Valid client token');
      
      const response = await app.handle(new Request('http://localhost/rbac/my-permissions', {
        headers: createAuthHeaders('client')
      }));
      
      console.log('📊 Response status (valid token):', response.status);
      const body = await response.json();
      console.log('📄 Response body (valid token):', body);

      expect(response.status).toBe(200);
      expect(mockAuthService.verifyToken).toHaveBeenCalledWith(createToken('client'));
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUsers.client.id }
        })
      );
    });
  });

  describe('🎭 Role-Based Access Control', () => {
    it('should allow CLIENT access to /my-permissions (public route)', async () => {
      console.log('🧪 Test: Client accessing own permissions');
      
      const response = await app.handle(new Request('http://localhost/rbac/my-permissions', {
        headers: createAuthHeaders('client')
      }));
      
      expect(response.status).toBe(200);
      expect(mockRbacController.getUserPermissions).toHaveBeenCalledWith({
        params: { userId: mockUsers.client.id }
      });
    });

    it('should allow MODERATOR access to /roles', async () => {
      console.log('🧪 Test: Moderator accessing roles');
      
      const response = await app.handle(new Request('http://localhost/rbac/roles', {
        headers: createAuthHeaders('moderator')
      }));
      
      expect(response.status).toBe(200);
      expect(mockRbacController.getRoles).toHaveBeenCalled();
    });

    it('should allow ADMIN access to user permissions', async () => {
      console.log('🧪 Test: Admin accessing user permissions');
      
      const response = await app.handle(new Request('http://localhost/rbac/users/test-user/permissions', {
        headers: createAuthHeaders('admin')
      }));
      
      expect(response.status).toBe(200);
      expect(mockRbacController.getUserPermissions).toHaveBeenCalledWith({
        params: { userId: 'test-user' }
      });
    });

    it('should allow SUPER_ADMIN to initialize system', async () => {
      console.log('🧪 Test: Super Admin initializing system');
      
      const response = await app.handle(new Request('http://localhost/rbac/initialize', {
        method: 'POST',
        headers: createAuthHeaders('superAdmin')
      }));
      
      expect(response.status).toBe(200);
      expect(mockRbacController.initializePermissions).toHaveBeenCalledWith({
        user: expect.objectContaining({ id: mockUsers.superAdmin.id })
      });
    });
  });

  describe('🚫 Access Denial Tests', () => {
    it('should deny CLIENT access to admin routes', async () => {
      console.log('🧪 Test: Client trying to access admin route');
      
      // Mock que el CLIENT no tiene permisos de admin
      mockRBACService.checkPermission.mockResolvedValueOnce({
        allowed: false,
        reason: 'Insufficient admin permissions'
      });
      
      const response = await app.handle(new Request('http://localhost/rbac/users/test-user/permissions', {
        headers: createAuthHeaders('client')
      }));
      
      console.log('📊 Response status (client to admin):', response.status);
      const body = await response.json();
      console.log('📄 Response body (client to admin):', body);

      expect(response.status).toBe(403);
      expect(body.error).toBe('Forbidden');
    });

    it('should deny non-SUPER_ADMIN access to initialize', async () => {
      console.log('🧪 Test: Admin (not super admin) trying to initialize');
      
      const response = await app.handle(new Request('http://localhost/rbac/initialize', {
        method: 'POST',
        headers: createAuthHeaders('admin')
      }));
      
      console.log('📊 Response status (admin to super admin route):', response.status);
      const body = await response.json();
      console.log('📄 Response body (admin to super admin route):', body);

      expect(response.status).toBe(403);
      expect(body.error).toBe('Forbidden');
    });
  });

  describe('🔐 Permission-Based Access', () => {
    it('should check RBAC permissions for restricted actions', async () => {
      console.log('🧪 Test: Permission-based access control');
      
      // Setup specific permission check
      mockRBACService.checkPermission.mockResolvedValueOnce({
        allowed: true,
        reason: 'Has manage users permission'
      });

      const response = await app.handle(new Request('http://localhost/rbac/users/test-user/roles', {
        method: 'POST',
        headers: createAuthHeaders('admin'),
        body: JSON.stringify({ roleName: 'MODERATOR' })
      }));
      
      console.log('📊 Response status (permission check):', response.status);
      
      expect(response.status).toBe(200);
      expect(mockRBACService.checkPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUsers.admin.id,
          resource: expect.any(String),
          action: expect.any(String)
        })
      );
    });

    it('should deny access when RBAC permission check fails', async () => {
      console.log('🧪 Test: Permission denied by RBAC service');
      
      // Setup permission denial
      mockRBACService.checkPermission.mockResolvedValueOnce({
        allowed: false,
        reason: 'User lacks manage users permission'
      });

      const response = await app.handle(new Request('http://localhost/rbac/users/test-user/roles', {
        method: 'POST',
        headers: createAuthHeaders('moderator'),
        body: JSON.stringify({ roleName: 'ADMIN' })
      }));
      
      console.log('📊 Response status (permission denied):', response.status);
      const body = await response.json();
      console.log('📄 Response body (permission denied):', body);

      expect(response.status).toBe(403);
      expect(body.error).toBe('Forbidden');
      expect(body.message).toContain('User lacks manage users permission');
    });
  });

  describe('🛡️ Security Event Logging', () => {
    it('should log unauthorized access attempts', async () => {
      console.log('🧪 Test: Security event logging');
      
      // Setup permission denial
      mockRBACService.checkPermission.mockResolvedValueOnce({
        allowed: false,
        reason: 'Insufficient permissions for this action'
      });

      const response = await app.handle(new Request('http://localhost/rbac/users/test-user/permissions', {
        method: 'POST',
        headers: createAuthHeaders('client'),
        body: JSON.stringify({ action: 'MANAGE_EVENTS', resource: 'events' })
      }));
      
      expect(response.status).toBe(403);
      
      // Should log security event
      expect(mockPrisma.securityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'UNAUTHORIZED_ACCESS',
            userId: mockUsers.client.id,
            ipAddress: '192.168.1.100',
            userAgent: 'test-agent/1.0'
          })
        })
      );
    });
  });

  describe('⚡ Middleware Chain Integration', () => {
    it('should execute full middleware chain for complex routes', async () => {
      console.log('🧪 Test: Full middleware chain execution');
      
      // Setup user management permission check
      mockRBACService.canManageUser.mockResolvedValueOnce(true);

      const response = await app.handle(new Request('http://localhost/rbac/users/target-user/roles', {
        method: 'DELETE',
        headers: createAuthHeaders('admin'),
        body: JSON.stringify({ roleName: 'MODERATOR' })
      }));
      
      console.log('📊 Response status (full chain):', response.status);
      
      expect(response.status).toBe(200);
      
      // Should have gone through:
      // 1. Auth middleware
      expect(mockAuthService.verifyToken).toHaveBeenCalled();
      expect(mockPrisma.user.findUnique).toHaveBeenCalled();
      
      // 2. RBAC middleware layers
      expect(mockRBACService.canManageUser).toHaveBeenCalledWith(
        mockUsers.admin.id, 
        'target-user'
      );
      
      // 3. Controller execution
      expect(mockRbacController.revokeUserRole).toHaveBeenCalledWith({
        params: { userId: 'target-user' },
        body: { roleName: 'MODERATOR' },
        user: expect.objectContaining({ id: mockUsers.admin.id })
      });
    });

    it('should handle errors in middleware chain gracefully', async () => {
      console.log('🧪 Test: Middleware error handling');
      
      // Simulate RBAC service error
      mockRBACService.checkPermission.mockRejectedValueOnce(new Error('RBAC service unavailable'));

      const response = await app.handle(new Request('http://localhost/rbac/users/test-user/permissions', {
        method: 'POST',
        headers: createAuthHeaders('admin'),
        body: JSON.stringify({ action: 'READ_EVENTS', resource: 'events' })
      }));
      
      console.log('📊 Response status (middleware error):', response.status);
      
      // Should handle gracefully (either 403 or 500 depending on error handling)
      expect([403, 500]).toContain(response.status);
    });
  });

  describe('🧪 Edge Cases', () => {
    it('should handle inactive users', async () => {
      console.log('🧪 Test: Inactive user access');
      
      // Mock inactive user
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUsers.client,
        isActive: false
      });

      const response = await app.handle(new Request('http://localhost/rbac/my-permissions', {
        headers: createAuthHeaders('client')
      }));
      
      console.log('📊 Response status (inactive user):', response.status);
      
      expect(response.status).toBe(401);
    });

    it('should handle non-existent user', async () => {
      console.log('🧪 Test: Non-existent user');
      
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      const response = await app.handle(new Request('http://localhost/rbac/my-permissions', {
        headers: createAuthHeaders('client')
      }));
      
      expect(response.status).toBe(401);
    });

    it('should handle malformed request bodies', async () => {
      console.log('🧪 Test: Malformed request body');
      
      const response = await app.handle(new Request('http://localhost/rbac/users/test-user/roles', {
        method: 'POST',
        headers: createAuthHeaders('admin'),
        body: 'invalid-json{'
      }));
      
      console.log('📊 Response status (malformed body):', response.status);
      
      // Should handle gracefully
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});