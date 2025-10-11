# BikeDreams Backend API

Backend API para la plataforma BikeDreams construido con Elysia.js, Bun y Prisma.

## 🚀 Despliegue en Producción

### Requisitos Previos

- Docker y Docker Compose instalados
- Bun runtime (para desarrollo local)
- Base de datos PostgreSQL

### Configuración de Producción

1. **Clonar el repositorio:**
   ```bash
   git clone <repository-url>
   cd bikedreams-backend
   ```

2. **Configurar variables de entorno:**
   ```bash
   cp .env.example .env
   # Edita .env con los valores de producción
   ```

3. **Variables de entorno requeridas:**
   ```env
   NODE_ENV=production
   DATABASE_URL=postgresql://user:password@localhost:5432/bikedreams_db
   JWT_SECRET=your-super-secure-jwt-secret
   PORT=3001
   HOST=0.0.0.0
   CORS_ORIGIN=https://your-frontend-domain.com
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=CHANGE_ME_SECURE
   ADMIN_NAME=Administrator
   ```

### Opciones de Despliegue

#### Opción 1: Docker Compose (Recomendado)

```bash
# Construir y ejecutar todos los servicios
docker-compose -f docker-compose.prod.yml up -d

# Ver logs
docker-compose -f docker-compose.prod.yml logs -f

# Ejecutar migraciones
docker-compose -f docker-compose.prod.yml exec api bun run prisma:migrate

# Crear usuario administrador
docker-compose -f docker-compose.prod.yml exec api bun run create-admin
```

#### Opción 2: Docker Standalone

```bash
# Construir la imagen
docker build -t bikedreams-backend .

# Ejecutar el contenedor
docker run -d \
  --name bikedreams-api \
  -p 3001:3001 \
  --env-file .env \
  bikedreams-backend
```

#### Opción 3: Despliegue Manual

```bash
# Instalar dependencias
bun install

# Generar cliente Prisma
bun run prisma:generate

# Ejecutar migraciones
bun run prisma:migrate

# Construir para producción
bun run build

# Iniciar en producción
bun run start
```

### Servicios Incluidos

- **API Backend**: Puerto 3001
- **PostgreSQL**: Puerto 5432
- **Nginx**: Puerto 80/443 (proxy reverso)

### Endpoints Principales

- `GET /` - Estado del servidor
- `GET /health` - Health check
- `GET /swagger` - Documentación API (solo desarrollo)
- `POST /auth/login` - Iniciar sesión
- `POST /auth/register` - Registro de usuario
- `GET /api/users` - Listar usuarios
- `GET /api/events` - Listar eventos
- `GET /api/news` - Listar noticias
- `GET /api/forum` - Posts del foro
- `GET /api/riders` - Corredores destacados

### Monitoreo y Salud

```bash
# Verificar estado del API
curl http://localhost:3001/health

# Ver logs en tiempo real
docker-compose -f docker-compose.prod.yml logs -f api

# Verificar métricas
docker stats bikedreams-api
```

### Seguridad

- ✅ CORS configurado para producción
- ✅ Rate limiting implementado
- ✅ Headers de seguridad
- ✅ Autenticación JWT
- ✅ Validación de entrada con Zod
- ✅ Usuario no-root en Docker
- ✅ Health checks configurados

### Mantenimiento

#### Backups de Base de Datos

```bash
# Crear backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres bikedreams_db > backup.sql

# Restaurar backup
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres bikedreams_db < backup.sql
```

#### Actualizar la Aplicación

```bash
# Detener servicios
docker-compose -f docker-compose.prod.yml down

# Actualizar código
git pull origin main

# Reconstruir y reiniciar
docker-compose -f docker-compose.prod.yml up -d --build

# Ejecutar migraciones si es necesario
docker-compose -f docker-compose.prod.yml exec api bun run prisma:migrate
```

### Troubleshooting

#### Problemas Comunes

1. **Error de conexión a la base de datos:**
   - Verificar que PostgreSQL esté corriendo
   - Comprobar la cadena de conexión DATABASE_URL
   - Verificar credenciales de la base de datos

2. **Error CORS:**
   - Verificar CORS_ORIGIN en variables de entorno
   - Asegurar que el frontend esté en el dominio correcto

3. **JWT no válido:**
   - Verificar JWT_SECRET esté configurado
   - Comprobar que sea el mismo secret en frontend y backend

#### Logs y Debugging

```bash
# Ver logs de la aplicación
docker-compose -f docker-compose.prod.yml logs api

# Ver logs de la base de datos
docker-compose -f docker-compose.prod.yml logs postgres

# Ver logs de Nginx
docker-compose -f docker-compose.prod.yml logs nginx

# Acceso al contenedor para debugging
docker-compose -f docker-compose.prod.yml exec api sh
```

### Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   Nginx Proxy   │────│   Elysia API    │────│   PostgreSQL    │
│   (Port 80/443) │    │   (Port 3001)   │    │   (Port 5432)   │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Rendimiento

- Gzip habilitado para respuestas
- Conexiones keep-alive
- Rate limiting configurado
- Health checks automáticos
- Reinicio automático en caso de fallo

### Licencia

ISC

---

¿Necesitas ayuda? Abre un issue o contacta al equipo de desarrollo.
