import { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { createHash } from 'crypto';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { AiPromptTemplateItem } from '../../entity/AiPromptTemplateItem';
import { AiPromptVersionItem } from '../../entity/AiPromptVersionItem';
import { SeedScriptItem } from '../../entity/SeedScriptItem';
import { validatePrompt } from '../../api/ai/prompts/ai-prompt-context';

/** Additive numbered seed files never overwrite an existing published prompt. */
export class AiPromptSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    const directory = join(__dirname, 'prompts');
    for (const scriptName of readdirSync(directory)
      .filter((name) => /^promptData_\d+\.json$/.test(name))
      .sort()) {
      if (
        await em.findOne(SeedScriptItem, {
          entityHandle: 'aiPromptTemplate',
          scriptName,
          isSuccess: true,
        })
      )
        continue;
      const definitions = JSON.parse(
        readFileSync(join(directory, scriptName), 'utf8'),
      ) as Array<{
        handle: string;
        title: string;
        description: string;
        purpose: string;
        draft: string;
        variables: string[];
      }>;
      for (const definition of definitions) {
        validatePrompt(definition.draft, definition.variables);
        let template = await em.findOne(
          AiPromptTemplateItem,
          { handle: definition.handle },
          { populate: ['publishedVersion'] },
        );
        if (template) {
          // Offer later application changes as a draft; preserve an administrator's unfinished edits.
          if (
            scriptName !== 'promptData_001.json' &&
            template.draft === template.publishedVersion?.content
          ) {
            template.draft = definition.draft;
            template.variables = definition.variables;
          }
          continue;
        }
        template = em.create(AiPromptTemplateItem, {
          ...definition,
          updatedAt: new Date(),
        });
        em.persist(template);
        await em.flush();
        const version = em.create(AiPromptVersionItem, {
          template,
          version: 1,
          content: definition.draft,
          variables: definition.variables,
          checksum: createHash('sha256').update(definition.draft).digest('hex'),
          publishedAt: new Date(),
          changeNote: 'Initial application instructions',
        });
        em.persist(version);
        await em.flush();
        template.publishedVersion = version;
      }
      em.persist(
        em.create(SeedScriptItem, {
          entityHandle: 'aiPromptTemplate',
          scriptName,
          executedAt: new Date(),
          isSuccess: true,
        }),
      );
      await em.flush();
    }
  }
}
