import { ValidationError } from '../../../packages/error-handaler';
import sgMail from '@sendgrid/mail';
import { verifyEmailOtpTemplate } from './verifyEmailOtpTemplate';
import { resetPasswordTemplate } from './resetPasswordTemplate';
import { welcomeTemplate } from './welcomeTemplate';
import { forgotPasswordOtpTemplate } from './forgotPasswordOtpTemplate';
import { inviteTemplate } from './inviteTemplate';
import logger from '../../../src/utils/logger';

const enabled = true; // Set to true to enable email sending
const emailSender = process.env.SENDGRID_FROM_EMAIL!;

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export const sendEmail = async (
  email: string,
  subject: string,
  text: string,
  emailTemplateName: string,
  data: Record<string, string>
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
      if (!enabled) {
        return 'Email sending is disabled';
      }

      // If you have a specific template, you can use it here
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

      const msg = {
        to: email,
        from: emailSender,
        subject: subject,
        text: text,
        html: template,
      };

      await sgMail.send(msg);
    } catch (error) {
      logger.error('Error sending email:', error);

      // Enhanced error logging for SendGrid
      if (error && typeof error === 'object' && 'response' in error) {
        const sgError = error as any;
        logger.error('SendGrid Error Details:');
        logger.error('Status Code:', sgError.code);
        logger.error('Response Body:', sgError.response?.body);

        if (sgError.response?.body?.errors) {
          logger.error('Specific Errors:', sgError.response.body.errors);
        }
      }

      throw new ValidationError('Failed to send email', {
        details: { error },
      });
    }
  }
};
