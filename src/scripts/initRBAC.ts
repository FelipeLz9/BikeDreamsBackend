#!/usr/bin/env tsx

import { prisma } from '../prisma/client.js';
import { RBACService } from '../services/rbacService.js';
import { Role, PermissionAction } from '@prisma/client';
import bcrypt from 'bcrypt';

/**
 * Script para inicializar el sistema RBAC
 * - Crear permisos por defecto
 * - Crear usuario super admin si no existe
 * - Configurar roles básicos
 */

async function initializeRBAC() {
  try {
    console.log('🔐 Inicializando sistema RBAC...\n');

    // 1. Inicializar permisos por defecto
    console.log('📋 Creando permisos por defecto...');
    const permissionsResult = await RBACService.initializeDefaultPermissions();
    
    if (permissionsResult.success) {
      console.log('✅ Permisos inicializados correctamente');
    } else {
      console.log('❌ Error inicializando permisos:', permissionsResult.error);
      return;
    }

    // 2. Verificar o crear usuario super admin
    console.log('\n👑 Verificando usuario Super Admin...');
    
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'CHANGE_ME_123!';
    const adminName = process.env.ADMIN_NAME || 'Super Administrador';

    let superAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (!superAdmin) {
      console.log('🔨 Creando usuario Super Admin...');
      
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      
      superAdmin = await prisma.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          password: hashedPassword,
          role: Role.SUPER_ADMIN,
          isActive: true
        }
      });
      
      console.log('✅ Super Admin creado:', {
        email: adminEmail,
        name: adminName,
        role: 'SUPER_ADMIN'
      });
    } else {
      // Actualizar a SUPER_ADMIN si no lo es
      if (superAdmin.role !== Role.SUPER_ADMIN) {
        await prisma.user.update({
          where: { id: superAdmin.id },
          data: { role: Role.SUPER_ADMIN }
        });
        console.log('✅ Usuario actualizado a SUPER_ADMIN');
      } else {
        console.log('✅ Super Admin ya existe');
      }
    }

    // 3. Crear algunos usuarios de ejemplo con diferentes roles
    console.log('\n👥 Creando usuarios de ejemplo...');
    
    const exampleUsers = [
      {
        name: 'Administrador General',
        email: 'admin.general@example.com',
        role: Role.ADMIN,
        password: 'Admin123!'
      },
      {
        name: 'Moderador de Contenido',
        email: 'moderador@example.com',
        role: Role.MODERATOR,
        password: 'Mod123!'
      },
      {
        name: 'Editor de Eventos',
        email: 'editor@example.com',
        role: Role.EDITOR,
        password: 'Editor123!'
      },
      {
        name: 'Gestor de Eventos',
        email: 'events@example.com',
        role: Role.EVENT_MANAGER,
        password: 'Events123!'
      },
      {
        name: 'Usuario Cliente',
        email: 'cliente@example.com',
        role: Role.CLIENT,
        password: 'Client123!'
      }
    ];

    for (const userData of exampleUsers) {
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(userData.password, 12);
        
        await prisma.user.create({
          data: {
            name: userData.name,
            email: userData.email,
            password: hashedPassword,
            role: userData.role,
            isActive: true
          }
        });
        
        console.log(`✅ Usuario ${userData.role} creado: ${userData.email}`);
      } else {
        console.log(`ℹ️  Usuario ya existe: ${userData.email}`);
      }
    }

    // 4. Crear algunas políticas de ejemplo
    console.log('\n📜 Creando políticas de recurso de ejemplo...');
    
    const examplePolicies = [
      {
        resource: 'events',
        resourceId: null, // Política general
        policy: {
          actions: ['CREATE', 'UPDATE', 'DELETE'],
          roles: ['ADMIN', 'EVENT_MANAGER'],
          description: 'Solo admins y gestores de eventos pueden modificar eventos'
        },
        conditions: {
          timeRange: null, // Sin restricciones de tiempo
          ipRange: null    // Sin restricciones de IP
        },
        priority: 10,
        effect: 'ALLOW'
      },
      {
        resource: 'users',
        resourceId: null,
        policy: {
          actions: ['UPDATE', 'DELETE'],
          roles: ['SUPER_ADMIN', 'ADMIN', 'USER_MANAGER'],
          description: 'Gestión de usuarios limitada a roles específicos'
        },
        conditions: null,
        priority: 20,
        effect: 'ALLOW'
      }
    ];

    for (const policyData of examplePolicies) {
      const existingPolicy = await prisma.resourcePolicy.findFirst({
        where: {
          resource: policyData.resource,
          resourceId: policyData.resourceId,
          priority: policyData.priority
        }
      });

      if (!existingPolicy) {
        await prisma.resourcePolicy.create({
          data: policyData as any
        });
        console.log(`✅ Política creada para ${policyData.resource}`);
      } else {
        console.log(`ℹ️  Política ya existe para ${policyData.resource}`);
      }
    }

    // 5. Mostrar estadísticas finales
    console.log('\n📊 Estadísticas del sistema RBAC:');
    const stats = await RBACService.getUserEffectivePermissions(superAdmin.id);
    
    if (stats.success) {
      console.log('✅ Super Admin tiene', stats.permissions?.length || 0, 'permisos efectivos');
    }

    const totalUsers = await prisma.user.count();
    const totalPermissions = await prisma.permission.count();
    const totalPolicies = await prisma.resourcePolicy.count();
    
    console.log('📈 Usuarios totales:', totalUsers);
    console.log('📈 Permisos totales:', totalPermissions);
    console.log('📈 Políticas totales:', totalPolicies);
    
    console.log('\n🎉 Sistema RBAC inicializado correctamente!');
    console.log('\n📋 Usuarios creados:');
    console.log('Email:', adminEmail, '| Contraseña:', adminPassword, '| Rol: SUPER_ADMIN');
    
    exampleUsers.forEach(user => {
      console.log(`Email: ${user.email} | Contraseña: ${user.password} | Rol: ${user.role}`);
    });
    
    console.log('\n⚠️  IMPORTANTE: Cambia las contraseñas por defecto en producción!');

  } catch (error) {
    console.error('❌ Error inicializando RBAC:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar script
initializeRBAC()
  .then(() => {
    console.log('\n✅ Inicialización completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
