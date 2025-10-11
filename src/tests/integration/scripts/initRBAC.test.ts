import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';
import bcrypt from 'bcrypt';

// Mock de Prisma Client
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
  },
  permission: {
    count: jest.fn()
  },
  resourcePolicy: {
    findFirst: jest.fn(),
    create: jest.fn(),
    count: jest.fn()
  },
  $disconnect: jest.fn()
};

jest.mock('../../../prisma/client.js', () => ({
  prisma: mockPrisma
}));

// Mock del RBACService
const mockRBACService = {
  initializeDefaultPermissions: jest.fn(),
  getUserEffectivePermissions: jest.fn()
};

jest.mock('../../../services/rbacService.js', () => ({
  RBACService: mockRBACService
}));

// Mock de bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn()
}));

// Mock de console para capturar logs
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

let consoleLogSpy: jest.SpyInstance;
let consoleErrorSpy: jest.SpyInstance;

// Mock de process.exit
const mockProcessExit = jest.fn();
Object.defineProperty(process, 'exit', { value: mockProcessExit });

describe('🔐 InitRBAC Script Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Reset environment variables
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_NAME;
  });

  afterEach(() => {
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
  });

  describe('RBAC Initialization Process', () => {
    it('should successfully initialize RBAC system with default values', async () => {
      // Setup mocks
      mockRBACService.initializeDefaultPermissions.mockResolvedValue({ success: true });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password-123');
      
      const mockSuperAdmin = {
        id: 'admin-123',
        name: 'Super Administrador',
        email: 'admin@example.com',
        role: 'SUPER_ADMIN'
      };
      
      mockPrisma.user.create.mockResolvedValue(mockSuperAdmin);
      mockRBACService.getUserEffectivePermissions.mockResolvedValue({
        success: true,
        permissions: ['*', 'admin.read', 'users.manage']
      });
      
      mockPrisma.user.count.mockResolvedValue(6);
      mockPrisma.permission.count.mockResolvedValue(24);
      mockPrisma.resourcePolicy.count.mockResolvedValue(2);

      // Dynamic import to avoid hoisting issues with mocks
      const { default: initRBACModule } = await import('../../../scripts/initRBAC.js');
      
      // The script should run without errors
      expect(mockRBACService.initializeDefaultPermissions).toHaveBeenCalled();
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@example.com' }
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('CHANGE_ME_123!', 12);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          name: 'Super Administrador',
          email: 'admin@example.com',
          password: 'hashed-password-123',
          role: 'SUPER_ADMIN',
          isActive: true
        }
      });
    });

    it('should use environment variables when provided', async () => {
      // Set environment variables
      process.env.ADMIN_EMAIL = 'custom-admin@test.com';
      process.env.ADMIN_PASSWORD = 'CustomPassword123!';
      process.env.ADMIN_NAME = 'Custom Admin';

      mockRBACService.initializeDefaultPermissions.mockResolvedValue({ success: true });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('custom-hashed-password');
      
      const mockCustomAdmin = {
        id: 'custom-admin-123',
        name: 'Custom Admin',
        email: 'custom-admin@test.com',
        role: 'SUPER_ADMIN'
      };
      
      mockPrisma.user.create.mockResolvedValue(mockCustomAdmin);
      
      // Mock other dependencies
      mockRBACService.getUserEffectivePermissions.mockResolvedValue({
        success: true,
        permissions: ['*']
      });
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.permission.count.mockResolvedValue(20);
      mockPrisma.resourcePolicy.count.mockResolvedValue(0);

      // The script should use custom environment variables
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'custom-admin@test.com' }
      });
    });

    it('should update existing user to SUPER_ADMIN if not already', async () => {
      mockRBACService.initializeDefaultPermissions.mockResolvedValue({ success: true });
      
      const existingUser = {
        id: 'existing-123',
        name: 'Existing User',
        email: 'admin@example.com',
        role: 'ADMIN'
      };
      
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      
      // Mock other dependencies
      mockRBACService.getUserEffectivePermissions.mockResolvedValue({
        success: true,
        permissions: ['*']
      });
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.permission.count.mockResolvedValue(20);
      mockPrisma.resourcePolicy.count.mockResolvedValue(0);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'existing-123' },
        data: { role: 'SUPER_ADMIN' }
      });
    });

    it('should not update user if already SUPER_ADMIN', async () => {
      mockRBACService.initializeDefaultPermissions.mockResolvedValue({ success: true });
      
      const existingSuperAdmin = {
        id: 'super-admin-123',
        name: 'Super Admin',
        email: 'admin@example.com',
        role: 'SUPER_ADMIN'
      };
      
      mockPrisma.user.findUnique.mockResolvedValue(existingSuperAdmin);
      
      // Mock other dependencies
      mockRBACService.getUserEffectivePermissions.mockResolvedValue({
        success: true,
        permissions: ['*']
      });
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.permission.count.mockResolvedValue(20);
      mockPrisma.resourcePolicy.count.mockResolvedValue(0);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('Example Users Creation', () => {
    it('should create example users with different roles', async () => {
      mockRBACService.initializeDefaultPermissions.mockResolvedValue({ success: true });
      
      // Mock super admin creation
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // Super admin doesn't exist
        .mockResolvedValue(null); // Example users don't exist

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue({ id: 'user-123' });
      
      // Mock other dependencies
      mockRBACService.getUserEffectivePermissions.mockResolvedValue({
        success: true,
        permissions: ['*']
      });
      mockPrisma.user.count.mockResolvedValue(6);
      mockPrisma.permission.count.mockResolvedValue(20);
      mockPrisma.resourcePolicy.count.mockResolvedValue(0);

      // Verify example users are created
      const expectedExampleUsers = [
        { role: 'ADMIN', email: 'admin.general@example.com' },
        { role: 'MODERATOR', email: 'moderador@example.com' },
        { role: 'EDITOR', email: 'editor@example.com' },
        { role: 'EVENT_MANAGER', email: 'events@example.com' },
        { role: 'CLIENT', email: 'cliente@example.com' }
      ];

      expectedExampleUsers.forEach(user => {
        expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
          where: { email: user.email }
        });
      });
    });

    it('should skip existing example users', async () => {
      mockRBACService.initializeDefaultPermissions.mockResolvedValue({ success: true });
      
      // Mock super admin doesn't exist
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // Super admin
        .mockResolvedValue({ id: 'existing-user', email: 'admin.general@example.com' }); // All example users exist

      mockPrisma.user.create.mockResolvedValue({ id: 'super-admin' }); // Only super admin created
      
      // Mock other dependencies
      mockRBACService.getUserEffectivePermissions.mockResolvedValue({
        success: true,
        permissions: ['*']
      });
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.permission.count.mockResolvedValue(20);
      mockPrisma.resourcePolicy.count.mockResolvedValue(0);

      // Should only create super admin, not example users
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Resource Policies Creation', () => {
    it('should create example resource policies', async () => {
      mockRBACService.initializeDefaultPermissions.mockResolvedValue({ success: true });
      
      // Mock super admin creation
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'admin-123' });
      
      // Mock policies don't exist
      mockPrisma.resourcePolicy.findFirst.mockResolvedValue(null);
      mockPrisma.resourcePolicy.create.mockResolvedValue({ id: 'policy-123' });
      
      // Mock other dependencies
      mockRBACService.getUserEffectivePermissions.mockResolvedValue({
        success: true,
        permissions: ['*']
      });
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.permission.count.mockResolvedValue(20);
      mockPrisma.resourcePolicy.count.mockResolvedValue(2);

      // Verify policies are created
      expect(mockPrisma.resourcePolicy.findFirst).toHaveBeenCalledWith({
        where: {
          resource: 'events',
          resourceId: null,
          priority: 10
        }
      });

      expect(mockPrisma.resourcePolicy.findFirst).toHaveBeenCalledWith({
        where: {
          resource: 'users',
          resourceId: null,
          priority: 20
        }
      });

      expect(mockPrisma.resourcePolicy.create).toHaveBeenCalledTimes(2);
    });

    it('should skip existing policies', async () => {
      mockRBACService.initializeDefaultPermissions.mockResolvedValue({ success: true });
      
      // Mock super admin creation
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'admin-123' });
      
      // Mock policies already exist
      mockPrisma.resourcePolicy.findFirst.mockResolvedValue({ id: 'existing-policy' });
      
      // Mock other dependencies
      mockRBACService.getUserEffectivePermissions.mockResolvedValue({
        success: true,
        permissions: ['*']
      });
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.permission.count.mockResolvedValue(20);
      mockPrisma.resourcePolicy.count.mockResolvedValue(2);

      // Should not create policies if they already exist
      expect(mockPrisma.resourcePolicy.create).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle RBAC service initialization failure', async () => {
      mockRBACService.initializeDefaultPermissions.mockResolvedValue({
        success: false,
        error: 'Database connection failed'
      });

      // The script should exit early on permission initialization failure
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error inicializando permisos:',
        'Database connection failed'
      );
    });

    it('should handle database errors gracefully', async () => {
      mockRBACService.initializeDefaultPermissions.mockResolvedValue({ success: true });
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database connection lost'));

      // Should catch and log the error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error inicializando RBAC:',
        expect.any(Error)
      );
    });

    it('should disconnect from database in finally block', async () => {
      mockRBACService.initializeDefaultPermissions.mockResolvedValue({ success: true });
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Test error'));

      // Should always call disconnect
      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });

    it('should handle bcrypt errors', async () => {
      mockRBACService.initializeDefaultPermissions.mockResolvedValue({ success: true });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockRejectedValue(new Error('Bcrypt error'));

      // Should handle bcrypt errors gracefully
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error inicializando RBAC:',
        expect.any(Error)
      );
    });
  });

  describe('Statistics Display', () => {
    it('should display final statistics', async () => {
      mockRBACService.initializeDefaultPermissions.mockResolvedValue({ success: true });
      
      const mockSuperAdmin = { id: 'admin-123' };
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockSuperAdmin);
      
      mockRBACService.getUserEffectivePermissions.mockResolvedValue({
        success: true,
        permissions: ['*', 'admin.read', 'users.manage']
      });
      
      mockPrisma.user.count.mockResolvedValue(6);
      mockPrisma.permission.count.mockResolvedValue(24);
      mockPrisma.resourcePolicy.count.mockResolvedValue(2);

      // Should display statistics
      expect(consoleLogSpy).toHaveBeenCalledWith('📈 Usuarios totales:', 6);
      expect(consoleLogSpy).toHaveBeenCalledWith('📈 Permisos totales:', 24);
      expect(consoleLogSpy).toHaveBeenCalledWith('📈 Políticas totales:', 2);
    });

    it('should handle statistics errors gracefully', async () => {
      mockRBACService.initializeDefaultPermissions.mockResolvedValue({ success: true });
      
      const mockSuperAdmin = { id: 'admin-123' };
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockSuperAdmin);
      
      mockRBACService.getUserEffectivePermissions.mockResolvedValue({
        success: false,
        error: 'Permission service unavailable'
      });
      
      mockPrisma.user.count.mockResolvedValue(6);
      mockPrisma.permission.count.mockResolvedValue(24);
      mockPrisma.resourcePolicy.count.mockResolvedValue(2);

      // Should handle getUserEffectivePermissions failure gracefully
      // The script should continue and show other statistics
      expect(consoleLogSpy).toHaveBeenCalledWith('📈 Usuarios totales:', 6);
    });
  });

  describe('Console Output Verification', () => {
    it('should display user credentials securely', async () => {
      mockRBACService.initializeDefaultPermissions.mockResolvedValue({ success: true });
      
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'admin-123' });
      
      mockRBACService.getUserEffectivePermissions.mockResolvedValue({
        success: true,
        permissions: ['*']
      });
      
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.permission.count.mockResolvedValue(20);
      mockPrisma.resourcePolicy.count.mockResolvedValue(0);

      // Should display password warning
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '⚠️  IMPORTANTE: Cambia las contraseñas por defecto en producción!'
      );
    });
  });
});
