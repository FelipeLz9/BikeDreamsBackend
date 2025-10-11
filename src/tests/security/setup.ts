import { jest } from '@jest/globals';

// Setup para tests de seguridad
beforeAll(() => {
  // Configurar variables de entorno para testing
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reducir logs durante tests
  process.env.SECURITY_LOG_LEVEL = 'warn';
  
  // Mock de console para tests más limpios
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  // Restaurar mocks
  jest.restoreAllMocks();
  
  // Limpiar variables de entorno
  delete process.env.NODE_ENV;
  delete process.env.LOG_LEVEL;
  delete process.env.SECURITY_LOG_LEVEL;
});

beforeEach(() => {
  // Reset de estado antes de cada test
  jest.clearAllMocks();
});

afterEach(() => {
  // Limpiar después de cada test
  jest.clearAllTimers();
});
