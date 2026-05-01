import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import logger from '../../../src/utils/logger';
import crypto from 'crypto';
// import path from 'path';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const S3_BUCKET = process.env.AWS_S3_BUCKET || 'travel-utility-storage';

// =================================
// FILE UPLOAD FUNCTIONS
// =================================

export interface UploadOptions {
  folder?: string;
  fileName?: string;
  contentType?: string;
  isPublic?: boolean;
}

/**
 * Upload file to S3
 */
export async function uploadToS3(
  fileBuffer: Buffer,
  options: UploadOptions = {}
): Promise<string> {
  try {
    const {
      folder = 'uploads',
      fileName,
      contentType = 'application/octet-stream',
    } = options;

    // Generate unique filename if not provided
    const uniqueFileName =
      fileName || `${crypto.randomBytes(16).toString('hex')}`;
    const key = `${folder}/${uniqueFileName}`;

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      // ACL: isPublic ? 'public-read' : 'private',
    });

    await s3Client.send(command);

    // Construct public URL
    const s3Url = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/${key}`;

    // Convert to CloudFront URL if enabled
    const fileUrl = getCloudFrontUrl(s3Url);

    logger.info('File uploaded to S3 successfully', {
      key,
      size: fileBuffer.length,
    });

    return fileUrl;
  } catch (error: any) {
    logger.error('Failed to upload file to S3', {
      error: error.message,
      folder: options.folder,
    });
    throw new Error(`S3 upload failed: ${error.message}`);
  }
}

/**
 * Upload profile picture to S3
 */
export async function uploadProfilePicture(
  userId: string,
  fileBuffer: Buffer,
  fileExtension: string
): Promise<string> {
  try {
    const fileName = `${userId}-${Date.now()}${fileExtension}`;

    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    const contentType =
      contentTypeMap[fileExtension.toLowerCase()] || 'image/jpeg';

    return await uploadToS3(fileBuffer, {
      folder: 'profile-pictures',
      fileName,
      contentType,
      isPublic: true,
    });
  } catch (error: any) {
    logger.error('Failed to upload profile picture', {
      error: error.message,
      userId,
    });
    throw error;
  }
}

/**
 * Delete file from S3
 */
export async function deleteFromS3(fileUrl: string): Promise<boolean> {
  try {
    // Extract key from URL
    const urlParts = fileUrl.split('.amazonaws.com/');
    if (urlParts.length < 2) {
      throw new Error('Invalid S3 URL');
    }

    const key = urlParts[1];

    const command = new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });

    await s3Client.send(command);

    logger.info('File deleted from S3 successfully', { key });
    return true;
  } catch (error: any) {
    logger.error('Failed to delete file from S3', {
      error: error.message,
      fileUrl,
    });
    return false;
  }
}

/**
 * Delete old profile picture
 */
export async function deleteOldProfilePicture(
  oldAvatarUrl: string | null
): Promise<void> {
  if (!oldAvatarUrl) return;

  // Only delete if it's an S3 URL
  if (oldAvatarUrl.includes('amazonaws.com')) {
    await deleteFromS3(oldAvatarUrl);
  }
}

/**
 * Get signed URL for private files
 */
export async function getSignedS3Url(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });

    logger.info('Generated signed URL', { key, expiresIn });
    return signedUrl;
  } catch (error: any) {
    logger.error('Failed to generate signed URL', {
      error: error.message,
      key,
    });
    throw error;
  }
}

/**
 * Convert S3 URL to CloudFront URL
 */
export function getCloudFrontUrl(s3Url: string): string {
  const useCloudFront = process.env.USE_CLOUDFRONT === 'true';
  const cloudFrontUrl = process.env.AWS_CLOUDFRONT_URL;

  if (!useCloudFront || !cloudFrontUrl) {
    return s3Url;
  }

  // Extract key from S3 URL
  const s3UrlPattern = new RegExp(
    `https://${S3_BUCKET}\\.s3\\.${process.env.AWS_REGION}\\.amazonaws\\.com/(.+)`
  );
  const match = s3Url.match(s3UrlPattern);

  if (match && match[1]) {
    return `${cloudFrontUrl}/${match[1]}`;
  }

  return s3Url;
}

