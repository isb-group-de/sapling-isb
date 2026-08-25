import { extractEmlAttachments } from './document-mail-attachment.util';

describe('extractEmlAttachments', () => {
  it('extracts regular attachments and excludes inline MIME parts', async () => {
    const rawMessage = Buffer.from(
      [
        'From: Sender <sender@example.com>',
        'To: receiver@example.com',
        'Subject: Test',
        'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="outer"',
        '',
        '--outer',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Hello',
        '--outer',
        'Content-Type: application/pdf; name="report.pdf"',
        'Content-Disposition: attachment; filename="report.pdf"',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from('pdf-content').toString('base64'),
        '--outer',
        'Content-Type: image/png; name="signature.png"',
        'Content-Disposition: inline; filename="signature.png"',
        'Content-ID: <signature>',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from('inline-content').toString('base64'),
        '--outer--',
        '',
      ].join('\r\n'),
    );

    const attachments = await extractEmlAttachments(rawMessage);

    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({
      filename: 'report.pdf',
      mimetype: 'application/pdf',
    });
    expect(attachments[0].buffer.toString()).toBe('pdf-content');
  });

  it('uses a stable fallback when an attachment has no filename', async () => {
    const rawMessage = Buffer.from(
      [
        'From: sender@example.com',
        'To: receiver@example.com',
        'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="outer"',
        '',
        '--outer',
        'Content-Type: text/plain',
        '',
        'Hello',
        '--outer',
        'Content-Type: application/octet-stream',
        'Content-Disposition: attachment',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from('unnamed').toString('base64'),
        '--outer--',
        '',
      ].join('\r\n'),
    );

    const attachments = await extractEmlAttachments(rawMessage);

    expect(attachments[0].filename).toBe('attachment-1');
    expect(attachments[0].buffer.toString()).toBe('unnamed');
  });
});
