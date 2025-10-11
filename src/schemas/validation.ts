import { z } from 'zod';
import { Role, PermissionAction } from '@prisma/client';

// Esquemas de validación básicos
export const BasicValidation = {
  // IDs
  uuid: z.string().uuid('ID debe ser un UUID válido'),
  objectId: z.string().min(1, 'ID es requerido'),
  
  // Strings
  nonEmptyString: z.string().min(1, 'Campo no puede estar vacío'),
  name: z.string()
    .min(2, 'Nombre debe tener al menos 2 caracteres')
    .max(100, 'Nombre no puede exceder 100 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/, 'Nombre solo puede contener letras y espacios'),
  
  // Email
  email: z.string()
    .email('Email debe tener formato válido')
    .min(5, 'Email debe tener al menos 5 caracteres')
    .max(254, 'Email no puede exceder 254 caracteres')
    .toLowerCase(),
  
  // Password
  password: z.string()
    .min(8, 'Contraseña debe tener al menos 8 caracteres')
    .max(128, 'Contraseña no puede exceder 128 caracteres')
    .regex(/^(?=.*[a-z])/, 'Contraseña debe contener al menos una minúscula')
    .regex(/^(?=.*[A-Z])/, 'Contraseña debe contener al menos una mayúscula')
    .regex(/^(?=.*\d)/, 'Contraseña debe contener al menos un número')
    .regex(/^(?=.*[!@#$%^&*(),.?":{}|<>])/, 'Contraseña debe contener al menos un símbolo especial'),
  
  // URLs
  url: z.string().url('URL debe tener formato válido').optional(),
  
  // Dates
  dateString: z.string().datetime('Fecha debe tener formato ISO válido'),
  futureDate: z.string().datetime().refine(
    (date) => new Date(date) > new Date(),
    'Fecha debe ser en el futuro'
  ),
  
  // Numbers
  positiveInt: z.number().int().positive('Debe ser un número entero positivo'),
  nonNegativeInt: z.number().int().min(0, 'Debe ser un número entero no negativo'),
  
  // Arrays
  stringArray: z.array(z.string()).default([]),
  nonEmptyArray: <T>(schema: z.ZodType<T>) => z.array(schema).min(1, 'Array no puede estar vacío'),
  
  // Enums
  role: z.nativeEnum(Role),
  permissionAction: z.nativeEnum(PermissionAction),
  
  // File uploads
  fileSize: z.number().max(10 * 1024 * 1024, 'Archivo no puede exceder 10MB'),
  imageFile: z.object({
    name: z.string().min(1, 'Nombre de archivo requerido'),
    size: z.number().max(5 * 1024 * 1024, 'Imagen no puede exceder 5MB'),
    type: z.string().regex(/^image\/(jpeg|jpg|png|gif|webp)$/i, 'Solo se permiten imágenes JPEG, PNG, GIF o WebP')
  }),
  
  // Search and filters
  searchQuery: z.string()
    .min(1, 'Consulta de búsqueda no puede estar vacía')
    .max(100, 'Consulta de búsqueda no puede exceder 100 caracteres')
    .regex(/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\-_]+$/, 'Consulta contiene caracteres no válidos'),
  
  // Pagination
  page: z.number().int().min(1, 'Página debe ser mayor a 0').default(1),
  limit: z.number().int().min(1, 'Límite debe ser mayor a 0').max(100, 'Límite no puede exceder 100').default(10),
  
  // Content
  content: z.string()
    .min(1, 'Contenido no puede estar vacío')
    .max(10000, 'Contenido no puede exceder 10000 caracteres'),
  
  // Location
  latitude: z.number().min(-90, 'Latitud inválida').max(90, 'Latitud inválida'),
  longitude: z.number().min(-180, 'Longitud inválida').max(180, 'Longitud inválida'),
};

// Esquemas de autenticación
export const AuthSchemas = {
  register: z.object({
    name: BasicValidation.name,
    email: BasicValidation.email,
    password: BasicValidation.password,
    acceptTerms: z.boolean().refine(val => val === true, 'Debe aceptar los términos y condiciones')
  }),
  
  login: z.object({
    email: BasicValidation.email,
    password: z.string().min(1, 'Contraseña es requerida')
  }),
  
  refreshToken: z.object({
    refreshToken: z.string().min(1, 'Token de renovación es requerido')
  }),
  
  changePassword: z.object({
    currentPassword: z.string().min(1, 'Contraseña actual es requerida'),
    newPassword: BasicValidation.password,
    confirmPassword: z.string().min(1, 'Confirmación de contraseña es requerida')
  }).refine(
    (data) => data.newPassword === data.confirmPassword,
    {
      message: 'Las contraseñas no coinciden',
      path: ['confirmPassword']
    }
  ),
  
  resetPassword: z.object({
    email: BasicValidation.email
  }),
  
  confirmReset: z.object({
    token: z.string().min(1, 'Token es requerido'),
    newPassword: BasicValidation.password
  })
};

// Esquemas de usuarios
export const UserSchemas = {
  create: z.object({
    name: BasicValidation.name,
    email: BasicValidation.email,
    password: BasicValidation.password,
    role: BasicValidation.role.default(Role.CLIENT),
    avatar: BasicValidation.url
  }),
  
  update: z.object({
    name: BasicValidation.name.optional(),
    email: BasicValidation.email.optional(),
    avatar: BasicValidation.url,
    racesWon: BasicValidation.nonNegativeInt.optional(),
    photos: BasicValidation.stringArray.optional()
  }),
  
  updateProfile: z.object({
    name: BasicValidation.name.optional(),
    avatar: BasicValidation.url,
    racesWon: BasicValidation.nonNegativeInt.optional()
  }),
  
  list: z.object({
    page: BasicValidation.page,
    limit: BasicValidation.limit,
    search: BasicValidation.searchQuery.optional(),
    role: BasicValidation.role.optional(),
    isActive: z.boolean().optional()
  })
};

// Esquemas de eventos
export const EventSchemas = {
  create: z.object({
    name: z.string().min(3, 'Nombre debe tener al menos 3 caracteres').max(200, 'Nombre no puede exceder 200 caracteres'),
    date: BasicValidation.dateString,
    location: z.string().min(3, 'Ubicación debe tener al menos 3 caracteres').max(200, 'Ubicación no puede exceder 200 caracteres'),
    details: BasicValidation.content.optional(),
    city: z.string().max(100, 'Ciudad no puede exceder 100 caracteres').optional(),
    continent: z.string().max(50, 'Continente no puede exceder 50 caracteres').optional(),
    country: z.string().max(100, 'País no puede exceder 100 caracteres').optional(),
    state: z.string().max(100, 'Estado no puede exceder 100 caracteres').optional(),
    latitude: BasicValidation.latitude.optional(),
    longitude: BasicValidation.longitude.optional(),
    end_date: BasicValidation.dateString.optional(),
    is_uci_event: z.boolean().default(false),
    details_url: BasicValidation.url
  }),
  
  update: z.object({
    name: z.string().min(3).max(200).optional(),
    date: BasicValidation.dateString.optional(),
    location: z.string().min(3).max(200).optional(),
    details: BasicValidation.content.nullable().optional(),
    city: z.string().max(100).nullable().optional(),
    continent: z.string().max(50).nullable().optional(),
    country: z.string().max(100).nullable().optional(),
    state: z.string().max(100).nullable().optional(),
    latitude: BasicValidation.latitude.nullable().optional(),
    longitude: BasicValidation.longitude.nullable().optional(),
    end_date: BasicValidation.dateString.nullable().optional(),
    is_uci_event: z.boolean().optional(),
    details_url: BasicValidation.url.nullable()
  }),
  
  list: z.object({
    page: BasicValidation.page,
    limit: BasicValidation.limit,
    search: BasicValidation.searchQuery.optional(),
    city: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
    continent: z.string().max(50).optional(),
    is_uci_event: z.boolean().optional(),
    date_from: BasicValidation.dateString.optional(),
    date_to: BasicValidation.dateString.optional(),
    orderBy: z.enum(['date', 'name', 'location', 'createdAt']).default('date'),
    orderDirection: z.enum(['asc', 'desc']).default('asc')
  })
};

// Esquemas de noticias
export const NewsSchemas = {
  create: z.object({
    title: z.string().min(5, 'Título debe tener al menos 5 caracteres').max(200, 'Título no puede exceder 200 caracteres'),
    content: BasicValidation.content,
    author: z.string().max(100, 'Autor no puede exceder 100 caracteres').optional(),
    category: z.string().max(50, 'Categoría no puede exceder 50 caracteres').optional(),
    excerpt: z.string().max(500, 'Resumen no puede exceder 500 caracteres').optional(),
    url: BasicValidation.url,
    published_at: BasicValidation.dateString.optional()
  }),
  
  update: z.object({
    title: z.string().min(5).max(200).optional(),
    content: BasicValidation.content.optional(),
    author: z.string().max(100).nullable().optional(),
    category: z.string().max(50).nullable().optional(),
    excerpt: z.string().max(500).nullable().optional(),
    url: BasicValidation.url.nullable().optional(),
    published_at: BasicValidation.dateString.nullable().optional()
  }),
  
  list: z.object({
    page: BasicValidation.page,
    limit: BasicValidation.limit,
    search: BasicValidation.searchQuery.optional(),
    category: z.string().max(50).optional(),
    author: z.string().max(100).optional(),
    orderBy: z.enum(['published_at', 'createdAt', 'title']).default('published_at'),
    orderDirection: z.enum(['asc', 'desc']).default('desc')
  })
};

// Esquemas de foro
export const ForumSchemas = {
  create: z.object({
    title: z.string().min(5, 'Título debe tener al menos 5 caracteres').max(200, 'Título no puede exceder 200 caracteres'),
    content: BasicValidation.content
  }),
  
  update: z.object({
    title: z.string().min(5).max(200).optional(),
    content: BasicValidation.content.optional()
  }),
  
  list: z.object({
    page: BasicValidation.page,
    limit: BasicValidation.limit,
    search: BasicValidation.searchQuery.optional(),
    userId: BasicValidation.uuid.optional(),
    orderBy: z.enum(['createdAt', 'title']).default('createdAt'),
    orderDirection: z.enum(['asc', 'desc']).default('desc')
  })
};

// Esquemas de donaciones
export const DonationSchemas = {
  create: z.object({
    amount: z.number().positive('Cantidad debe ser positiva').max(10000, 'Cantidad no puede exceder $10,000'),
    donorName: z.string().max(100, 'Nombre del donante no puede exceder 100 caracteres').optional(),
    isAnonymous: z.boolean().default(false),
    message: z.string().max(500, 'Mensaje no puede exceder 500 caracteres').optional()
  }),
  
  list: z.object({
    page: BasicValidation.page,
    limit: BasicValidation.limit,
    orderBy: z.enum(['createdAt', 'amount']).default('createdAt'),
    orderDirection: z.enum(['asc', 'desc']).default('desc')
  })
};

// Esquemas RBAC
export const RBACSchemas = {
  assignRole: z.object({
    role: BasicValidation.role,
    expiresAt: BasicValidation.dateString.optional()
  }),
  
  revokeRole: z.object({
    role: BasicValidation.role
  }),
  
  grantPermission: z.object({
    permissionId: BasicValidation.uuid,
    expiresAt: BasicValidation.dateString.optional()
  }),
  
  revokePermission: z.object({
    permissionId: BasicValidation.uuid
  }),
  
  checkPermission: z.object({
    resource: z.string().min(1, 'Recurso es requerido'),
    action: BasicValidation.permissionAction,
    resourceId: BasicValidation.uuid.optional()
  }),
  
  usersList: z.object({
    page: BasicValidation.page,
    limit: BasicValidation.limit,
    search: BasicValidation.searchQuery.optional(),
    role: BasicValidation.role.optional()
  })
};

// Esquemas de archivos
export const FileSchemas = {
  upload: z.object({
    files: z.array(BasicValidation.imageFile).min(1, 'Debe seleccionar al menos un archivo')
  }),
  
  avatar: z.object({
    file: BasicValidation.imageFile
  })
};

// Esquemas de búsqueda
export const SearchSchemas = {
  global: z.object({
    q: BasicValidation.searchQuery,
    type: z.enum(['all', 'events', 'news', 'forum', 'users']).default('all'),
    page: BasicValidation.page,
    limit: BasicValidation.limit
  })
};

// Función helper para validar parámetros de ruta
export const ParamSchemas = {
  uuid: z.object({
    id: BasicValidation.uuid
  }),
  
  userId: z.object({
    userId: BasicValidation.uuid
  }),
  
  eventId: z.object({
    eventId: BasicValidation.uuid
  }),
  
  newsId: z.object({
    newsId: BasicValidation.uuid
  }),
  
  postId: z.object({
    postId: BasicValidation.uuid
  })
};

// Esquemas de configuración del sistema
export const SystemSchemas = {
  config: z.object({
    siteName: z.string().min(1).max(100),
    siteDescription: z.string().max(500),
    contactEmail: BasicValidation.email,
    maintenanceMode: z.boolean().default(false)
  }),
  
  sync: z.object({
    syncEvents: z.boolean().default(true),
    syncNews: z.boolean().default(true),
    syncUsabmx: z.boolean().default(true),
    syncUci: z.boolean().default(true),
    frequency: z.enum(['hourly', 'daily', 'weekly']).default('daily')
  })
};

// Función para crear validador personalizado
export const createCustomValidator = <T>(
  schema: z.ZodType<T>,
  customErrorMessage?: string
) => {
  return (data: unknown): { success: true; data: T } | { success: false; errors: string[] } => {
    try {
      const validated = schema.parse(data);
      return { success: true, data: validated };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => {
          const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
          return `${path}${err.message}`;
        });
        return { success: false, errors };
      }
      return { 
        success: false, 
        errors: [customErrorMessage || 'Error de validación desconocido'] 
      };
    }
  };
};