/**
 * Validate file type for profile pictures
 */
export function validateProfilePictureType(mimetype: string): {
  valid: boolean;
  extension: string;
} {
  const allowedTypes: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
  };

  const extension = allowedTypes[mimetype];

  return {
    valid: !!extension,
    extension: extension || '',
  };
}

/**
 * Validate file size (max 5MB for profile pictures)
 */
export function validateFileSize(size: number, maxSizeMB: number = 5): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return size <= maxSizeBytes;
}

// =================================
// PRESIGNED URL FUNCTIONS
// =================================

export interface PresignedUploadUrlOptions {
  folder: string;
  fileName: string;
  contentType: string;
  expiresIn?: number; // seconds, default 15 minutes
}

export interface PresignedUploadUrlResult {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  expiresIn: number;
}

/**
 * Generate presigned URL for direct S3 upload from frontend
 * Frontend will use this URL to upload files directly to S3
 */
export async function generatePresignedUploadUrl(
  options: PresignedUploadUrlOptions
): Promise<PresignedUploadUrlResult> {
  try {
    const {
      folder,
      fileName,
      contentType,
      expiresIn = 900, // 15 minutes default
    } = options;

    // Sanitize filename to prevent path traversal
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${folder}/${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
      // ACL: 'public-read', // Make uploaded files public
    });

    // Generate presigned URL with PUT method
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

    // Construct the public URL where file will be accessible after upload
    const fileUrl = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || 'eu-north-1'}.amazonaws.com/${key}`;

    logger.info('Generated presigned upload URL', {
      key,
      contentType,
      expiresIn,
    });

    return {
      uploadUrl,
      fileUrl,
      key,
      expiresIn,
    };
  } catch (error: any) {
    logger.error('Failed to generate presigned upload URL', {
      error: error.message,
      folder: options.folder,
    });
    throw new Error(`Failed to generate upload URL: ${error.message}`);
  }
}

/**
 * Validate file type for post media (images and videos)
 */
export function validateMediaType(mimetype: string): {
  valid: boolean;
  extension: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
} {
  const mediaTypes: Record<
    string,
    { extension: string; mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' }
  > = {
    // Images
    'image/jpeg': { extension: '.jpg', mediaType: 'IMAGE' },
    'image/jpg': { extension: '.jpg', mediaType: 'IMAGE' },
    'image/png': { extension: '.png', mediaType: 'IMAGE' },
    'image/gif': { extension: '.gif', mediaType: 'IMAGE' },
    'image/webp': { extension: '.webp', mediaType: 'IMAGE' },
    'image/svg+xml': { extension: '.svg', mediaType: 'IMAGE' },

    // Videos
    'video/mp4': { extension: '.mp4', mediaType: 'VIDEO' },
    'video/webm': { extension: '.webm', mediaType: 'VIDEO' },
    'video/ogg': { extension: '.ogg', mediaType: 'VIDEO' },
    'video/quicktime': { extension: '.mov', mediaType: 'VIDEO' },

    // Audio
    'audio/mpeg': { extension: '.mp3', mediaType: 'AUDIO' },
    'audio/wav': { extension: '.wav', mediaType: 'AUDIO' },
    'audio/ogg': { extension: '.ogg', mediaType: 'AUDIO' },

    // Documents
    'application/pdf': { extension: '.pdf', mediaType: 'DOCUMENT' },
    'application/msword': { extension: '.doc', mediaType: 'DOCUMENT' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      extension: '.docx',
      mediaType: 'DOCUMENT',
    },
  };

  const result = mediaTypes[mimetype];

  return {
    valid: !!result,
    extension: result?.extension || '',
    mediaType: result?.mediaType || 'DOCUMENT',
  };
}
