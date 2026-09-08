import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { from, lastValueFrom, Observable } from 'rxjs';
import { AiPromptService } from './ai-prompt.service';
import type { PersonItem } from '../../../entity/PersonItem';

/** Establishes a scope for standalone MCP/media/script requests; chat pins its own scope. */
@Injectable()
export class AiPromptScopeInterceptor implements NestInterceptor {
  constructor(private readonly prompts: AiPromptService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      path?: string;
      method?: string;
      user?: PersonItem;
      body?: { name?: string };
    }>();
    const path = req.path ?? '';
    const aiRecordAction =
      path.startsWith('/api/script/') && /^ai[A-Z]/.test(req.body?.name ?? '');
    const needsScope =
      (req.method === 'POST' &&
        /^\/api\/ai\/(mcp|markdown|speech|transcription|entity-generation|web-search)/.test(
          path,
        )) ||
      /^\/api\/ai\/chat\/(transcriptions|messages\/[^/]+\/speech)$/.test(
        path,
      ) ||
      aiRecordAction;
    if (!needsScope) return next.handle();
    const work = () =>
      lastValueFrom(next.handle(), { defaultValue: undefined });
    if (
      req.user &&
      req.method === 'POST' &&
      (/^\/api\/ai\/(mcp|entity-generation|web-search)\//.test(path) ||
        aiRecordAction)
    ) {
      return from(
        this.prompts.record(
          path.startsWith('/api/script/')
            ? 'record-action-prompt'
            : 'standalone-ai',
          req.user,
          work,
        ),
      );
    }
    return from(this.prompts.run(work));
  }
}
