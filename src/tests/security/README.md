# Tests de Seguridad - BikeDreams Backend

Este directorio contiene una suite completa de tests de seguridad para el backend de BikeDreams, diseñada para validar y verificar que todas las medidas de seguridad implementadas funcionan correctamente.

## 📋 Suites de Testing Incluidas

### 🔒 Tests de Validación y Sanitización (`validation.test.ts`)
- Validación de entradas de usuario
- Sanitización de datos maliciosos
- Prevención de inyecciones XSS, SQL, y otros vectores de ataque
- Validación de archivos subidos
- Detección de patrones maliciosos

### 🛡️ Tests de Headers de Seguridad (`headers.test.ts`)
- Verificación de HSTS (HTTP Strict Transport Security)
- Validación de Content Security Policy (CSP)
- Verificación de Permissions Policy
- Tests de CORS (Cross-Origin Resource Sharing)
- Validación de headers de seguridad estándar
- Tests de endpoints de reportes CSP y CT

### ⚔️ Tests de Penetración (`penetration.test.ts`)
- Tests de ataques XSS avanzados
- Inyección SQL con múltiples vectores
- Path Traversal y Directory Traversal
- Command Injection
- NoSQL Injection
- Header Injection
- LDAP Injection
- XML External Entity (XXE) attacks
- Deserialization attacks
- Server-Side Template Injection (SSTI)
- Tests de subida de archivos maliciosos
- Business Logic attacks
- HTTP Method Override attacks
- Response Splitting attacks

### 🚀 Tests de Carga y Rendimiento (`load.test.ts`)
- Rate Limiting bajo carga
- Protección DDoS
- Tests de stress con payloads maliciosos
- Tests de memoria y recursos
- Logging de eventos de seguridad bajo carga
- Tests de recuperación y resiliencia

## 🚀 Cómo Ejecutar los Tests

### Ejecución Individual

```bash
# Tests de validación y sanitización
npm run security:validation

# Tests de headers de seguridad
npm run security:headers

# Tests de penetración
npm run security:penetration

# Tests de carga y rendimiento
npm run security:load
```

### Suite Completa

```bash
# Ejecutar todos los tests de seguridad
npm run test:security

# Con reporte de cobertura
npm run test:security:coverage

# En modo watch
npm run test:security:watch

# Script completo con reportes
npm run security:tests
```

### Script Automatizado

El script `./scripts/security-tests.sh` proporciona una ejecución completa con:
- Verificación de dependencias
- Ejecución por fases
- Generación de reportes
- Verificación de cobertura
- Limpieza automática

```bash
chmod +x ./scripts/security-tests.sh
./scripts/security-tests.sh
```

## 📊 Reportes y Cobertura

### Reportes Generados

1. **Reporte HTML de Cobertura**: `coverage/security/lcov-report/index.html`
2. **Reporte HTML de Tests**: `coverage/security/test-report.html`
3. **JUnit XML**: `coverage/security/security-junit.xml`
4. **JSON Summary**: `coverage/security/coverage-summary.json`

### Umbrales de Cobertura

- **Global**: 80% en líneas, funciones, ramas y declaraciones
- **Security Headers**: 85% de cobertura
- **Strict Security**: 90% de cobertura
- **Validation Plugin**: 85% de cobertura

## 🔧 Configuración

### Jest Config (`jest.config.security.js`)

Configuración específica para tests de seguridad con:
- ESM support
- Timeouts extendidos (30s)
- Reportes personalizados
- Configuración de cobertura específica
- Setup personalizado

### Setup Files

- `setup.ts`: Configuración general de entorno
- `jest.setup.ts`: Matchers personalizados y mocks globales

## 🎯 Matchers Personalizados

Los tests incluyen matchers personalizados para facilitar las validaciones:

```typescript
expect(response).toBeBlockedBySecurityMiddleware();
expect(response).toContainSecurityHeaders();
expect(response).toHaveValidCSP();
expect(response).toBlockMaliciousPayload();
expect(response).toSanitizeInput();
expect(securityLogger).toLogSecurityEvent();
```

## 📈 Métricas y Monitoreo

### Performance Benchmarks

- **Validation Tests**: < 5ms por request promedio
- **Header Tests**: < 10ms por request promedio
- **Penetration Tests**: < 50ms por payload malicioso
- **Load Tests**: 100+ requests concurrentes

### Memory Usage

- Monitoreo de memory leaks durante ataques
- Límites de memoria por test suite
- Garbage collection forzado entre tests

## 🚨 Alertas y Logging

Durante la ejecución de tests se generan logs de seguridad que incluyen:
- Intentos de ataque detectados
- Payloads bloqueados
- Headers de seguridad aplicados
- Eventos de rate limiting
- Violaciones de CSP simuladas

## 🛠️ Troubleshooting

### Problemas Comunes

1. **Tests de carga fallan**
   - Puede ser normal en entornos con recursos limitados
   - Ajustar timeouts si es necesario

2. **Cobertura por debajo del umbral**
   - Verificar que todos los middlewares están importados correctamente
   - Revisar paths de archivos en la configuración

3. **FormData no disponible**
   - Los mocks globales están incluidos en `jest.setup.ts`

4. **ESM import errors**
   - Verificar configuración de `moduleNameMapping` en Jest config

### Debugging

```bash
# Ejecutar tests en modo verbose
npm run test:security -- --verbose

# Ejecutar test específico
npm run test:security -- --testNamePattern="XSS"

# Debug con logs completos
DEBUG=* npm run test:security
```

## 🔄 CI/CD Integration

Los tests están preparados para integración continua:
- JUnit XML output para Jenkins/GitHub Actions
- Umbrales de cobertura configurables
- Reportes HTML para artifacts
- Exit codes apropiados para pipelines

## 📚 Documentación Adicional

- [Middleware de Seguridad](../../middleware/README.md)
- [Configuración de Headers](../../middleware/securityHeaders.ts)
- [Plugin de Validación](../../plugins/validationPlugin.ts)
- [Logger de Seguridad](../../services/securityLogger.ts)

## 🤝 Contribuir

Al agregar nuevos tests de seguridad:

1. Seguir la estructura existente
2. Agregar documentación apropiada
3. Incluir casos edge
4. Verificar cobertura
5. Actualizar este README

## 🔐 Consideraciones de Seguridad

- Los payloads de test son inofensivos pero representativos
- No usar credenciales reales en tests
- Los logs de test no deben incluir información sensible
- Ejecutar en entornos aislados para tests de penetración
