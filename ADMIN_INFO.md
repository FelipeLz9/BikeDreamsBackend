# 🔐 Información del Panel de Administración

## 👨‍💼 Credenciales del Administrador

```
Email: admin@bmxclub.com
Contraseña: admin123456
```

**🔐 IMPORTANTE: Cambia la contraseña después del primer login**

## 🚀 Cómo acceder al Panel

1. Asegúrate de que el backend esté corriendo:
   ```bash
   cd bikedreams-backend
   npm run dev
   ```

2. Ve a tu aplicación frontend: `http://localhost:3000/login`

3. Inicia sesión con las credenciales de arriba

4. Una vez logueado, haz clic en tu nombre → "Administración"

5. ¡Ya estás en el panel de admin!

## 🛠️ Endpoints de Administración Creados

### Base URL: `http://localhost:3001`

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/admin/stats` | Estadísticas del sistema |
| `GET` | `/admin/users` | Lista de todos los usuarios |
| `POST` | `/admin/users` | Crear nuevo usuario |
| `PUT` | `/admin/users/:id` | Actualizar usuario existente |
| `DELETE` | `/admin/users/:id` | Eliminar usuario |

### 🔑 Autenticación Requerida

Todos los endpoints de admin requieren el header de autorización:
```
Authorization: Bearer <tu-token-jwt>
```

### 📝 Ejemplo de Uso (crear usuario):

```bash
curl -X POST http://localhost:3001/admin/users \
  -H "Authorization: Bearer <tu-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nuevo Ciclista",
    "email": "ciclista@bmx.com",
    "password": "password123",
    "role": "CLIENT"
  }'
```

## 🎯 Funcionalidades Implementadas

✅ **Panel de Administración**
- Dashboard con estadísticas
- Vista de todos los usuarios
- Protección de rutas (solo admins)

✅ **Gestión de Usuarios**
- Crear usuarios con rol ADMIN o CLIENT
- Editar usuarios existentes
- Eliminar usuarios (con protección)
- Búsqueda y filtros

✅ **Seguridad**
- Verificación de permisos de administrador
- Protección contra auto-eliminación
- Validación de datos

✅ **Interfaz Completa**
- Tablas responsivas
- Modales para formularios
- Confirmaciones de eliminación
- Mensajes de error y éxito

## 🔧 Scripts Útiles

```bash
# Crear nuevo usuario administrador
npm run create-admin

# Iniciar servidor de desarrollo
npm run dev

# Iniciar servidor de producción
npm run start
```

## 📋 Notas Importantes

1. **Solo los administradores pueden crear cuentas** - No hay registro público
2. **Las contraseñas se encriptan automáticamente** con bcrypt
3. **Los tokens JWT expiran en 24 horas**
4. **El sistema valida emails únicos**
5. **Los administradores no pueden eliminarse a sí mismos**

¡El sistema está listo para pruebas y producción! 🚀
