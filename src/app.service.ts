import { Injectable } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import { swaggerConfig } from './swagger';

@Injectable()
export class AppService {
  private app: INestApplication;

  setApp(app: INestApplication) {
    this.app = app;
  }

  getHello(): string {
    return 'Hello World!';
  }

  getApiJson(module?: string): Record<string, unknown> {
    if (!this.app) {
      throw new Error('Application not initialized');
    }

    const document = SwaggerModule.createDocument(
      this.app,
      swaggerConfig,
    ) as unknown as Record<string, unknown>;

    // If no module specified, return full document
    if (!module) {
      return document;
    }

    // Filter by module (tag)
    const filteredDocument: Record<string, unknown> = {
      ...document,
      paths: {},
      tags:
        Array.isArray(document.tags) &&
        document.tags.filter((tag: { name?: string }) => tag?.name === module),
    };

    // Filter paths that have operations with the specified tag
    const paths = document.paths as Record<string, Record<string, unknown>>;
    if (paths) {
      Object.keys(paths).forEach((path) => {
        const pathItem = paths[path] as Record<string, unknown>;
        const filteredPathItem: Record<string, unknown> = {};

        Object.keys(pathItem).forEach((method) => {
          const lowerMethod = method.toLowerCase();
          if (
            [
              'get',
              'post',
              'put',
              'patch',
              'delete',
              'head',
              'options',
            ].includes(lowerMethod)
          ) {
            const operation = pathItem[method] as {
              tags?: string[];
              [key: string]: unknown;
            };
            if (operation?.tags && operation.tags.includes(module)) {
              filteredPathItem[method] = operation;
            }
          } else {
            // Keep non-operation properties (parameters, etc.)
            filteredPathItem[method] = pathItem[method];
          }
        });

        // Only add path if it has filtered operations
        if (Object.keys(filteredPathItem).length > 0) {
          (filteredDocument.paths as Record<string, unknown>)[path] =
            filteredPathItem;
        }
      });
    }

    // Filter components (schemas, parameters, etc.) that are referenced by filtered paths
    const components = document.components as
      | Record<string, Record<string, unknown>>
      | undefined;
    if (components) {
      filteredDocument.components = { ...components };

      // Collect all referenced schema names from filtered paths
      const referencedSchemas = new Set<string>();

      const collectReferences = (obj: unknown): void => {
        if (!obj || typeof obj !== 'object') return;

        const objRecord = obj as Record<string, unknown>;
        if (objRecord.$ref && typeof objRecord.$ref === 'string') {
          const match = objRecord.$ref.match(/#\/components\/schemas\/(.+)/);
          if (match) {
            referencedSchemas.add(match[1]);
          }
        }

        Object.values(objRecord).forEach((value) => {
          if (typeof value === 'object') {
            collectReferences(value);
          }
        });
      };

      const filteredPaths = filteredDocument.paths as Record<
        string,
        Record<string, unknown>
      >;
      if (filteredPaths) {
        Object.values(filteredPaths).forEach((pathItem) => {
          Object.values(pathItem).forEach((operation) => {
            if (operation && typeof operation === 'object') {
              collectReferences(operation);
            }
          });
        });
      }

      // Filter schemas to only include referenced ones
      const schemas = components.schemas as Record<string, unknown> | undefined;
      if (schemas && filteredDocument.components) {
        const filteredSchemas: Record<string, unknown> = {};
        referencedSchemas.forEach((schemaName) => {
          if (schemas[schemaName]) {
            filteredSchemas[schemaName] = schemas[schemaName];
          }
        });
        (filteredDocument.components as Record<string, unknown>).schemas =
          filteredSchemas;
      }
    }

    return filteredDocument;
  }

  getModules(): string[] {
    if (!this.app) {
      throw new Error('Application not initialized');
    }

    const document = SwaggerModule.createDocument(this.app, swaggerConfig);
    return document.tags?.map((tag) => tag.name) || [];
  }
}
