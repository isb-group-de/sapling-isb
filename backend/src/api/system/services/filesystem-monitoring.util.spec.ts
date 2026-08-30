import {
  filesystemDimension,
  isMonitorableFilesystem,
} from './filesystem-monitoring.util';

describe('filesystem monitoring filter', () => {
  it('keeps local physical filesystems', () => {
    expect(
      isMonitorableFilesystem(
        { fs: 'C:', mount: 'C:', type: 'NTFS' },
        new Set(['G:']),
      ),
    ).toBe(true);
  });

  it.each([
    { fs: 'G:', mount: 'G:', type: 'DriveFS' },
    { fs: 'google-drive', mount: '/mnt/cloud', type: 'fuse' },
    { fs: '//server/share', mount: '/mnt/share', type: 'cifs' },
  ])('excludes cloud and network filesystems', (filesystem) => {
    expect(isMonitorableFilesystem(filesystem)).toBe(false);
  });

  it('uses Windows drive classification for providers reported as FAT32', () => {
    expect(
      isMonitorableFilesystem(
        { fs: 'G:', mount: 'G:', type: 'FAT32' },
        new Set(['G:']),
      ),
    ).toBe(false);
  });

  it('uses the mount as the stable incident dimension', () => {
    expect(
      filesystemDimension({ fs: '/dev/sda1', mount: '/', type: 'ext4' }),
    ).toBe('/');
  });
});
