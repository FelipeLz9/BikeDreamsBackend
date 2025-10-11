#!/bin/bash

# BikeDreams Backend - Production Deployment Script
set -e

echo "🚀 Iniciando despliegue de BikeDreams Backend..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para mostrar mensajes
log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Verificar que Docker está instalado
if ! command -v docker &> /dev/null; then
    error "Docker no está instalado. Por favor instala Docker primero."
fi

if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose no está instalado. Por favor instala Docker Compose primero."
fi

# Verificar que existe el archivo .env
if [ ! -f ".env" ]; then
    warn "Archivo .env no encontrado. Creando desde .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        warn "Por favor edita .env con los valores de producción antes de continuar."
        read -p "Presiona Enter cuando hayas configurado el archivo .env..."
    else
        error "Archivo .env.example no encontrado. No se puede crear .env automáticamente."
    fi
fi

# Cargar variables de entorno
source .env

# Verificar variables críticas
if [ -z "$POSTGRES_PASSWORD" ]; then
    error "POSTGRES_PASSWORD no está configurado en .env"
fi

if [ -z "$JWT_SECRET" ]; then
    error "JWT_SECRET no está configurado en .env"
fi

log "Iniciando servicios con Docker Compose..."

# Detener servicios existentes
log "Deteniendo servicios existentes..."
docker-compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true

# Construir y ejecutar servicios
log "Construyendo y ejecutando servicios..."
docker-compose -f docker-compose.prod.yml up -d --build

# Esperar a que la base de datos esté lista
log "Esperando a que PostgreSQL esté listo..."
sleep 10

# Verificar que los servicios están corriendo
log "Verificando servicios..."
if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    success "Servicios iniciados correctamente"
else
    error "Error al iniciar servicios"
fi

# Ejecutar migraciones de Prisma
log "Ejecutando migraciones de base de datos..."
docker-compose -f docker-compose.prod.yml exec -T api bun run prisma:generate
docker-compose -f docker-compose.prod.yml exec -T api bun run prisma:push

# Verificar que el API responde
log "Verificando salud del API..."
sleep 5
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    success "API funcionando correctamente"
else
    warn "API no responde en /health. Verificando logs..."
    docker-compose -f docker-compose.prod.yml logs api
fi

# Mostrar información del despliegue
success "¡Despliegue completado!"
echo ""
echo "📋 Información del despliegue:"
echo "   - API Backend: http://localhost:3001"
echo "   - Health Check: http://localhost:3001/health"
echo "   - Base de datos: PostgreSQL en puerto 5432"
echo ""
echo "📊 Estado de servicios:"
docker-compose -f docker-compose.prod.yml ps
echo ""
echo "📝 Para ver logs en tiempo real:"
echo "   docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo "🛑 Para detener servicios:"
echo "   docker-compose -f docker-compose.prod.yml down"
echo ""
echo "🔧 Para crear usuario admin:"
echo "   docker-compose -f docker-compose.prod.yml exec api bun run create-admin"

success "BikeDreams Backend está listo para producción! 🚴‍♂️"
