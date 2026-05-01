export const verifyEmailOtpTemplate = (data: Record<string, any>) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Email Verification - Travel Utility</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f4f7;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 0 10px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .header {
      background-color: #1f1f23;
      color: #ff416c;
      padding: 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 30px 20px;
      text-align: center;
    }
    .content h2 {
      margin-bottom: 10px;
      color: #333;
    }
    .content p {
      color: #555;
      font-size: 16px;
      margin-bottom: 25px;
    }
    .otp-box {
      display: inline-block;
      font-size: 24px;
      letter-spacing: 12px;
      background-color: #f0f0f0;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: bold;
      color: #1f1f23;
      margin-bottom: 30px;
    }
    .note {
      font-size: 14px;
      color: #777;
      margin-top: 20px;
    }
    .footer {
      text-align: center;
      padding: 15px;
      font-size: 13px;
      color: #999999;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Travel Utility</h1>
    </div>
    <div class="content">
      <h2>Verify Your Email</h2>
      <p>Use the one-time code below to verify your email address and start your journey with Travel Utility.</p>
      <div class="otp-box">${data?.otp}</div>
      <p class="note">This code will expire in 5 minutes. Please do not share it with anyone.</p>
    </div>
    <div class="footer">
      &copy; 2025 Travel Utility. All rights reserved.
    </div>
  </div>
</body>
</html>`;
};
