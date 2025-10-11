import { z } from 'zod';

// Esquemas específicos para autenticación
export const loginSchema = z.object({
  email: z
    .string({ required_error: 'El email es requerido' })
    .email('El email debe tener un formato válido')
    .min(5, 'El email debe tener al menos 5 caracteres')
    .max(255, 'El email no puede exceder 255 caracteres')
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'La contraseña es requerida' })
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'La contraseña no puede exceder 128 caracteres'),
  rememberMe: z.boolean().optional().default(false),
  deviceInfo: z.object({
    userAgent: z.string().optional(),
    ip: z.string().optional(),
    fingerprint: z.string().optional()
  }).optional()
});

export const registerSchema = z.object({
  email: z
    .string({ required_error: 'El email es requerido' })
    .email('El email debe tener un formato válido')
    .min(5, 'El email debe tener al menos 5 caracteres')
    .max(255, 'El email no puede exceder 255 caracteres')
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'La contraseña es requerida' })
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'La contraseña no puede exceder 128 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'La contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial'),
  confirmPassword: z
    .string({ required_error: 'La confirmación de contraseña es requerida' }),
  name: z
    .string({ required_error: 'El nombre es requerido' })
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s''-]+$/, 'El nombre solo puede contener letras, espacios, apostrofes y guiones')
    .trim(),
  acceptTerms: z
    .boolean({ required_error: 'Debes aceptar los términos y condiciones' })
    .refine((val) => val === true, 'Debes aceptar los términos y condiciones'),
  acceptPrivacy: z
    .boolean({ required_error: 'Debes aceptar la política de privacidad' })
    .refine((val) => val === true, 'Debes aceptar la política de privacidad'),
  newsletter: z.boolean().optional().default(false)
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword']
  }
);

export const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ required_error: 'El refresh token es requerido' })
    .min(10, 'Token inválido')
    .max(500, 'Token inválido'),
  deviceInfo: z.object({
    userAgent: z.string().optional(),
    ip: z.string().optional(),
    fingerprint: z.string().optional()
  }).optional()
});

export const changePasswordSchema = z.object({
  currentPassword: z
    .string({ required_error: 'La contraseña actual es requerida' })
    .min(8, 'Contraseña actual inválida')
    .max(128, 'Contraseña actual inválida'),
  newPassword: z
    .string({ required_error: 'La nueva contraseña es requerida' })
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .max(128, 'La nueva contraseña no puede exceder 128 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'La nueva contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial'),
  confirmNewPassword: z
    .string({ required_error: 'La confirmación de la nueva contraseña es requerida' })
}).refine(
  (data) => data.newPassword === data.confirmNewPassword,
  {
    message: 'Las nuevas contraseñas no coinciden',
    path: ['confirmNewPassword']
  }
).refine(
  (data) => data.currentPassword !== data.newPassword,
  {
    message: 'La nueva contraseña debe ser diferente a la actual',
    path: ['newPassword']
  }
);

export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: 'El email es requerido' })
    .email('El email debe tener un formato válido')
    .min(5, 'El email debe tener al menos 5 caracteres')
    .max(255, 'El email no puede exceder 255 caracteres')
    .toLowerCase()
    .trim()
});

export const resetPasswordSchema = z.object({
  token: z
    .string({ required_error: 'El token de restablecimiento es requerido' })
    .min(10, 'Token inválido')
    .max(255, 'Token inválido'),
  password: z
    .string({ required_error: 'La contraseña es requerida' })
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'La contraseña no puede exceder 128 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'La contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial'),
  confirmPassword: z
    .string({ required_error: 'La confirmación de contraseña es requerida' })
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword']
  }
);

export const verifyEmailSchema = z.object({
  token: z
    .string({ required_error: 'El token de verificación es requerido' })
    .min(10, 'Token inválido')
    .max(255, 'Token inválido')
});

export const resendVerificationSchema = z.object({
  email: z
    .string({ required_error: 'El email es requerido' })
    .email('El email debe tener un formato válido')
    .min(5, 'El email debe tener al menos 5 caracteres')
    .max(255, 'El email no puede exceder 255 caracteres')
    .toLowerCase()
    .trim()
});

// Tipos TypeScript derivados de los esquemas
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
