import { SwaggerCustomOptions } from '@nestjs/swagger';

export const swaggerOptions: SwaggerCustomOptions = {
  swaggerOptions: {
    persistAuthorization: true,
    tagsSorter: 'alpha',
    operationsSorter: 'alpha',
    docExpansion: 'none',
    filter: true,
    showRequestDuration: true,
  },
  customSiteTitle: 'Smart Chat Assistant API Documentation',
  customfavIcon: '/favicon.ico',
  customCss: `
    .swagger-ui .topbar { 
      background-color: #3B82F6; 
    }
    .swagger-ui .topbar-wrapper img { 
      content: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7wn6SWPC90ZXh0Pjwvc3ZnPg==');
    }
    .swagger-ui .info .title {
      font-size: 2.5rem;
      color: #1F2937;
    }
    .swagger-ui .info .description {
      color: #4B5563;
    }
    .swagger-ui .scheme-container {
      background: #F3F4F6;
      padding: 1rem;
      border-radius: 0.5rem;
    }
  `,
};
