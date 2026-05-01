import express, { Router } from 'express';
import {
  userRegister,
  verifyUserRegistration,
  userLogin,
  forgotPassword,
  verifyForgotPasswordOtp,
  resetPassword,
  refreshToken,
  userLogout,
  resendVerificationOtp,
} from '../../controller/auth.controller';
import {
  // googleRegister,
  // appleRegister,
  // appleLogin,
  // googleLogin,
  firebaseSSOLogin,
} from '../../controller/authsso.controller';
import { authenticateToken } from '../../../packages/utils/middlewares/auth.middleware';

const authRouter: Router = express.Router();

// =================================
// AUTHENTICATION ROUTES
// =================================

/**
 * @swagger
 * /auth/user-register:
 *   post:
 *     tags: [Auth]
 *     summary: Register new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - gender
 *               - password
 *             properties:
 *               fullName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: User full name
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *                 example: john.doe@example.com
 *               age:
 *                 type: integer
 *                 minimum: 13
 *                 maximum: 120
 *                 description: User age (optional, must be at least 13)
 *                 example: 25
 *               gender:
 *                 type: string
 *                 enum: [MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY]
 *                 description: User gender
 *                 example: MALE
 *               countyId:
 *                 type: string
 *                 format: uuid
 *                 description: County ID to follow during registration (optional)
 *                 example: 550e8400-e29b-41d4-a716-446655440000
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 128
 *                 description: User password (must contain at least one letter, one number, and one special character)
 *                 example: MyPass123!
 *     responses:
 *       200:
 *         description: User registered successfully, OTP sent to email
 *       400:
 *         description: Bad request - validation error
 *       409:
 *         description: Conflict - user already exists
 */
authRouter.post('/user-register', userRegister);

/**
 * @swagger
 * /auth/user-verify:
 *   post:
 *     tags: [Auth]
 *     summary: Verify user registration
 *     description: |
 *       Verify user email with OTP code and automatically log them in.
 *       Response includes user profile with age, gender, and followed counties.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email
 *                 example: john.doe@example.com
 *               otp:
 *                 type: string
 *                 description: 5-digit OTP code
 *                 example: "12345"
 *     responses:
 *       201:
 *         description: User verified and logged in successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         fullName:
 *                           type: string
 *                         age:
 *                           type: integer
 *                         gender:
 *                           type: string
 *                         counties:
 *                           type: array
 *                           description: Counties followed by user
 *                           items:
 *                             type: object
 *                     session:
 *                       type: object
 *                     tokens:
 *                       type: object
 *       400:
 *         description: Bad request - invalid OTP
 *       401:
 *         description: Unauthorized - OTP expired
 */
authRouter.post('/user-verify', verifyUserRegistration);

/**
 * @swagger
 * /auth/user-login:
 *   post:
 *     tags: [Auth]
 *     summary: User login
 *     description: |
 *       Authenticate user and return session with access tokens.
 *       Response includes user profile with age, gender, and followed counties.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email
 *                 example: john.doe@example.com
 *               password:
 *                 type: string
 *                 description: User password
 *                 example: MyPass123!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         fullName:
 *                           type: string
 *                         age:
 *                           type: integer
 *                         gender:
 *                           type: string
 *                         counties:
 *                           type: array
 *                           description: Counties followed by user
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               state:
 *                                 type: string
 *                               slug:
 *                                 type: string
 *                               coverImage:
 *                                 type: string
 *                               notificationsEnabled:
 *                                 type: boolean
 *                               followedAt:
 *                                 type: string
 *                                 format: date-time
 *                     session:
 *                       type: object
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *       401:
 *         description: Unauthorized - invalid credentials
 *       404:
 *         description: User not found
 */
authRouter.post('/user-login', userLogin);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset (sends OTP)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Bad request
 */
authRouter.post('/forgot-password', forgotPassword);

/**
 * @swagger
 * /auth/verify-forgot-password-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify OTP for password reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email
 *               otp:
 *                 type: string
 *                 description: 5-digit OTP code
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Bad request
 */
