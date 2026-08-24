import 'reflect-metadata';
import * as dotenv from 'dotenv';

import { EntityManager } from '@mikro-orm/core';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import session from 'express-session';
import passport from 'passport';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import morgan from 'morgan';
import { createStream } from 'rotating-file-stream';
import {
  API_CONTACT_EMAIL,
  API_CONTACT_NAME,
  API_CONTACT_URL,
  API_DESCRIPTION,
  API_REQUEST_BODY_LIMIT,
  API_TITLE,
  API_VERSION,
  LOG_BACKUP_FILES,
  LOG_NAME_REQUESTS,
  LOG_OUTPUT_PATH,
  LOG_REQUESTS_CONSOLE_ENABLED,
  LOG_REQUESTS_FILE_ENABLED,
  PORT,
  SAPLING_FRONTEND_URL,
} from './constants/project.constants';
import { ENTITY_REGISTRY } from './entity/global/entity.registry';
import { initializeLogger } from './logging/initialize-logger';
import { ApiExceptionFilter } from './api/common/api-exception.filter';
import {
  applySessionTrustProxy,
  createSessionOptions,
  getSaplingSecretOrThrow,
} from './session/session.config';
import { enforceTrustedRequestOrigin } from './security/request-origin-protection';
import {
  buildGenericEntitySwaggerUiScript,
  enhanceGenericEntitySwaggerDocument,
} from './swagger/generic-entity-swagger';

type ModelConstructor = abstract new (...args: never[]) => unknown;
type ProxyConfigurableApp = { set(setting: string, value: unknown): unknown };
type ResponseEndArguments = [
  chunk?: unknown,
  encodingOrCallback?: BufferEncoding | (() => void),
  callback?: () => void,
];
type ResponseEnd = (...args: ResponseEndArguments) => Response;

/**
 * Bootstraps the NestJS application, configures middleware, logging, ORM, Swagger, and CORS.
 *
 * - Sets up session management and request parsing.
 * - Configures Morgan and log4js for request and server logging.
 * - Initializes Passport for authentication.
 * - Applies global validation pipes.
 * - Sets up Swagger API documentation.
 * - Enables CORS for the frontend.
 * - Starts the server on the configured port.
 */
async function bootstrap() {
  dotenv.config();
  getSaplingSecretOrThrow();

  // Create the NestJS application
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use((_req: Request, res: Response, next: NextFunction) => {
    const startedAt = performance.now();
    const originalEnd = res.end.bind(res) as unknown as ResponseEnd;
    res.end = ((...args: ResponseEndArguments) => {
      if (!res.headersSent) {
        const existing = res.getHeader('Server-Timing');
        const total = `total;dur=${(performance.now() - startedAt).toFixed(1)}`;
        res.setHeader(
          'Server-Timing',
          existing ? `${String(existing)}, ${total}` : total,
        );
      }
      return originalEnd(...args);
    }) as Response['end'];
    next();
  });

  // Enable request parsing with a Sapling-specific payload limit.
  app.use(express.json({ limit: API_REQUEST_BODY_LIMIT }));
  app.use(
    express.urlencoded({ extended: true, limit: API_REQUEST_BODY_LIMIT }),
  );

  // Configure session management
  const httpAdapterInstance = app
    .getHttpAdapter()
    .getInstance() as ProxyConfigurableApp;
  applySessionTrustProxy(httpAdapterInstance);
  app.use(enforceTrustedRequestOrigin);
  const entityManager = app.get(EntityManager);
  app.use(session(createSessionOptions(entityManager)));

  if (LOG_REQUESTS_CONSOLE_ENABLED) {
    app.use(morgan('dev'));
  }

  if (LOG_REQUESTS_FILE_ENABLED) {
    const accessLogStream = createStream(LOG_NAME_REQUESTS, {
      interval: '1d', // rotate daily
      size: '10M', // 10 Megabytes
      path: LOG_OUTPUT_PATH,
      maxFiles: LOG_BACKUP_FILES,
    });
    app.use(morgan('combined', { stream: accessLogStream }));
  }

  initializeLogger();
  app.useGlobalFilters(new ApiExceptionFilter());

  // Initialize Passport authentication
  app.use(passport.initialize());
  app.use(passport.session());

  // Apply global validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  // Configure Swagger API documentation
  const swagger = new DocumentBuilder()
    .setTitle(API_TITLE)
    .setDescription(API_DESCRIPTION)
    .setVersion(API_VERSION)
    .setContact(API_CONTACT_NAME, API_CONTACT_URL, API_CONTACT_EMAIL)
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swagger, {
    extraModels: ENTITY_REGISTRY.map(
      (e): ModelConstructor => e.class as ModelConstructor,
    ),
  });
  enhanceGenericEntitySwaggerDocument(
    document as Parameters<typeof enhanceGenericEntitySwaggerDocument>[0],
  );
  SwaggerModule.setup('api/swagger', app, document, {
    customJsStr: buildGenericEntitySwaggerUiScript(
      document as Parameters<typeof buildGenericEntitySwaggerUiScript>[0],
    ),
  });

  // Enable CORS for the frontend
  app.enableCors({
    // Allow requests only from the configured frontend
    origin: SAPLING_FRONTEND_URL,
    // Allow sending cookies and other credentials
    credentials: true,
  });

  // Start the server
  await app.listen(PORT);

  // Set global isReady flag to true
  global.isReady = true;
}

// Start the application
void bootstrap();
