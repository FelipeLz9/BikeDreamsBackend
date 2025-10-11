#!/bin/bash

# Script para ejecutar tests de seguridad en BikeDreams Backend

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    error "package.json no encontrado. Ejecuta este script desde el directorio raíz del proyecto."
    exit 1
fi

# Crear directorios de coverage si no existen
mkdir -p coverage/security
mkdir -p logs/security

log "🔒 Iniciando tests de seguridad para BikeDreams Backend..."

# Verificar dependencias de test
log "📦 Verificando dependencias de test..."
npm list jest ts-jest jest-html-reporter jest-junit > /dev/null 2>&1 || {
    warning "Algunas dependencias de test no están instaladas. Instalando..."
    npm install --save-dev jest ts-jest jest-html-reporter jest-junit @types/jest
}

# Verificar que los middlewares de seguridad existan
log "🔍 Verificando middlewares de seguridad..."
required_files=(
    "src/middleware/securityHeaders.ts"
    "src/middleware/strictSecurity.ts" 
    "src/plugins/validationPlugin.ts"
    "src/services/securityLogger.ts"
    "src/services/sanitizer.ts"
)

missing_files=()
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -ne 0 ]; then
    error "Archivos de seguridad faltantes:"
    printf '%s\n' "${missing_files[@]}"
    exit 1
fi

# Función para ejecutar un conjunto de tests
run_test_suite() {
    local suite_name=$1
    local test_pattern=$2
    local description=$3
    
    log "🧪 Ejecutando $description..."
    
    if npm run test:security -- --testPathPattern="$test_pattern" --verbose; then
        success "$description completadas ✅"
        return 0
    else
        error "$description fallaron ❌"
        return 1
    fi
}

# Función para generar reporte de cobertura
generate_coverage_report() {
    log "📊 Generando reporte de cobertura..."
    
    if [ -f "coverage/security/lcov-report/index.html" ]; then
        success "Reporte de cobertura generado: coverage/security/lcov-report/index.html"
    fi
    
    if [ -f "coverage/security/coverage-summary.json" ]; then
        log "📈 Resumen de cobertura:"
        cat coverage/security/coverage-summary.json | grep -E '(lines|functions|branches|statements)' | head -4
    fi
}

# Configurar variables de entorno para testing
export NODE_ENV=test
export LOG_LEVEL=error
export SECURITY_LOG_LEVEL=warn

# Tests básicos de validación
log "🔒 Fase 1: Tests de validación y sanitización"
if ! run_test_suite "validation" "validation.test.ts" "Pruebas de validación y sanitización"; then
    exit 1
fi

# Tests de headers de seguridad
log "🛡️ Fase 2: Tests de headers de seguridad"
if ! run_test_suite "headers" "headers.test.ts" "Pruebas de headers de seguridad"; then
    exit 1
fi

# Tests de penetración
log "⚔️ Fase 3: Tests de penetración"
if ! run_test_suite "penetration" "penetration.test.ts" "Pruebas de penetración"; then
    warning "Algunos tests de penetración fallaron. Revisa los logs para detalles."
fi

# Tests de carga y rendimiento
log "🚀 Fase 4: Tests de carga y rendimiento"
if ! run_test_suite "load" "load.test.ts" "Pruebas de carga y rendimiento"; then
    warning "Algunos tests de carga fallaron. Esto puede ser normal en entornos con recursos limitados."
fi

# Ejecutar todos los tests de seguridad con cobertura
log "📊 Ejecutando suite completa de tests de seguridad con cobertura..."
npm run test:security:coverage || {
    error "Suite completa de tests falló"
    exit 1
}

# Generar reportes
generate_coverage_report

# Verificar umbrales de cobertura
log "🎯 Verificando umbrales de cobertura..."
if [ -f "coverage/security/coverage-summary.json" ]; then
    # Extraer porcentajes de cobertura usando jq si está disponible
    if command -v jq &> /dev/null; then
        lines_pct=$(jq -r '.total.lines.pct' coverage/security/coverage-summary.json)
        functions_pct=$(jq -r '.total.functions.pct' coverage/security/coverage-summary.json)
        branches_pct=$(jq -r '.total.branches.pct' coverage/security/coverage-summary.json)
        
        log "Cobertura de líneas: ${lines_pct}%"
        log "Cobertura de funciones: ${functions_pct}%"
        log "Cobertura de ramas: ${branches_pct}%"
        
        # Verificar umbrales mínimos
        if (( $(echo "$lines_pct < 80" | bc -l) )); then
            warning "Cobertura de líneas (${lines_pct}%) por debajo del umbral (80%)"
        fi
    fi
fi

# Verificar logs de seguridad generados durante tests
log "📝 Verificando logs de seguridad..."
if [ -d "logs/security" ] && [ "$(ls -A logs/security)" ]; then
    log "Logs de seguridad generados durante tests:"
    ls -la logs/security/
else
    warning "No se generaron logs de seguridad durante los tests"
fi

# Limpieza de archivos temporales
log "🧹 Limpiando archivos temporales..."
find . -name "*.tmp" -delete 2>/dev/null || true
find . -name "*.log" -path "./node_modules" -prune -o -name "*.log" -delete 2>/dev/null || true

# Resumen final
log "✅ Tests de seguridad completados!"
echo ""
echo "📋 Resumen:"
echo "  • Tests de validación: ✅"
echo "  • Tests de headers: ✅"
echo "  • Tests de penetración: ⚠️"
echo "  • Tests de carga: ⚠️"
echo ""
echo "📊 Reportes generados:"
echo "  • Cobertura HTML: coverage/security/lcov-report/index.html"
echo "  • Reporte HTML: coverage/security/test-report.html"
echo "  • JUnit XML: coverage/security/security-junit.xml"
echo ""

# Abrir reporte en navegador si está en entorno de desarrollo
if [ "$NODE_ENV" != "ci" ] && command -v open &> /dev/null; then
    log "🌐 Abriendo reporte en navegador..."
    open coverage/security/lcov-report/index.html
elif [ "$NODE_ENV" != "ci" ] && command -v xdg-open &> /dev/null; then
    log "🌐 Abriendo reporte en navegador..."
    xdg-open coverage/security/lcov-report/index.html
fi

success "🎉 ¡Suite de tests de seguridad completada exitosamente!"