authRouter.post('/verify-forgot-password-otp', verifyForgotPasswordOtp);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: New password
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Bad request
 */
authRouter.post('/reset-password', resetPassword);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh JWT access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Unauthorized
 */
authRouter.post('/refresh-token', refreshToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: User logout
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: Session ID
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Unauthorized
 */
authRouter.post('/logout', authenticateToken, userLogout);

/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Resend OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email
 *               type:
 *                 type: string
 *                 description: OTP type - 'EMAIL_VERIFICATION' or 'PASSWORD_RESET'
 *                 example: EMAIL_VERIFICATION
 *                 enum: [EMAIL_VERIFICATION, PASSWORD_RESET]
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Bad request
 */
authRouter.post('/resend-otp', resendVerificationOtp);

// =================================
// SSO AUTHENTICATION ROUTES
// =================================

// Apple SSO Routes (Commented out)
// /**
//  * @swagger
//  * /auth/apple/register:
//  *   post:
//  *     tags: [Auth - SSO]
//  *     summary: Register with Apple
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - idToken
//  *             properties:
//  *               idToken:
//  *                 type: string
//  *                 description: SSO ID token
//  *     responses:
//  *       201:
//  *         description: Registration successful
//  *       400:
//  *         description: Bad request
//  */
// authRouter.post('/apple/register', appleRegister);

// /**
//  * @swagger
//  * /auth/apple/login:
//  *   post:
//  *     tags: [Auth - SSO]
//  *     summary: Login with Apple
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - idToken
//  *             properties:
//  *               idToken:
//  *                 type: string
//  *                 description: SSO ID token
//  *     responses:
//  *       200:
//  *         description: Login successful
//  *       401:
//  *         description: Unauthorized
//  */
// authRouter.post('/apple/login', appleLogin);

// Google SSO Routes (Commented out)
// /**
//  * @swagger
//  * /auth/google/register:
//  *   post:
//  *     tags: [Auth - SSO]
//  *     summary: Register with Google
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - idToken
//  *             properties:
//  *               idToken:
//  *                 type: string
//  *                 description: SSO ID token
//  *     responses:
//  *       201:
//  *         description: Registration successful
//  *       400:
//  *         description: Bad request
//  */
// authRouter.post('/google/register', googleRegister);

// /**
//  * @swagger
//  * /auth/google/login:
//  *   post:
//  *     tags: [Auth - SSO]
//  *     summary: Login with Google
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - idToken
//  *             properties:
//  *               idToken:
//  *                 type: string
//  *                 description: SSO ID token
//  *     responses:
//  *       200:
//  *         description: Login successful
//  *       401:
//  *         description: Unauthorized
//  */
// authRouter.post('/google/login', googleLogin);

// =================================
// FIREBASE SSO ROUTES
// =================================

/**
 * @swagger
 * /auth/firebase/sso:
 *   post:
 *     tags: [Auth - Firebase SSO]
 *     summary: Login/Register with Firebase (Google & Apple)
 *     description: |
 *       Single endpoint for both Google & Apple authentication via Firebase.
 *       Automatically creates account if user doesn't exist.
 *       Response includes user profile with age, gender, and followed counties.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Firebase ID token (from Firebase Auth)
 *                 example: "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
 *     responses:
 *       200:
 *         description: Login or registration successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         fullName:
 *                           type: string
 *                         age:
 *                           type: integer
 *                           nullable: true
 *                         gender:
 *                           type: string
 *                           nullable: true
 *                         counties:
 *                           type: array
 *                           description: Counties followed by user
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               state:
 *                                 type: string
 *                               slug:
 *                                 type: string
 *                               coverImage:
 *                                 type: string
 *                               notificationsEnabled:
 *                                 type: boolean
 *                               followedAt:
 *                                 type: string
 *                                 format: date-time
 *                     session:
 *                       type: object
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *       400:
 *         description: Bad request - Invalid or missing idToken
 *       401:
 *         description: Unauthorized - Invalid Firebase token
 */
authRouter.post('/firebase/sso', firebaseSSOLogin);

export default authRouter;
