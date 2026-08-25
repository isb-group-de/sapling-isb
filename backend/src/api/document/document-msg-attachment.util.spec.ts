const mockGetFileData = jest.fn();
const mockGetAttachment = jest.fn();

jest.mock('@kenjiuno/msgreader', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    getFileData: mockGetFileData,
    getAttachment: mockGetAttachment,
  })),
}));

import { extractMsgAttachments } from './document-mail-attachment.util';

describe('extractMsgAttachments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('extracts visible attachments and excludes hidden Outlook parts', () => {
    const visibleAttachment = {
      fileName: 'report.pdf',
      attachmentHidden: false,
    };
    const hiddenAttachment = {
      fileName: 'signature.png',
      attachmentHidden: true,
    };
    mockGetFileData.mockReturnValue({
      attachments: [visibleAttachment, hiddenAttachment],
    });
    mockGetAttachment.mockReturnValue({
      fileName: 'report.pdf',
      content: Uint8Array.from(Buffer.from('pdf-content')),
    });

    const attachments = extractMsgAttachments(Buffer.from('msg-content'));

    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({
      filename: 'report.pdf',
      mimetype: 'application/pdf',
    });
    expect(attachments[0].buffer.toString()).toBe('pdf-content');
    expect(mockGetAttachment).toHaveBeenCalledWith(visibleAttachment);
    expect(mockGetAttachment).toHaveBeenCalledTimes(1);
  });

  it('surfaces MSG parser errors to the best-effort upload boundary', () => {
    mockGetFileData.mockReturnValue({ error: 'Invalid MSG file' });

    expect(() => extractMsgAttachments(Buffer.from('invalid'))).toThrow(
      'Invalid MSG file',
    );
  });
});
