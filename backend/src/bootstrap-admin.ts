import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { MikroORM } from '@mikro-orm/core';
import config from './database/mikro-orm.config';
import { PersonItem } from './entity/PersonItem';
import { PersonTypeItem } from './entity/PersonTypeItem';
import { RoleItem } from './entity/RoleItem';
import { parseBootstrapAdminInput } from './bootstrap-admin-input';

async function loadInput(path: string) {
  const fileStat = await stat(path);
  if (!fileStat.isFile() || (fileStat.mode & 0o077) !== 0) {
    throw new Error(
      'Administrator input must be a regular file with mode 0600.',
    );
  }
  return parseBootstrapAdminInput(await readFile(path, 'utf8'));
}

async function bootstrapAdmin(): Promise<void> {
  dotenv.config();
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error(
      'Usage: node dist/bootstrap-admin.js <administrator-input-file>',
    );
  }

  const input = await loadInput(inputPath);
  const orm = await MikroORM.init(config);
  try {
    await orm.em.transactional(async (em) => {
      const administratorRole = await em.findOne(RoleItem, {
        isAdministrator: true,
      });
      if (!administratorRole) {
        throw new Error('Administrator role was not seeded.');
      }
      const saplingPersonType = await em.findOne(PersonTypeItem, {
        handle: 'sapling',
      });
      if (!saplingPersonType) {
        throw new Error('Sapling person type was not seeded.');
      }

      const requestedAccount = await em.findOne(
        PersonItem,
        {
          loginName: input.loginName,
        },
        { populate: ['roles'] },
      );
      const seededAccount = await em.findOne(
        PersonItem,
        { loginName: 'system_admin' },
        { populate: ['roles'] },
      );
      const account =
        requestedAccount ??
        seededAccount ??
        em.create(PersonItem, {
          firstName: 'System',
          lastName: 'Administrator',
          loginName: input.loginName,
          isActive: true,
          sendNewsletter: false,
          requirePasswordChange: false,
          type: saplingPersonType,
        });

      account.loginName = input.loginName;
      account.loginPassword = input.password;
      account.isActive = true;
      account.requirePasswordChange = false;
      if (!account.roles.contains(administratorRole)) {
        account.roles.add(administratorRole);
      }

      if (seededAccount && seededAccount !== account) {
        seededAccount.isActive = false;
        seededAccount.loginPassword = randomBytes(48).toString('hex');
      }

      await em
        .persist([
          account,
          ...(seededAccount && seededAccount !== account
            ? [seededAccount]
            : []),
        ])
        .flush();
    });
    console.log(
      `Administrator account '${input.loginName}' was bootstrapped successfully.`,
    );
  } finally {
    await orm.close();
  }
}

void bootstrapAdmin().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Administrator bootstrap failed: ${message}`);
  process.exitCode = 1;
});
