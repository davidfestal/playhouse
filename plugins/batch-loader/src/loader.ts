import { DatabaseManager, resolvePackagePath } from '@backstage/backend-common';
import {
  CompoundEntityRef,
  Entity,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { Logger } from 'winston';

export interface BatchLoaderOptions {
  logger: Logger;
  databaseManager: DatabaseManager;
}

export class BatchLoader {
  private readonly logger: Logger;
  private readonly manager: DatabaseManager;
  constructor(options: BatchLoaderOptions) {
    this.logger = options.logger;
    this.manager = options.databaseManager;
  }

  public async init() {
    this.logger.info('Initializing batch loader');
    const client = await this.manager.forPlugin('catalog').getClient();
    const migrationsDir = resolvePackagePath(
      '@frontside/backstage-plugin-batch-loader',
      'migrations',
    );
    this.logger.info(`Running migrations from ${migrationsDir}`);
    await client.raw('CREATE SCHEMA IF NOT EXISTS refs;');
    await client.migrate.latest({
      schemaName: 'refs',
      directory: migrationsDir,
    });
  }

  public async getEntitiesByRefs(
    refs: (string | CompoundEntityRef)[],
  ): Promise<Entity[]> {
    this.logger.info(`Loading entities for refs: ${refs}`);
    const client = await this.manager.forPlugin('catalog').getClient();
    const stringifiedRefs = refs.map(ref => typeof ref === 'string' ? ref : stringifyEntityRef(ref))
    const rows = await client('refs.entities')
      .select('final_entity')
      .whereIn('refs.entities.ref', stringifiedRefs)
      .orderByRaw(`FIELD(refs.entities.ref, '${stringifiedRefs.join("','")}')`);
    const entities = rows.map(row => JSON.parse(row.final_entity));
    this.logger.info(`Loaded ${entities.length} entities`);
    return entities;
  }
}