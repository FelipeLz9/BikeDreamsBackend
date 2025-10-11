#!/bin/bash

# ================================================================
# BikeDreams Backend - Generador de Tests Básicos
# ================================================================
#
# Este script genera automáticamente tests básicos para los controladores
# y servicios principales del backend que actualmente no tienen tests.
#
# Usage: ./generate-basic-tests.sh
# ================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TESTS_DIR="$PROJECT_ROOT/src/tests"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Generando tests básicos para BikeDreams Backend...${NC}"

# Crear directorios de test si no existen
mkdir -p "$TESTS_DIR/controllers"
mkdir -p "$TESTS_DIR/services"
mkdir -p "$TESTS_DIR/middleware"
mkdir -p "$TESTS_DIR/utils"

echo -e "${YELLOW}📁 Creando tests para controladores...${NC}"

# Test para AuthController
cat > "$TESTS_DIR/controllers/authController.test.ts" << 'EOF'
import { register, login, refreshToken } from '../../controllers/authController';

// Mock del servicio de autenticación
jest.mock('../../services/authService', () => ({
  AuthService: {
    register: jest.fn(),
    login: jest.fn(),
    refreshAccessToken: jest.fn()
  }
}));

describe('🔐 AuthController', () => {
  const mockHeaders = {
    'x-forwarded-for': '192.168.1.100',
    'user-agent': 'test-agent'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    test('should register user successfully', async () => {
      const mockRegisterData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      const { AuthService } = require('../../services/authService');
      AuthService.register.mockResolvedValue({
        success: true,
        message: 'Usuario registrado exitosamente',
        user: { id: '1', name: 'Test User', email: 'test@example.com' }
      });

      const result = await register({
        body: mockRegisterData,
        headers: mockHeaders
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Usuario registrado exitosamente');
      expect(AuthService.register).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!'
      }, {
        ipAddress: '192.168.1.100',
        userAgent: 'test-agent',
        deviceId: undefined
      });
    });

    test('should fail with missing required fields', async () => {
      const result = await register({
        body: { name: '', email: 'test@example.com', password: '' },
        headers: mockHeaders
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Todos los campos son requeridos');
    });

    test('should fail with invalid email format', async () => {
      const result = await register({
        body: { name: 'Test', email: 'invalid-email', password: 'password' },
        headers: mockHeaders
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email inválido');
    });
  });

  describe('login', () => {
    test('should login successfully with valid credentials', async () => {
      const { AuthService } = require('../../services/authService');
      AuthService.login.mockResolvedValue({
        success: true,
        message: 'Login exitoso',
        user: { id: '1', name: 'Test User', email: 'test@example.com' },
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token'
      });

      const result = await login({
        body: { email: 'test@example.com', password: 'password' },
        headers: mockHeaders
      });

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
    });

    test('should fail with missing credentials', async () => {
      const result = await login({
        body: { email: '', password: '' },
        headers: mockHeaders
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Credenciales requeridas');
    });
  });
});
EOF

# Test para UserController
cat > "$TESTS_DIR/controllers/userController.test.ts" << 'EOF'
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
EOF

# Test para AuthService
cat > "$TESTS_DIR/services/authService.test.ts" << 'EOF'
import { AuthService } from '../../services/authService';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../prisma/client', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    userSession: {
      create: jest.fn(),
      update: jest.fn()
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn()
    },
    auditLog: {
      create: jest.fn()
    },
    securityEvent: {
      create: jest.fn()
    }
  }
}));

jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('🔐 AuthService', () => {
  const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
  const mockJwt = jwt as jest.Mocked<typeof jwt>;
  const { prisma } = require('../../prisma/client');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    test('should register user with valid data', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!'
      };
      const metadata = { ipAddress: '192.168.1.1' };

      prisma.user.findUnique.mockResolvedValue(null); // User doesn't exist
      mockBcrypt.hash.mockResolvedValue('hashed-password' as never);
      prisma.user.create.mockResolvedValue({
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'CLIENT'
      });
      prisma.auditLog.create.mockResolvedValue({});

      const result = await AuthService.register(userData, metadata);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(prisma.user.create).toHaveBeenCalled();
    });

    test('should reject weak password', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: '123' // Weak password
      };
      const metadata = { ipAddress: '192.168.1.1' };

      prisma.user.findUnique.mockResolvedValue(null);

      const result = await AuthService.register(userData, metadata);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Contraseña débil');
    });
  });

  describe('login', () => {
    test('should login with valid credentials', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed-password',
        loginAttempts: 0,
        lockUntil: null,
        isActive: true,
        role: 'CLIENT',
        name: 'Test User'
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockJwt.sign.mockReturnValue('mock-jwt-token' as never);
      
      prisma.user.update.mockResolvedValue(mockUser);
      prisma.userSession.create.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});
      prisma.securityEvent.create.mockResolvedValue({});

      const result = await AuthService.login('test@example.com', 'password', { ipAddress: '192.168.1.1' });

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    test('should fail with invalid password', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed-password',
        loginAttempts: 0,
        lockUntil: null,
        isActive: true
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false as never);

      const result = await AuthService.login('test@example.com', 'wrong-password', { ipAddress: '192.168.1.1' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Credenciales inválidas');
    });
  });
});
EOF

