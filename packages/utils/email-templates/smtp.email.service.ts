import { ValidationError } from '../../../packages/error-handaler';
import nodemailer from 'nodemailer';
import { verifyEmailOtpTemplate } from './verifyEmailOtpTemplate';
import { resetPasswordTemplate } from './resetPasswordTemplate';
import { welcomeTemplate } from './welcomeTemplate';
import { forgotPasswordOtpTemplate } from './forgotPasswordOtpTemplate';
import { inviteTemplate } from './inviteTemplate';
import logger from '../../../src/utils/logger';

type EmailTemplateData = any;

const enabled = true; // Set to true to enable email sending

// Create Nodemailer transporter with SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 5000, // 5 seconds
  socketTimeout: 10000, // 10 seconds
  logger: false,
  debug: false,
  tls: {
    rejectUnauthorized: false, // Allow self-signed certificates (development only)
  },
});

const emailSender = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

/**
 * Send email using SMTP (Nodemailer)
 * Alternative to SendGrid for email delivery
 */
export const sendEmailSMTP = async (
  email: string,
  subject: string,
  text: string,
  emailTemplateName: string,
  data: EmailTemplateData
) => {
  // Check if email sending is enabled
  if (!email || !subject || !text || !emailTemplateName) {
    return 'Email, subject, text, and emailTemplateName are required';
  }

  if (!emailSender) {
    return 'Email sender is not configured';
  }

  if (enabled) {
    try {
      // Select email template
      let template = '';

      if (emailTemplateName === 'welcomeTemplate') {
        template = welcomeTemplate(data);
      } else if (emailTemplateName === 'verifyEmailOtpTemplate') {
        template = verifyEmailOtpTemplate(data);
      } else if (emailTemplateName === 'resetPasswordTemplate') {
        template = resetPasswordTemplate(data);
      } else if (emailTemplateName === 'forgotPasswordOtpTemplate') {
        template = forgotPasswordOtpTemplate(data);
      } else if (emailTemplateName === 'inviteTemplate') {
        template = inviteTemplate(data);
      }

      const mailOptions = {
        from: `" Seiyon Car Rental App" <${emailSender}>`,
        to: email,
        subject: subject,
        text: text,
        html: template,
      };

      // Send email using Nodemailer
      const info = await transporter.sendMail(mailOptions);

      logger.info('Email sent successfully via SMTP:', info.messageId);
      return 'Email sent successfully';
    } catch (error) {
      logger.error('Error sending email via SMTP:', error);

      throw new ValidationError('Failed to send email via SMTP', {
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
};
