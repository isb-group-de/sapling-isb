import { createHash } from 'crypto';
import { EntityManager, LockMode } from '@mikro-orm/core';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiPromptTemplateItem } from '../../../entity/AiPromptTemplateItem';
import { AiPromptVersionItem } from '../../../entity/AiPromptVersionItem';
import { AiChatSessionItem } from '../../../entity/AiChatSessionItem';
import { PersonItem } from '../../../entity/PersonItem';
import { AiAgentRunItem } from '../../../entity/AiAgentRunItem';
import {
  aiPromptContext,
  type AiPromptManifest,
  type AiPromptScope,
  validatePrompt,
  renderPrompt,
} from './ai-prompt-context';

@Injectable()
export class AiPromptService {
  constructor(private readonly em: EntityManager) {}

  async load(manifest?: AiPromptManifest | null): Promise<AiPromptScope> {
    if (
      manifest &&
      (Object.keys(manifest).length > 5000 ||
        Object.entries(manifest).some(
          ([key, value]) =>
            !/^[a-zA-Z0-9_.-]{1,190}$/.test(key) ||
            !Number.isSafeInteger(value) ||
            value < 1,
        ))
    )
      throw new BadRequestException('ai.promptManifestInvalid');
    const versions = manifest
      ? await this.em.find(
          AiPromptVersionItem,
          { handle: { $in: Object.values(manifest) } },
          { populate: ['template'] },
        )
      : (
          await this.em.find(
            AiPromptTemplateItem,
            {},
            { populate: ['publishedVersion'], refresh: true },
          )
        ).flatMap((template) =>
          template.publishedVersion ? [template.publishedVersion] : [],
        );
    const scope: AiPromptScope = {
      manifest: {},
      prompts: Object.create(null) as AiPromptScope['prompts'],
    };
    for (const version of versions) {
      const key =
        typeof version.template === 'string'
          ? version.template
          : version.template.handle;
      if (!version.handle) continue;
      if (manifest && manifest[key] !== version.handle)
        throw new BadRequestException('ai.promptManifestInvalid');
      scope.manifest[key] = version.handle;
      scope.prompts[key] = {
        handle: version.handle,
        content: version.content,
        variables: version.variables,
      };
    }
    if (
      !versions.length ||
      (manifest && Object.keys(manifest).length !== versions.length)
    )
      throw new ServiceUnavailableException('ai.promptVersionUnavailable');
    return scope;
  }

  async run<T>(
    operation: () => Promise<T>,
    manifest?: AiPromptManifest | null,
  ): Promise<T> {
    if (!manifest && aiPromptContext.getStore()) return operation();
    const scope = await this.load(manifest);
    return aiPromptContext.run(scope, operation);
  }

  async runSession<T>(
    session: AiChatSessionItem,
    operation: () => Promise<T>,
  ): Promise<T> {
    const current = aiPromptContext.getStore();
    let scope =
      current &&
      (!session.promptManifest ||
        JSON.stringify(session.promptManifest) ===
          JSON.stringify(current.manifest))
        ? current
        : await this.load(session.promptManifest);
    if (!session.promptManifest) {
      // Compare-and-set also coordinates requests handled by different backend instances.
      const updated = await this.em.nativeUpdate(
        AiChatSessionItem,
        { handle: session.handle, promptManifest: null },
        { promptManifest: scope.manifest },
      );
      if (!updated) {
        const pinned = await this.em.findOneOrFail(
          AiChatSessionItem,
          { handle: session.handle },
          { refresh: true },
        );
        if (!pinned.promptManifest)
          throw new ServiceUnavailableException('ai.promptVersionUnavailable');
        scope = await this.load(pinned.promptManifest);
      }
      session.promptManifest = scope.manifest;
    }
    return aiPromptContext.run(scope, operation);
  }

  async record<T>(
    purpose: string,
    user: PersonItem,
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.run(async () => {
      const run = this.em.create(AiAgentRunItem, {
        person: this.em.getReference(PersonItem, user.handle as never),
        status: 'running',
        purpose,
        promptManifest: aiPromptContext.getStore()!.manifest,
        startedAt: new Date(),
      });
      this.em.persist(run);
      await this.em.flush();
      const diagnostics: NonNullable<AiPromptScope['diagnostics']> = {};
      try {
        const result = await aiPromptContext.run(
          { ...aiPromptContext.getStore()!, diagnostics },
          operation,
        );
        run.status = 'completed';
        return result;
      } catch (error) {
        run.status = 'failed';
        throw error;
      } finally {
        Object.assign(run, diagnostics);
        run.completedAt = new Date();
        run.durationMs = run.completedAt.getTime() - run.startedAt!.getTime();
        await this.em.flush();
      }
    });
  }

  async publish(
    key: string,
    author: PersonItem,
    changeNote?: string,
    restoreVersion?: number,
  ): Promise<AiPromptVersionItem> {
    return this.em.transactional(async (em) => {
      const template = await em.findOne(
        AiPromptTemplateItem,
        { handle: key },
        { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
      );
      if (!template) throw new NotFoundException('ai.promptNotFound');
      const restored =
        restoreVersion == null
          ? null
          : await em.findOne(AiPromptVersionItem, {
              handle: restoreVersion,
              template: { handle: key },
            });
      if (restoreVersion != null && !restored)
        throw new NotFoundException('ai.promptVersionNotFound');
      const content = restored?.content ?? template.draft;
      const variables = restored?.variables ?? template.variables;
      validatePrompt(content, variables);
      const latest = await em.findOne(
        AiPromptVersionItem,
        { template: { handle: key } },
        { orderBy: { version: 'DESC' } },
      );
      const version = em.create(AiPromptVersionItem, {
        template,
        version: (latest?.version ?? 0) + 1,
        content,
        variables,
        changeNote: changeNote ?? null,
        author: em.getReference(PersonItem, author.handle as never),
        publishedAt: new Date(),
        checksum: createHash('sha256').update(content).digest('hex'),
      });
      em.persist(version);
      await em.flush();
      template.publishedVersion = version;
      if (restored) {
        template.draft = content;
        template.variables = variables;
      }
      await em.flush();
      return version;
    });
  }

  async preview(
    key: string,
    values: Record<string, unknown>,
    versionHandle?: number,
  ): Promise<{ content: string }> {
    const template = await this.em.findOne(AiPromptTemplateItem, {
      handle: key,
    });
    if (!template) throw new NotFoundException('ai.promptNotFound');
    const version =
      versionHandle == null
        ? null
        : await this.em.findOne(AiPromptVersionItem, {
            handle: versionHandle,
            template: { handle: key },
          });
    if (versionHandle != null && !version)
      throw new NotFoundException('ai.promptVersionNotFound');
    return {
      content: renderPrompt(
        version?.content ?? template.draft,
        version?.variables ?? template.variables,
        values,
      ),
    };
  }
}