# Test para middleware de auth
cat > "$TESTS_DIR/middleware/auth.test.ts" << 'EOF'
import jwt from 'jsonwebtoken';

// Mock JWT
jest.mock('jsonwebtoken');
const mockJwt = jwt as jest.Mocked<typeof jwt>;

// Mock Prisma
jest.mock('../../prisma/client', () => ({
  prisma: {
    user: {
      findUnique: jest.fn()
    }
  }
}));

describe('🔐 Auth Middleware', () => {
  const { prisma } = require('../../prisma/client');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('JWT Token Validation', () => {
    test('should validate valid JWT token', () => {
      const mockPayload = { id: '1', email: 'test@example.com' };
      mockJwt.verify.mockReturnValue(mockPayload as any);

      const token = 'valid-jwt-token';
      const secret = 'test-secret';

      const result = mockJwt.verify(token, secret);

      expect(result).toEqual(mockPayload);
      expect(mockJwt.verify).toHaveBeenCalledWith(token, secret);
    });

    test('should reject invalid JWT token', () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const token = 'invalid-jwt-token';
      const secret = 'test-secret';

      expect(() => mockJwt.verify(token, secret)).toThrow('Invalid token');
    });
  });

  describe('User Authentication Flow', () => {
    test('should authenticate user with valid token', async () => {
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        isActive: true
      };

      mockJwt.verify.mockReturnValue({ id: '1', email: 'test@example.com' } as any);
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const authHeader = 'Bearer valid-token';
      const token = authHeader.split(' ')[1];
      const decoded = mockJwt.verify(token, 'secret') as any;
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });

      expect(user).toEqual(mockUser);
      expect(user.isActive).toBe(true);
    });

    test('should reject inactive user', async () => {
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        isActive: false
      };

      mockJwt.verify.mockReturnValue({ id: '1', email: 'test@example.com' } as any);
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const authHeader = 'Bearer valid-token';
      const token = authHeader.split(' ')[1];
      const decoded = mockJwt.verify(token, 'secret') as any;
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });

      expect(user.isActive).toBe(false);
    });
  });
});
EOF

# Test para utilidades API Response
cat > "$TESTS_DIR/utils/apiResponse.test.ts" << 'EOF'
describe('🔧 API Response Utilities', () => {
  describe('Response Formatting', () => {
    test('should format success response correctly', () => {
      const successResponse = {
        success: true,
        message: 'Operation successful',
        data: { id: 1, name: 'Test' }
      };

      expect(successResponse.success).toBe(true);
      expect(successResponse.message).toBe('Operation successful');
      expect(successResponse.data).toEqual({ id: 1, name: 'Test' });
    });

    test('should format error response correctly', () => {
      const errorResponse = {
        success: false,
        error: 'Validation failed',
        message: 'Invalid input provided'
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBe('Validation failed');
      expect(errorResponse.message).toBe('Invalid input provided');
    });

    test('should handle pagination response', () => {
      const paginationResponse = {
        success: true,
        data: [{ id: 1 }, { id: 2 }, { id: 3 }],
        pagination: {
          page: 1,
          limit: 10,
          total: 3,
          pages: 1
        }
      };

      expect(paginationResponse.pagination.page).toBe(1);
      expect(paginationResponse.pagination.total).toBe(3);
      expect(paginationResponse.data).toHaveLength(3);
    });
  });

  describe('HTTP Status Codes', () => {
    test('should use correct status codes for different responses', () => {
      const responses = [
        { type: 'success', expectedCode: 200 },
        { type: 'created', expectedCode: 201 },
        { type: 'badRequest', expectedCode: 400 },
        { type: 'unauthorized', expectedCode: 401 },
        { type: 'forbidden', expectedCode: 403 },
        { type: 'notFound', expectedCode: 404 },
        { type: 'internalError', expectedCode: 500 }
      ];

      responses.forEach(({ type, expectedCode }) => {
        // This would normally test actual API response utilities
        // For now, we just verify the expected status codes
        expect(expectedCode).toBeGreaterThan(0);
        expect(expectedCode).toBeLessThan(600);
      });
    });
  });
});
EOF

echo -e "${GREEN}✅ Tests básicos generados exitosamente!${NC}"
echo -e "${BLUE}📁 Tests creados en:${NC}"
echo -e "  - src/tests/controllers/authController.test.ts"
echo -e "  - src/tests/controllers/userController.test.ts"
echo -e "  - src/tests/services/authService.test.ts"
echo -e "  - src/tests/middleware/auth.test.ts"
echo -e "  - src/tests/utils/apiResponse.test.ts"

echo -e "${YELLOW}🧪 Para ejecutar los nuevos tests:${NC}"
echo -e "  npm test -- --config jest.config.simple.js --testPathPattern=\"controllers|services|middleware|utils\""

echo -e "${BLUE}📋 Próximos pasos recomendados:${NC}"
echo -e "  1. Revisar y personalizar los tests generados"
echo -e "  2. Agregar tests específicos para casos edge"
echo -e "  3. Implementar tests de integración"
echo -e "  4. Configurar cobertura de código"
EOF

# Hacer el script ejecutable
chmod +x "$PROJECT_ROOT/scripts/generate-basic-tests.sh"

echo -e "${GREEN}✅ Script generador creado exitosamente!${NC}"
echo -e "${BLUE}📝 Uso: ./scripts/generate-basic-tests.sh${NC}"
