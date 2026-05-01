// Swagger configuration using swagger-jsdoc

import swaggerJsdoc from 'swagger-jsdoc';

const BASE_URL = process.env.BASE_URL || 'http://localhost:6001/api/v1';

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'travel-utility API',
      version: '1.0.0',
      description: 'API documentation for travel-utility',
    },
    servers: [
      {
        url: BASE_URL,
        description: 'API Server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/v1/*.ts', './src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
