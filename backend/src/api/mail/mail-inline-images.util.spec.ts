import { describe, expect, it, jest } from '@jest/globals';
jest.mock('../../entity/DocumentItem', () => ({ DocumentItem: class {} }));
import {
  normalizeMailImageEmbeds,
  resolveMailInlineImages,
} from './mail-inline-images.util';
import { renderMarkdownBlocks } from './markdown.util';

const document = {
  handle: 42,
  entity: { handle: 'ticket' },
  reference: '7',
  filename: 'screenshot.png',
  mimetype: 'image/png',
  path: 'opaque-file',
};

describe('outgoing inline images', () => {
  it('keeps image positions and resolves repeated editor embeds only once', async () => {
    const markdown = normalizeMailImageEmbeds(
      'Before {{sapling-image:42|Screenshot}} after\n{{sapling-image:42|Again}}',
    );
    const em = {
      find: jest.fn<(...args: unknown[]) => Promise<(typeof document)[]>>(
        async () => [document],
      ),
    };
    const result = await resolveMailInlineImages(
      em as never,
      renderMarkdownBlocks(markdown),
      'ticket',
      7,
    );
    expect(result.bodyHtml).toContain(
      'Before <img src="cid:sapling-image-42@sapling" alt="Screenshot" /> after',
    );
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].contentId).toBe('sapling-image-42@sapling');
    expect(em.find).toHaveBeenCalledWith(
      expect.anything(),
      {
        handle: { $in: [42] },
        entity: { handle: 'ticket' },
        reference: '7',
      },
      { populate: ['entity'] },
    );
  });

  it.each(
    [
      [],
      [{ ...document, reference: '8' }],
      [{ ...document, entity: { handle: 'person' } }],
      [{ ...document, mimetype: 'application/pdf' }],
    ].map((documents) => ({ documents })),
  )(
    'rejects missing, foreign and non-image documents (%j)',
    async ({ documents }) => {
      await expect(
        resolveMailInlineImages(
          { find: async () => documents } as never,
          '<img src="sapling-document:42" />',
          'ticket',
          7,
        ),
      ).rejects.toThrow('mail.checkUnavailableAttachments');
    },
  );

  it('leaves external images, links and code examples alone', async () => {
    const html = renderMarkdownBlocks(
      '![External](https://example.com/image.png) [file](sapling-document:42) `![Code](sapling-document:42)`',
    );
    const em = { find: jest.fn() };
    expect(
      await resolveMailInlineImages(em as never, html, 'ticket', 7),
    ).toEqual({ bodyHtml: html, attachments: [] });
    expect(em.find).not.toHaveBeenCalled();
  });
});
