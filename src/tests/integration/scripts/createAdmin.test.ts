import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';
import bcrypt from 'bcrypt';

// Mock de Prisma Client
const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  $disconnect: jest.fn()
};

jest.mock('../../../prisma/client.js', () => ({
  prisma: mockPrisma
}));

// Mock de bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn()
}));

// Mock de console para capturar logs
let consoleLogSpy: jest.SpyInstance;
let consoleErrorSpy: jest.SpyInstance;

describe('👑 CreateAdmin Script Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
  });

  describe('Admin Creation Process', () => {
    it('should create new admin user successfully', async () => {
      // Mock no existing admin
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      
      // Mock bcrypt
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-admin123456');
      
      const mockCreatedAdmin = {
        id: 'admin-123',
        name: 'Administrador BMX',
        email: 'admin@bmxclub.com',
        role: 'ADMIN'
      };
      
      mockPrisma.user.create.mockResolvedValue(mockCreatedAdmin);

      // Dynamic import to test the script execution
      await import('../../../scripts/createAdmin.js');

      // Verify the process
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { role: 'ADMIN' }
      });
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@bmxclub.com' }
      });
      
      expect(bcrypt.hash).toHaveBeenCalledWith('admin123456', 10);
      
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          name: 'Administrador BMX',
          email: 'admin@bmxclub.com',
          password: 'hashed-admin123456',
          role: 'ADMIN'
        }
      });

      // Verify success messages
      expect(consoleLogSpy).toHaveBeenCalledWith('🎉 ¡Usuario administrador creado exitosamente!');
      expect(consoleLogSpy).toHaveBeenCalledWith('   Email: admin@bmxclub.com');
      expect(consoleLogSpy).toHaveBeenCalledWith('   Contraseña: admin123456');
      expect(consoleLogSpy).toHaveBeenCalledWith('🔐 IMPORTANTE: Cambia la contraseña después del primer login');
    });

    it('should skip creation if admin already exists', async () => {
      const existingAdmin = {
        id: 'existing-admin-123',
        name: 'Existing Administrator',
        email: 'existing@bmxclub.com',
        role: 'ADMIN'
      };

      mockPrisma.user.findFirst.mockResolvedValue(existingAdmin);

      await import('../../../scripts/createAdmin.js');

      expect(consoleLogSpy).toHaveBeenCalledWith('✅ Ya existe un usuario administrador:');
      expect(consoleLogSpy).toHaveBeenCalledWith(`   Email: ${existingAdmin.email}`);
      expect(consoleLogSpy).toHaveBeenCalledWith(`   Nombre: ${existingAdmin.name}`);
      
      // Should not try to create a new user
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should update existing non-admin user to admin', async () => {
      // No existing admin
      mockPrisma.user.findFirst.mockResolvedValue(null);
      
      // But user with admin email exists as non-admin
      const existingUser = {
        id: 'user-123',
        name: 'Regular User',
        email: 'admin@bmxclub.com',
        role: 'CLIENT'
      };
      
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      await import('../../../scripts/createAdmin.js');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { role: 'ADMIN' }
      });

      expect(consoleLogSpy).toHaveBeenCalledWith('✅ Usuario existente actualizado a Administrador:');
      expect(consoleLogSpy).toHaveBeenCalledWith(`   Email: ${existingUser.email}`);
      expect(consoleLogSpy).toHaveBeenCalledWith(`   Nombre: ${existingUser.name}`);
    });

    it('should not update if existing user is already admin', async () => {
      // No admin found by role (this could be inconsistent data)
      mockPrisma.user.findFirst.mockResolvedValue(null);
      
      // But user with admin email exists and is already admin
      const existingAdmin = {
        id: 'admin-123',
        name: 'Admin User',
        email: 'admin@bmxclub.com',
        role: 'ADMIN'
      };
      
      mockPrisma.user.findUnique.mockResolvedValue(existingAdmin);

      await import('../../../scripts/createAdmin.js');

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ El usuario ya es administrador');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.user.findFirst.mockRejectedValue(new Error('Database connection failed'));

      await import('../../../scripts/createAdmin.js');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error al crear usuario administrador:',
        expect.any(Error)
      );
    });

    it('should handle bcrypt errors', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockRejectedValue(new Error('Bcrypt hashing failed'));

      await import('../../../scripts/createAdmin.js');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error al crear usuario administrador:',
        expect.any(Error)
      );
    });

    it('should handle user creation errors', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      
      mockPrisma.user.create.mockRejectedValue(new Error('User creation failed'));

      await import('../../../scripts/createAdmin.js');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error al crear usuario administrador:',
        expect.any(Error)
      );
    });

    it('should always disconnect from database', async () => {
      mockPrisma.user.findFirst.mockRejectedValue(new Error('Test error'));

      await import('../../../scripts/createAdmin.js');

      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });

    it('should disconnect even on successful execution', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue({ id: 'admin-123' });

      await import('../../../scripts/createAdmin.js');

      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });
  });

  describe('Security Considerations', () => {
    it('should use secure bcrypt configuration', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('secure-hash');
      mockPrisma.user.create.mockResolvedValue({ id: 'admin-123' });

      await import('../../../scripts/createAdmin.js');

      // Verify bcrypt is called with appropriate salt rounds (10)
      expect(bcrypt.hash).toHaveBeenCalledWith('admin123456', 10);
    });

    it('should display security warnings', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue({ id: 'admin-123' });

      await import('../../../scripts/createAdmin.js');

      // Verify security warning is displayed
      expect(consoleLogSpy).toHaveBeenCalledWith('🔐 IMPORTANTE: Cambia la contraseña después del primer login');
    });
  });

  describe('User Instructions', () => {
    it('should provide clear user instructions', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue({ id: 'admin-123' });

      await import('../../../scripts/createAdmin.js');

      // Verify user instructions are provided
      expect(consoleLogSpy).toHaveBeenCalledWith('🚀 Pasos para acceder:');
      expect(consoleLogSpy).toHaveBeenCalledWith('   1. Ve a http://localhost:3000/login');
      expect(consoleLogSpy).toHaveBeenCalledWith('   2. Inicia sesión con las credenciales de arriba');
      expect(consoleLogSpy).toHaveBeenCalledWith('   3. Haz clic en tu nombre → "Administración"');
      expect(consoleLogSpy).toHaveBeenCalledWith('   4. ¡Ya puedes gestionar usuarios!');
    });

    it('should display credentials clearly', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue({ id: 'admin-123' });

      await import('../../../scripts/createAdmin.js');

      // Verify credentials are displayed
      expect(consoleLogSpy).toHaveBeenCalledWith('📋 Credenciales de acceso:');
      expect(consoleLogSpy).toHaveBeenCalledWith('   Email: admin@bmxclub.com');
      expect(consoleLogSpy).toHaveBeenCalledWith('   Contraseña: admin123456');
    });
  });

  describe('Data Validation', () => {
    it('should use correct admin data structure', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue({ id: 'admin-123' });

      await import('../../../scripts/createAdmin.js');

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          name: 'Administrador BMX',
          email: 'admin@bmxclub.com',
          password: 'hashed-password',
          role: 'ADMIN'
        }
      });
    });

    it('should check for admin role correctly', async () => {
      const mockNonAdminUser = {
        id: 'user-123',
        role: 'CLIENT'
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockNonAdminUser);

      await import('../../../scripts/createAdmin.js');

      // Should find first user with ADMIN role specifically
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { role: 'ADMIN' }
      });
    });

    it('should check for specific email when looking for existing user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await import('../../../scripts/createAdmin.js');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@bmxclub.com' }
      });
    });
  });

  describe('Console Output Format', () => {
    it('should use consistent emoji and formatting', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue({ id: 'admin-123' });

      await import('../../../scripts/createAdmin.js');

      // Check for emoji usage in success messages
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('🎉'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('📋'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('🔐'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('🚀'));
    });
  });

  describe('Edge Cases', () => {
    it('should handle null responses from database gracefully', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue(null);

      await import('../../../scripts/createAdmin.js');

      // Should handle null creation response
      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });

    it('should handle undefined database responses', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(undefined);
      mockPrisma.user.findUnique.mockResolvedValue(undefined);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue({ id: 'admin-123' });

      await import('../../../scripts/createAdmin.js');

      // Should treat undefined as no existing user
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });
  });
});
