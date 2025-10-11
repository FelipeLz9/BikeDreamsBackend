import { Elysia } from 'elysia';
import { PermissionAction, Role } from '@prisma/client';

console.log('🚀 Testing RBAC with real middleware');

// Mock data
const mockAuthUser = {
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
  role: 'CLIENT' as Role,
  isActive: true
};

// Mock ONLY the services that the middleware depends on
const mockPrisma = {
  user: {
    findUnique: jest.fn()
  },
  securityEvent: {
    create: jest.fn()
  }
};

const mockRBACService = {
  checkPermission: jest.fn()
};

const mockAuthService = {
  verifyToken: jest.fn()
};

// Mock only the services, NOT the middleware
jest.mock('../../prisma/client.js', () => ({
  prisma: mockPrisma
}));

jest.mock('../../services/rbacService.js', () => ({
  RBACService: mockRBACService
}));

jest.mock('../../services/authService.js', () => ({
  AuthService: mockAuthService
}));

// Don't mock the middleware, let it run naturally
import { requirePermission } from '../../middleware/rbacMiddleware';

describe('🔐 RBAC Real Middleware Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Configure service mocks for success case
    mockAuthService.verifyToken.mockResolvedValue({
      valid: true,
      payload: { id: 'user-123', email: 'test@example.com' }
    });
    
    mockPrisma.user.findUnique.mockResolvedValue(mockAuthUser);
    mockPrisma.securityEvent.create.mockResolvedValue({});
    
    mockRBACService.checkPermission.mockResolvedValue({
      allowed: true,
      reason: 'Permission granted'
    });
  });

  it('should work with valid token and permission', async () => {
    console.log('🧪 Test: valid token and permission');
    
    const app = new Elysia()
      .use(requirePermission('events', PermissionAction.READ))
      .get('/test', (ctx) => {
        console.log('🎯 Route context:', { 
          hasUser: !!ctx.user,
          isAuthenticated: ctx.isAuthenticated,
          userId: ctx.user?.id,
          availableKeys: Object.keys(ctx).filter(k => !k.startsWith('_'))
        });
        return { message: 'success' };
      });

    const response = await app.handle(new Request('http://localhost/test', {
      headers: {
        'Authorization': 'Bearer valid-token',
        'x-real-ip': '192.168.1.100',
        'user-agent': 'test-agent/1.0'
      }
    }));

    console.log('📊 Response status:', response.status);
    const body = await response.json();
    console.log('📄 Response body:', body);
    
    console.log('🔍 Service calls:');
    console.log('- AuthService calls:', mockAuthService.verifyToken.mock.calls.length);
    console.log('- Prisma calls:', mockPrisma.user.findUnique.mock.calls.length);
    console.log('- RBAC calls:', mockRBACService.checkPermission.mock.calls.length);

    expect(response.status).toBe(200);
    expect(body.message).toBe('success');
    
    // These should be called now
    expect(mockAuthService.verifyToken).toHaveBeenCalledWith('valid-token');
    expect(mockPrisma.user.findUnique).toHaveBeenCalled();
    expect(mockRBACService.checkPermission).toHaveBeenCalled();
  });

  it('should deny access without token', async () => {
    console.log('🧪 Test: no token');
    
    const app = new Elysia()
      .use(requirePermission('events', PermissionAction.READ))
      .get('/test', () => ({ message: 'success' }));

    const response = await app.handle(new Request('http://localhost/test'));

    console.log('📊 Response status (no token):', response.status);
    const body = await response.json();
    console.log('📄 Response body (no token):', body);

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('should deny when RBAC denies permission', async () => {
    console.log('🧪 Test: RBAC denies permission');
    
    // Make RBAC deny the permission
    mockRBACService.checkPermission.mockResolvedValue({
      allowed: false,
      reason: 'Insufficient permissions'
    });
    
    const app = new Elysia()
      .use(requirePermission('events', PermissionAction.READ))
      .get('/test', () => ({ message: 'success' }));

    const response = await app.handle(new Request('http://localhost/test', {
      headers: {
        'Authorization': 'Bearer valid-token',
        'x-real-ip': '192.168.1.100',
        'user-agent': 'test-agent/1.0'
      }
    }));

    console.log('📊 Response status (denied):', response.status);
    const body = await response.json();
    console.log('📄 Response body (denied):', body);

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
    expect(body.message).toBe('Insufficient permissions');
    
    // Should have tried to check permission
    expect(mockRBACService.checkPermission).toHaveBeenCalled();
  });

  it('should deny for invalid token', async () => {
    console.log('🧪 Test: invalid token');
    
    mockAuthService.verifyToken.mockResolvedValue({
      valid: false,
      error: 'Token expired'
    });
    
    const app = new Elysia()
      .use(requirePermission('events', PermissionAction.READ))
      .get('/test', () => ({ message: 'success' }));

    const response = await app.handle(new Request('http://localhost/test', {
      headers: {
        'Authorization': 'Bearer invalid-token'
      }
    }));

    console.log('📊 Response status (invalid token):', response.status);
    const body = await response.json();
    console.log('📄 Response body (invalid token):', body);

    expect(response.status).toBe(401);
    expect(mockAuthService.verifyToken).toHaveBeenCalledWith('invalid-token');
    expect(mockRBACService.checkPermission).not.toHaveBeenCalled();
  });
});