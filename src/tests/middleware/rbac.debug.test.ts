import { Elysia } from 'elysia';
import { PermissionAction, Role } from '@prisma/client';

console.log('🚀 Starting RBAC Debug Test');

// Mock data
const mockAuthUser = {
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
  role: 'CLIENT' as Role,
  isActive: true
};

// Mock de Prisma Client
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  securityEvent: {
    create: jest.fn()
  }
};

console.log('Setting up Prisma mock...');
jest.mock('../../prisma/client.js', () => ({
  prisma: mockPrisma
}));

// Mock del RBACService
const mockRBACService = {
  checkPermission: jest.fn(),
};

console.log('Setting up RBACService mock...');
jest.mock('../../services/rbacService.js', () => ({
  RBACService: mockRBACService
}));

// Mock del AuthService
const mockAuthService = {
  verifyToken: jest.fn()
};

console.log('Setting up AuthService mock...');
jest.mock('../../services/authService.js', () => ({
  AuthService: mockAuthService
}));

// Import the middlewares after setting up mocks
console.log('Importing middlewares...');
import {
  requirePermission
} from '../../middleware/rbacMiddleware';

describe('🔍 RBAC Debug Test', () => {
  beforeEach(() => {
    console.log('🧹 Clearing all mocks');
    jest.clearAllMocks();
    
    // Configurar mocks por defecto
    console.log('⚙️ Setting up default mocks');
    mockRBACService.checkPermission.mockResolvedValue({
      allowed: true,
      reason: 'Permission granted'
    });
    
    mockAuthService.verifyToken.mockResolvedValue({
      valid: true,
      payload: { id: 'user-123', email: 'test@example.com' }
    });
    
    mockPrisma.user.findUnique.mockResolvedValue(mockAuthUser);
    mockPrisma.securityEvent.create.mockResolvedValue({});
  });

  it('should execute middleware and call RBACService', async () => {
    console.log('🧪 Test starting: should execute middleware and call RBACService');
    
    console.log('📦 Creating Elysia app with requirePermission middleware');
    const app = new Elysia()
      .use(requirePermission('events', PermissionAction.READ))
      .get('/test', (ctx) => {
        console.log('🎯 Route handler executed!', { 
          hasUser: !!ctx.user, 
          isAuthenticated: ctx.isAuthenticated,
          userId: ctx.user?.id 
        });
        return { message: 'success' };
      });

    console.log('📋 Creating request with valid token');
    const request = new Request('http://localhost/test', {
      headers: {
        'Authorization': 'Bearer valid-token',
        'x-real-ip': '192.168.1.100',
        'user-agent': 'test-agent/1.0'
      }
    });
    
    console.log('🚀 Making request to app');
    const response = await app.handle(request);
    
    console.log('📊 Response status:', response.status);
    const body = await response.json();
    console.log('📄 Response body:', body);
    
    console.log('🔍 Mock call counts:');
    console.log('- AuthService.verifyToken:', mockAuthService.verifyToken.mock.calls.length);
    console.log('- Prisma.user.findUnique:', mockPrisma.user.findUnique.mock.calls.length);
    console.log('- RBACService.checkPermission:', mockRBACService.checkPermission.mock.calls.length);
    
    if (mockAuthService.verifyToken.mock.calls.length > 0) {
      console.log('✅ AuthService.verifyToken was called with:', mockAuthService.verifyToken.mock.calls[0]);
    } else {
      console.log('❌ AuthService.verifyToken was NOT called');
    }
    
    if (mockRBACService.checkPermission.mock.calls.length > 0) {
      console.log('✅ RBACService.checkPermission was called with:', mockRBACService.checkPermission.mock.calls[0]);
    } else {
      console.log('❌ RBACService.checkPermission was NOT called');
    }

    // Basic assertions
    expect(response.status).toBe(200);
    expect(body.message).toBe('success');
    
    // This should be called if middleware is working
    expect(mockRBACService.checkPermission).toHaveBeenCalled();
  });

  it('should deny access without token', async () => {
    console.log('🧪 Test starting: should deny access without token');
    
    const app = new Elysia()
      .use(requirePermission('events', PermissionAction.READ))
      .get('/test', () => ({ message: 'success' }));

    const request = new Request('http://localhost/test', {
      headers: {
        'x-real-ip': '192.168.1.100',
        'user-agent': 'test-agent/1.0'
      }
    });
    
    const response = await app.handle(request);
    
    console.log('📊 Response status (no token):', response.status);
    const body = await response.json();
    console.log('📄 Response body (no token):', body);

    expect(response.status).toBe(401);
  });
});