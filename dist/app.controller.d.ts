import { AppService } from './app.service';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    getHello(): string;
    getApiSchema(module?: string): Record<string, unknown>;
    getModules(): {
        modules: string[];
    };
}
