export const inviteTemplate = (data: { [key: string]: any }) => {
  const {
    inviteUrl,
    organizationName,
    roleName,
    teamName,
    inviterName,
    expirationDate,
  } = data;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Organization Invite</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0; 
          background-color: #f5f5f5; 
        }
        .container { 
          max-width: 600px; 
          margin: 40px auto; 
          background: white; 
          border-radius: 12px; 
          overflow: hidden; 
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
        }
        .header { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          padding: 40px 20px; 
          text-align: center; 
          color: white; 
        }
        .header h1 { 
          margin: 0; 
          font-size: 28px; 
          font-weight: 600; 
        }
        .content { 
          padding: 40px 30px; 
        }
        .content p { 
          margin: 0 0 20px 0; 
          font-size: 16px; 
        }
        .details { 
          background: #f8f9fa; 
          padding: 25px; 
          border-radius: 8px; 
          margin: 30px 0; 
          border-left: 4px solid #667eea; 
        }
        .details h3 { 
          margin: 0 0 15px 0; 
          color: #333; 
          font-size: 18px; 
        }
        .details p { 
          margin: 8px 0; 
          font-size: 15px; 
        }
        .button { 
          display: inline-block; 
          padding: 16px 32px; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          color: white; 
          text-decoration: none; 
          border-radius: 8px; 
          margin: 30px 0; 
          font-weight: 600; 
          font-size: 16px; 
          transition: transform 0.2s; 
        }
        .button:hover { 
          transform: translateY(-2px); 
        }
        .footer { 
          background: #f8f9fa; 
          padding: 25px; 
          text-align: center; 
          font-size: 14px; 
          color: #6c757d; 
          border-top: 1px solid #e9ecef; 
        }
        .highlight { 
          color: #667eea; 
          font-weight: 600; 
        }
        .warning { 
          background: #fff3cd; 
          border: 1px solid #ffeaa7; 
          border-radius: 6px; 
          padding: 15px; 
          margin: 20px 0; 
          font-size: 14px; 
          color: #856404; 
        }
        @media (max-width: 600px) {
          .container { margin: 20px; }
          .content { padding: 25px 20px; }
          .header { padding: 30px 20px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 You're Invited!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
            Join ${organizationName} and start collaborating
          </p>
        </div>
        
        <div class="content">
          <p>Hello there!</p>
          
          <p>
            <span class="highlight">${inviterName}</span> has invited you to join 
            <span class="highlight">${organizationName}</span> as a 
            <span class="highlight">${roleName}</span>${teamName ? ` in the <span class="highlight">${teamName}</span> team` : ''}.
          </p>
          
          <div class="details">
            <h3>📋 Invitation Details</h3>
            <p><strong>Organization:</strong> ${organizationName}</p>
            <p><strong>Role:</strong> ${roleName}</p>
            ${teamName ? `<p><strong>Team:</strong> ${teamName}</p>` : ''}
            <p><strong>Invited by:</strong> ${inviterName}</p>
            <p><strong>Expires:</strong> ${expirationDate}</p>
          </div>
          
          <p>Click the button below to accept your invitation and set up your account:</p>
          
          <div style="text-align: center;">
            <a href="${inviteUrl}" class="button">Accept Invitation</a>
          </div>
          
          <div class="warning">
            <strong>⏰ Time sensitive:</strong> This invitation will expire on ${expirationDate}. 
            Make sure to accept it before then, or you'll need to request a new invitation.
          </div>
          
          <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">
            If the button doesn't work, you can copy and paste this link into your browser:<br>
            <a href="${inviteUrl}" style="color: #667eea; word-break: break-all;">${inviteUrl}</a>
          </p>
        </div>
        
        <div class="footer">
          <p style="margin: 0;">
            This is an automated message from ${organizationName}.<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};
