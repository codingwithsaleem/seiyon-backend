// import admin from 'firebase-admin';
// import logger from '../utils/logger';

// // Initialize Firebase Admin SDK
// const initializeFirebase = () => {
//   try {
//     // Check if already initialized
//     if (admin.apps.length > 0) {
//       logger.info('Firebase Admin SDK already initialized');
//       return admin.app();
//     }

//     // Initialize with service account (recommended for production)
//     if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
//       const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_PATH!;

//       admin.initializeApp({
//         credential: admin.credential.cert(serviceAccount),
//         projectId: process.env.FIREBASE_PROJECT_ID,
//       });

//       logger.info('Firebase Admin SDK initialized with service account');
//       return admin.app();
//     }

//     // Initialize with credentials object (alternative)
//     if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
//       admin.initializeApp({
//         credential: admin.credential.cert({
//           projectId: process.env.FIREBASE_PROJECT_ID,
//           clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//           privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
//         }),
//         projectId: process.env.FIREBASE_PROJECT_ID,
//       });

//       logger.info(
//         'Firebase Admin SDK initialized with environment credentials'
//       );
//       return admin.app();
//     }

//     // Initialize with application default credentials (development)
//     // if (
//     //   process.env.NODE_ENV === 'development' ||
//     //   process.env.NODE_ENV === 'production'
//     // ) {
//     //   logger.warn(
//     //     'Firebase Admin SDK initialized with application default credentials (development only)'
//     //   );
//     //   admin.initializeApp();
//     //   return admin.app();
//     // }

//     throw new Error(
//       'Firebase configuration not found. Please set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE credentials in environment variables.'
//     );
//   } catch (error) {
//     logger.error('Failed to initialize Firebase Admin SDK:', error);
//     throw error;
//   }
// };

// // Initialize on module load
// initializeFirebase();

// export default admin;
