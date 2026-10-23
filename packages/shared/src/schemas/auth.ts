import { z } from 'zod';
import { emailSchema, optionalText, passwordSchema, requiredText } from './common.js';

export const registerSchema = z
  .object({
    name: requiredText('Full name', 2, 100),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string({ error: 'Please confirm your password' }),
    companyName: optionalText('Company name', 120),
    jobTitle: optionalText('Job title', 120),
    acceptTerms: z.literal(true, { error: 'You must accept the terms and privacy policy' }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  // No strength rules at login: we only compare against the stored hash.
  password: z.string().min(1, 'Password is required').max(128),
});
export type LoginInput = z.input<typeof loginSchema>;

export const tokenSchema = z.object({
  token: z.string().min(20, 'Invalid or expired link').max(200, 'Invalid or expired link'),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

export const profileUpdateSchema = z.object({
  name: requiredText('Full name', 2, 100),
  companyName: optionalText('Company name', 120),
  jobTitle: optionalText('Job title', 120),
});
export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ['newPassword'],
    message: 'New password must be different from the current password',
  });
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
