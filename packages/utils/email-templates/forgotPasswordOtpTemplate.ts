export const forgotPasswordOtpTemplate = (data: any) => {
  return `
        <html>
        <body>
            <h1>Forgot Password OTP</h1>
            <p>Hi,</p>
            <p>You requested to reset your password. Please use the following OTP to proceed:</p>
            <h2>${data.otp}</h2>
            <p>If you did not request this, please ignore this email.</p>
            <p>Thank you!</p>
        </body>
        </html>
    `;
};
