import {
  resolveUploadedDocumentDescription,
  resolveUploadedDocumentFilename,
  resolveUploadedDocumentMimeType,
} from './document-mime.util';

describe('resolveUploadedDocumentMimeType', () => {
  it.each([
    ['mail.eml', '', 'message/rfc822'],
    ['MAIL.EML', 'application/octet-stream', 'message/rfc822'],
    ['outlook.msg', '', 'application/vnd.ms-outlook'],
    ['OUTLOOK.MSG', 'application/octet-stream', 'application/vnd.ms-outlook'],
    ['report.pdf', '', 'application/pdf'],
    ['photo.JPG', 'application/octet-stream', 'image/jpeg'],
    ['data.json', '', 'application/json'],
  ])(
    'normalizes %s independently from the browser MIME type',
    (filename, input, expected) => {
      expect(resolveUploadedDocumentMimeType(filename, input)).toBe(expected);
    },
  );

  it('preserves a specific MIME type for other files', () => {
    expect(
      resolveUploadedDocumentMimeType('report.pdf', 'application/pdf'),
    ).toBe('application/pdf');
  });

  it('falls back to a generic binary type when no type is available', () => {
    expect(resolveUploadedDocumentMimeType('archive.bin')).toBe(
      'application/octet-stream',
    );
  });
});

describe('resolveUploadedDocumentFilename', () => {
  it('repairs UTF-8 filenames exposed as Latin-1 mojibake', () => {
    expect(
      resolveUploadedDocumentFilename(
        'Auswertungen der Ãberstunden Mai 2026.eml',
      ),
    ).toBe('Auswertungen der Überstunden Mai 2026.eml');
  });

  it('preserves filenames that are already valid Unicode', () => {
    expect(resolveUploadedDocumentFilename('Überstunden.msg')).toBe(
      'Überstunden.msg',
    );
  });

  it('preserves ASCII filenames', () => {
    expect(resolveUploadedDocumentFilename('mail.eml')).toBe('mail.eml');
  });
});

describe('resolveUploadedDocumentDescription', () => {
  it('preserves an explicit description', () => {
    expect(
      resolveUploadedDocumentDescription('report.pdf', 'Monthly report'),
    ).toBe('Monthly report');
  });

  it.each([undefined, '', '   '])(
    'falls back to the filename when description is %p',
    (description) => {
      expect(
        resolveUploadedDocumentDescription('report.pdf', description),
      ).toBe('report.pdf');
    },
  );
});
