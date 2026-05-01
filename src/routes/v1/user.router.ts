import { Router } from 'express';
import multer from 'multer';
import {
  getProfile,
  updateProfile,
  uploadProfilePic,
  deleteProfilePic,
  updateLanguage,
  updateCurrency,
  requestEmailUpdate,
  verifyEmailUpdate,
  requestPhoneUpdate,
  verifyPhoneUpdate,
  changePassword,
  deleteAccount,
} from '../../controller/user.controller';
import { authenticateToken } from '@packages/utils/middlewares/auth.middleware';

const router = Router();

// Configure multer for memory storage (for S3 upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

// All routes require authentication
router.use(authenticateToken);


// =================================
// PROFILE ROUTES
// =================================

/**
 * @swagger
 * /user/profile:
 *   get:
 *     tags: [User]
 *     summary: Get user profile
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/profile', getProfile);

/**
 * @swagger
 * /user/profile:
 *   patch:
 *     tags: [User]
 *     summary: Update user profile
 *     description: Update user profile (fullName, age, gender, and primary county)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "John Doe"
 *                 description: Full name
 *               age:
 *                 type: integer
 *                 minimum: 13
 *                 maximum: 120
 *                 example: 25
 *                 description: User's age
 *               gender:
 *                 type: string
 *                 enum: [MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY]
 *                 example: "MALE"
 *                 description: User's gender
 *               countyId:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *                 description: User's primary county ID (their home location)
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 */
router.patch('/profile', updateProfile);

/**
 * @swagger
 * /user/profile/picture:
 *   post:
 *     tags: [User]
 *     summary: Upload profile picture
 *     description: Upload a profile picture (JPEG, PNG, GIF, WebP - max 5MB)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - profilePicture
 *             properties:
 *               profilePicture:
 *                 type: string
 *                 format: binary
 *                 description: Profile picture file (JPEG, PNG, GIF, WebP)
 *     responses:
 *       200:
 *         description: Profile picture uploaded successfully
 *       400:
 *         description: Invalid file type or size
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/profile/picture',
  upload.single('profilePicture'),
  uploadProfilePic
);

/**
 * @swagger
 * /user/profile/picture:
 *   delete:
 *     tags: [User]
 *     summary: Delete profile picture
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile picture deleted successfully
 *       401:
 *         description: Unauthorized
 */
router.delete('/profile/picture', deleteProfilePic);

// =================================
// LANGUAGE & CURRENCY ROUTES
// =================================

/**
 * @swagger
 * /user/language:
 *   patch:
 *     tags: [User]
 *     summary: Update user language preference
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - language
 *             properties:
 *               language:
 *                 type: string
 *                 description: Language code (e.g., en, es, fr)
 *     responses:
 *       200:
 *         description: Language updated successfully
 *       401:
 *         description: Unauthorized
 */
router.patch('/language', updateLanguage);

/**
 * @swagger
 * /user/currency:
 *   patch:
 *     tags: [User]
 *     summary: Update user currency preference
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currency
 *             properties:
 *               currency:
 *                 type: string
 *                 description: Currency code (e.g., USD, EUR, GBP)
 *     responses:
 *       200:
 *         description: Currency updated successfully
 *       401:
 *         description: Unauthorized
 */
router.patch('/currency', updateCurrency);

// =================================
// EMAIL & PHONE UPDATE ROUTES & SETTINGS
// =================================

/**
 * @swagger
 * /user/email/request-change:
 *   post:
 *     tags: [User]
 *     summary: Request email change (sends OTP)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newEmail
 *             properties:
 *               newEmail:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP sent to new email
 *       401:
 *         description: Unauthorized
 */
router.post('/email/request-change', requestEmailUpdate);

/**
 * @swagger
 * /user/email/verify-change:
 *   post:
 *     tags: [User]
 *     summary: Verify email change with OTP
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newEmail
 *               - otp
 *             properties:
 *               newEmail:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email updated successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/email/verify-change', verifyEmailUpdate);

/**
 * @swagger
 * /user/phone/request-change:
 *   post:
 *     tags: [User]
 *     summary: Request phone change (sends OTP)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPhone
 *             properties:
 *               newPhone:
 *                 type: string
 *                 description: Phone number in E.164 format
 *     responses:
 *       200:
 *         description: OTP sent to new phone
 *       401:
 *         description: Unauthorized
 */
router.post('/phone/request-change', requestPhoneUpdate);

/**
 * @swagger
 * /user/phone/verify-change:
 *   post:
 *     tags: [User]
 *     summary: Verify phone change with OTP
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPhone
 *               - otp
 *             properties:
 *               newPhone:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Phone updated successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/phone/verify-change', verifyPhoneUpdate);

/**
 * @swagger
 * /user/password:
 *   post:
 *     tags: [User]
 *     summary: Change user password
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/password', changePassword);


/**
 * @swagger
 * /user/delete-account:
 *   delete:
 *     tags: [User]
 *     summary: Delete user account
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reasons
 *             properties:
 *               reasons:
 *                 type: array
 *                 items:
 *                   type: string
 *               feedback:
 *                 type: string
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       401:
 *         description: Unauthorized
 */
router.delete('/delete-account', deleteAccount);

export default router;
