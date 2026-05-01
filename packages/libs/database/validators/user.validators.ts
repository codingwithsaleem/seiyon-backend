import { z } from 'zod';

export const userIdSchema = z.object({
  userId: z.string().uuid(),
});

export const userEmailSchema = z.object({
  email: z.string().email(),
});

export const userNameSchema = z.object({
  fullName: z.string().min(2).max(100),
});

export const userPasswordSchema = z.object({
  password: z.string().min(8).max(100),
});

export const userProfileUpdateSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
});
