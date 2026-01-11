import { INestApplication } from '@nestjs/common';
export declare class AppService {
    private app;
    setApp(app: INestApplication): void;
    getHello(): string;
    getApiJson(module?: string): Record<string, unknown>;
    getModules(): string[];
}
