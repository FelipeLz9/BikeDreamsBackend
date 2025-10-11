# 🔒 Configuración de Seguridad - BikeDreams Backend

## ⚠️ ALERTA DE SEGURIDAD RESUELTA

**Fecha**: 11 de Octubre, 2025
**Problema**: GitGuardian detectó credenciales de correo electrónico de empresa expuestas en el repositorio
**Estado**: ✅ RESUELTO

### Acciones Tomadas:
1. ✅ Eliminadas credenciales del directorio de trabajo
2. ✅ Limpiado historial de Git usando `git filter-branch`
3. ✅ Reescrito historial en GitHub con `git push --force`
4. ✅ Verificado que no quedan credenciales en el historial
5. ✅ Creados templates seguros para configuración

---

## 🚨 ACCIÓN REQUERIDA INMEDIATA

### 1. Cambiar Contraseñas Comprometidas

Las siguientes credenciales fueron expuestas y **DEBEN** cambiarse inmediatamente:

#### Correos Electrónicos Expuestos:
- `admin@bikedreams.com`
- `security@bikedreams.com`
- `security-alerts@bikedreams.com`
- `dev@bikedreams.com`
- `admin.general@bikedreams.com`
- `moderador@bikedreams.com`
- `editor@bikedreams.com`
- `events@bikedreams.com`
- `cliente@bikedreams.com`

#### Contraseñas Expuestas:
- `SuperAdmin123!` → **CAMBIAR INMEDIATAMENTE**
- `secure-admin-password-with-symbols-123!` → **CAMBIAR INMEDIATAMENTE**
- Cualquier contraseña asociada a los correos listados

### 2. Configurar Variables de Entorno Seguras

#### Para Desarrollo Local:
```bash
# Copiar el template
cp .env.template .env.production

# Editar el archivo con credenciales reales (NUNCA commitear este archivo)
nano .env.production
```

#### Para GitHub Actions (CI/CD):
Ve a tu repositorio en GitHub → Settings → Secrets and variables → Actions

**Secrets requeridos:**
```
DB_USER=tu_usuario_db
DB_PASSWORD=nueva_password_db_segura
DB_HOST=tu_host_db
DB_NAME=bikedreams_prod
JWT_SECRET_KEY=nueva_clave_jwt_super_segura_min_32_chars
REFRESH_TOKEN_SECRET=otra_clave_diferente_para_refresh_tokens
SERVER_URL=https://api.tudominio.com
FRONTEND_URL=https://tudominio.com
ALLOWED_ORIGINS=https://tudominio.com,https://www.tudominio.com
SMTP_HOST=smtp.gmail.com
SMTP_USER=nuevo_email_para_alertas@tudominio.com
SMTP_PASSWORD=nueva_app_password_smtp
COMPANY_EMAIL_FROM=noreply@tudominio.com
SECURITY_ALERT_EMAIL=security@tudominio.com
ADMIN_EMAIL=admin@tudominio.com
ADMIN_PASSWORD=nueva_password_admin_super_segura_123!
REDIS_PASSWORD=nueva_password_redis
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/TU/WEBHOOK/URL
```

### 3. Verificar Configuración de Email

Si usas Gmail/Google Workspace:
1. Habilita autenticación de 2 factores
2. Genera contraseñas de aplicación específicas
3. No uses la contraseña principal de la cuenta

### 4. Configurar Alertas de Monitoreo

Configura alertas para:
- Intentos de login fallidos
- Accesos desde IPs desconocidas
- Cambios de configuración crítica
- Actividad administrativa inusual

---

## 📋 Checklist de Seguridad

### Inmediato (Próximas 24 horas):
- [ ] Cambiar TODAS las contraseñas comprometidas
- [ ] Configurar nuevos correos para alertas de seguridad
- [ ] Verificar accesos recientes a cuentas de correo
- [ ] Configurar autenticación de 2 factores en cuentas críticas
- [ ] Configurar GitHub Secrets con nuevas credenciales

### Corto plazo (Próxima semana):
- [ ] Implementar rotación automática de secretos
- [ ] Configurar alertas de seguridad en Slack/Email
- [ ] Auditar todos los accesos a sistemas críticos
- [ ] Revisar logs de acceso de las últimas semanas
- [ ] Configurar monitoreo de vulnerabilidades

### Largo plazo:
- [ ] Implementar HashiCorp Vault u otro gestor de secretos
- [ ] Configurar análisis de seguridad automatizado
- [ ] Establecer política de rotación de credenciales
- [ ] Capacitar al equipo en mejores prácticas de seguridad

---

## 🔧 Comandos de Emergencia

### Verificar estado actual del repositorio:
```bash
# Verificar que no hay credenciales en el historial
git log --all --full-history -S "password" --source --all

# Buscar cualquier referencia a emails corporativos
grep -r "@bikedreams.com" .

# Verificar archivos sensibles no están trackeados
git ls-files | grep -E '\.(env|key|pem|p12)$'
```

### En caso de nuevas filtraciones:
```bash
# Limpiar archivos específicos del historial
git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch path/to/sensitive/file' --prune-empty --tag-name-filter cat -- --all

# Limpiar contenido específico
git filter-branch --force --tree-filter 'find . -type f -exec sed -i "s/TEXTO_SENSIBLE/REEMPLAZO/g" {} \;' -- --all

# Limpiar referencias y forzar push
git for-each-ref --format='delete %(refname)' refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force origin main
```

---

## 📞 Contacto de Emergencia

En caso de detectar actividad sospechosa o comprometimiento adicional:
1. Cambiar inmediatamente todas las credenciales
2. Revisar logs de acceso en todos los sistemas
3. Contactar al equipo de seguridad
4. Documentar el incidente

---

## 🔍 Herramientas de Monitoreo

- **GitGuardian**: Ya detectó la filtración inicial
- **GitHub Security**: Revisar regularmente las alertas
- **Dependabot**: Mantener dependencias actualizadas
- **npm audit**: Ejecutar regularmente análisis de vulnerabilidades

```bash
# Análisis de seguridad local
npm audit --audit-level high
npm audit fix

# Escaneo de secretos local
git-secrets --scan
truffleHog --regex --entropy=False .
```

---

**⚠️ RECORDATORIO**: Este documento contiene información sensible sobre la configuración de seguridad. Mantener actualizado y accesible solo para personal autorizado.