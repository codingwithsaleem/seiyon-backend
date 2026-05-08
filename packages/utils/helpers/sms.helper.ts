import { ValidationError } from '../../error-handaler';
import twilio from 'twilio';
import logger from '../../../src/utils/logger';

const enabled = true; // Set to true to enable SMS sending

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

/**
 * Send SMS using Twilio
 * @param phoneNumber - Recipient phone number (E.164 format)
 * @param message - SMS message content
 * @returns Promise with success status and message
 */
export const sendSMS = async (
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; message: string; sid?: string }> => {
  // Validate inputs
  if (!phoneNumber || !message) {
    throw new ValidationError('Phone number and message are required');
  }

  if (!twilioPhoneNumber) {
    logger.error('Twilio phone number is not configured');
    return {
      success: false,
      message: 'SMS service is not configured',
    };
  }

  if (!enabled) {
    logger.info('SMS sending is disabled');
    return {
      success: false,
      message: 'SMS sending is disabled',
    };
  }

  try {
    // Send SMS via Twilio
    const result = await twilioClient.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: phoneNumber,
    });

    logger.info('SMS sent successfully:', result.sid);

    return {
      success: true,
      message: 'SMS sent successfully',
      sid: result.sid,
    };
  } catch (error) {
    logger.error('Error sending SMS:', error);

    // Handle Twilio specific errors
    if (error && typeof error === 'object' && 'code' in error) {
      const twilioError = error as { code: number; message: string };
      logger.error('Twilio Error Code:', twilioError.code);
      logger.error('Twilio Error Message:', twilioError.message);
    }

    throw new ValidationError('Failed to send SMS', {
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
};

/**
 * Send OTP via SMS
 * @param phoneNumber - Recipient phone number (E.164 format)
 * @param otp - OTP code
 * @returns Promise with success status
 */
export const sendOtpSMS = async (
  phoneNumber: string,
  otp: string
): Promise<{ success: boolean; message: string }> => {
  const message = `Your Seiyon Car Rental verification code is: ${otp}. It is valid for 5 minutes. Do not share this code with anyone.`;

  return sendSMS(phoneNumber, message);
};

/**
 * Send forgot password OTP via SMS
 * @param phoneNumber - Recipient phone number (E.164 format)
 * @param otp - OTP code
 * @returns Promise with success status
 */
export const sendForgotPasswordOtpSMS = async (
  phoneNumber: string,
  otp: string
): Promise<{ success: boolean; message: string }> => {
  const message = `Your Seiyon Car Rental password reset code is: ${otp}. It is valid for 5 minutes. If you didn't request this, please ignore this message.`;

  return sendSMS(phoneNumber, message);
};

/**
 * Verify phone number format (E.164)
 * @param phoneNumber - Phone number to verify
 * @returns boolean indicating if format is valid
 */
export const isValidPhoneNumber = (phoneNumber: string): boolean => {
  // E.164 format: +[country code][number]
  const e164Regex = /^\+?[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
};
