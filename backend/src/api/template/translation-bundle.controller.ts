import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TranslationBundleService } from './translation-bundle.service';

/** Translation content is already publicly readable through generic CRUD. */
@Controller('api/translation')
export class TranslationBundleController {
  constructor(private readonly bundles: TranslationBundleService) {}

  @Get('bundle')
  async getBundle(
    @Query('language') language: string,
    @Query('entities') entities: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const bundle = await this.bundles.load(language ?? '', entities ?? '');
    res.setHeader('ETag', bundle.etag);
    // Always revalidate: edits, deletes, seeders and other instances are immediately visible.
    res.setHeader('Cache-Control', 'public, no-cache');
    if (
      req.headers['if-none-match']
        ?.split(',')
        .map((value) => value.trim())
        .includes(bundle.etag)
    ) {
      res.status(304).end();
      return;
    }
    res.json({ messages: bundle.messages });
  }
}
