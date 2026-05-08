export const resetPasswordTemplate = (data: any) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset Your Password - Seiyon Car Rental</title>
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

    .reset-button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #ff416c;
      color: #ffffff;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
      transition: background-color 0.3s ease;
    }

    .reset-button:hover {
      background-color: #ff5e84;
    }

    .footer {
      text-align: center;
      padding: 15px;
      font-size: 13px;
      color: #999999;
    }

    .small-note {
      margin-top: 20px;
      font-size: 13px;
      color: #999;
    }
  </style>
</head>
<body>

  <div class="container">
    <div class="header">
      <h1>Seiyon Car Rental</h1>
    </div>
    <div class="content">
      <h2>Reset Your Password</h2>
      <p>We received a request to reset your password. Click the button below to create a new one:</p>

      <a href="${data.resetPasswordLink}" class="reset-button">Reset Password</a>

      <p class="small-note">
        If you didn’t request this, you can safely ignore this email. This link will expire in 1 hour.
      </p>
    </div>
    <div class="footer">
      &copy; 2026 Seiyon Car Rental. All rights reserved.
    </div>
  </div>

</body>
</html>
`;
};
