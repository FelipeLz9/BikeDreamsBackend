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
      expect(result.message).toBe('Email y contraseña son obligatorios');
    });
  });
});
