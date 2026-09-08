import { describe, expect, it, jest } from '@jest/globals';
jest.mock('fs', () => ({ readFileSync: () => Buffer.from('image-bytes') }));
import PostalMime from 'postal-mime';
import { buildMimeMessage } from './mail-mime.util';

describe('mail MIME inline images', () => {
  it('delivers CID image bytes alongside ordinary attachments and alternative bodies', async () => {
    const raw = buildMimeMessage(
      {
        toRecipients: ['customer@example.com'],
        subject: 'Screenshot',
        bodyHtml: '<p>Before<img src="cid:image@sapling" />After</p>',
      } as never,
      [
        {
          handle: 1,
          filename: 'image.png',
          mimetype: 'image/png',
          filePath: 'image',
          contentId: 'image@sapling',
        },
        {
          handle: 2,
          filename: 'document.pdf',
          mimetype: 'application/pdf',
          filePath: 'pdf',
        },
      ],
      'Before After',
    );
    const parsed = await PostalMime.parse(raw);
    expect(parsed.text).toContain('Before After');
    expect(parsed.html).toContain('Before<img src="cid:image@sapling" />After');
    expect(parsed.attachments).toHaveLength(2);
    expect(parsed.attachments[0]).toMatchObject({
      disposition: 'inline',
      contentId: '<image@sapling>',
      mimeType: 'image/png',
    });
    expect(
      Buffer.from(
        new Uint8Array(parsed.attachments[0].content as ArrayBuffer),
      ).toString(),
    ).toBe('image-bytes');
    expect(parsed.attachments[1].disposition).toBe('attachment');
    expect(raw).toContain('multipart/related');
  });
});
