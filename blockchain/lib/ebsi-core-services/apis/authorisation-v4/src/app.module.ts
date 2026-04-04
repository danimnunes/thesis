import type { MiddlewareConsumer, NestModule } from "@nestjs/common";

import { LoggerMiddleware, LoggingInterceptor } from "@ebsiint-api/shared";
import { Module, RequestMethod } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";

import type { ApiConfig } from "./config/configuration.ts";

import { AppController } from "./app.controller.ts";
import { ApiConfigModule } from "./config/configuration.ts";
import { AuthorisationModule } from "./modules/authorisation/authorisation.module.ts";
import { HealthModule } from "./modules/health/health.module.ts";
import { OpenApiModule } from "./modules/openapi/openapi.module.ts";

@Module({
  controllers: [AppController],
  imports: [
    ApiConfigModule,
    LoggerModule.forRootAsync({
      imports: [ApiConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<ApiConfig, true>) => {
        return {
          forRoutes: ["*path"],
          pinoHttp: {
            // Disable request / response auto-logging (handled by LoggerMiddleware)
            autoLogging: false,
            // Set to null to avoid adding pid and hostname properties to each log
            // eslint-disable-next-line unicorn/no-null
            base: null,
            // Set log level
            level: config.get("logLevel"),
            // Use quiet logger (only add "reqId" to logs)
            quietReqLogger: true,
            quietResLogger: true,
            // Redact sensitive data
            redact: ["request.headers.authorization"],
          },
        };
      },
    }),
    AuthorisationModule,
    HealthModule,
    OpenApiModule,
  ],
  providers: [
    ConfigService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      // Exclude certain routes from logging "Request received" and "Request completed" messages
      // .exclude({ method: RequestMethod.ALL, path: "/token" })
      .forRoutes({ method: RequestMethod.ALL, path: "*path" });
  }
}
