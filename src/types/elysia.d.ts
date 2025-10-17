// Type augmentation for Elysia Context to include auth/ RBAC fields we derive
import 'elysia';

declare module 'elysia' {
  interface Context {
    user?: {
      id: string;
      name?: string;
      email?: string;
      role: string;
      isActive?: boolean;
      lastLogin?: Date | string | null;
      createdAt?: Date | string;
      updatedAt?: Date | string;
    } | null;
    isAuthenticated?: boolean;
    tokenPayload?: any;
    clientIp?: string;
    userAgent?: string;
    tokenError?: string;
    permissionContext?: any;
  }
}


