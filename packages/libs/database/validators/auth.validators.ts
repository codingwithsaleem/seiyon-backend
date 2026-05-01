import z from 'zod';
import { UserRole, Gender } from '../enums';
import { OtpType } from '@prisma/client';

// Verify user registration

export const UserRegisterSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100, 'Full name must be at most 100 characters'),
  email: z.string().email('Invalid email address'),
  age: z.number().int().min(13, 'You must be at least 13 years old').max(120, 'Invalid age').optional(), // Age is optional, will calculate from DOB if provided
  gender: z.nativeEnum(Gender, {
    errorMap: () => ({ message: 'Invalid gender. Must be MALE, FEMALE, OTHER, or PREFER_NOT_TO_SAY' }),
  }),
  countyId: z.string().uuid('Invalid county ID').optional(), // County ID (user can select county during registration)
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(
      /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,128}$/,
      'Password must contain at least one letter, one number, and one special character'
    ),
  phoneNumber: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format (E.164)')
    .optional(), // Phone number is now optional
  username: z.string().min(2).max(100).optional(), // Optional - auto-generated from email if not provided
  role: z.nativeEnum(UserRole).optional().default(UserRole.USER),
});

// Verify user registration

export const verifyUserSchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{5}$/, 'OTP must be a 5-digit number'),
});

// User login
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

// Forgot password

export const forgotPasswordSchema = z
  .object({
    email: z.string().email().optional(),
    phoneNumber: z
      .string()
      .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
      .optional(),
  })
  .refine(data => data.email || data.phoneNumber, {
    message: 'Either email or phoneNumber must be provided',
  });

// Verify forgot password OTP

export const verifyForgotPasswordSchema = z
  .object({
    email: z.string().email().optional(),
    phoneNumber: z
      .string()
      .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
      .optional(),
    otp: z.string().regex(/^\d{5}$/, 'OTP must be a 5-digit number'),
  })
  .refine(data => data.email || data.phoneNumber, {
    message: 'Either email or phoneNumber must be provided',
  });

// Reset password
export const resetPasswordSchema = z.object({
  email: z.string().email(),
  newPassword: z
    .string()
    .min(8)
    .max(128)
    .regex(
      /[a-zA-Z0-9!@#$%^&*]{8,128}/,
      'Password must contain at least one letter, one number, and one special character'
    ),
});

// Resend Otp

export const resendOtpSchema = z
  .object({
    email: z.string().email().optional(),
    phoneNumber: z
      .string()
      .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
      .optional(),
    type: z.nativeEnum(OtpType).optional().default(OtpType.EMAIL_VERIFICATION),
  })
  .refine(data => data.email || data.phoneNumber, {
    message: 'Either email or phoneNumber must be provided',
  });

// SSO Schemas

export const ssoRegisterSchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
  // Optional user info sent by Apple on first auth
  user: z
    .object({
      fullName: z
        .object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export const ssoLoginSchema = z.object({
  email: z.string().email(),
  providerId: z.string().min(1, 'Provider ID is required'),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
});

// Export types
export type UserRegisterInput = z.infer<typeof UserRegisterSchema>;
export type VerifyUserInput = z.infer<typeof verifyUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type VerifyForgotPasswordInput = z.infer<
  typeof verifyForgotPasswordSchema
>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SsoRegisterInput = z.infer<typeof ssoRegisterSchema>;
export type SsoLoginInput = z.infer<typeof ssoLoginSchema>;
