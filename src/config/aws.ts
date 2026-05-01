import { EC2Client } from '@aws-sdk/client-ec2';

// Initialize EC2 client with explicit credentials
export const ec2Client = new EC2Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID! || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! || '',
  },
});
