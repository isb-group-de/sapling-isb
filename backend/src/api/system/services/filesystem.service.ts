/**
 * @class FilesystemService
 * @version         1.0
 * @author          Martin Rosbund
 * @summary         Service providing filesystem information using systeminformation library.
 */
import { Injectable } from '@nestjs/common';
import systeminformation from 'systeminformation';
import {
  filesystemDimension,
  getExcludedWindowsFilesystemRoots,
  isMonitorableFilesystem,
} from './filesystem-monitoring.util';

@Injectable()
export class FilesystemService {
  private ignoredFilesystemDimensions: string[] = [];

  /**
   * Returns filesystem information.
   * @returns {Promise<object>} Filesystem information object
   */
  async getFilesystem() {
    const filesystems = await systeminformation.fsSize();
    const excludedWindowsRoots = await getExcludedWindowsFilesystemRoots();
    const included = filesystems.filter((filesystem) =>
      isMonitorableFilesystem(filesystem, excludedWindowsRoots),
    );
    this.ignoredFilesystemDimensions = filesystems
      .filter((filesystem) => !included.includes(filesystem))
      .map(filesystemDimension);
    return included;
  }

  getIgnoredFilesystemDimensions(): readonly string[] {
    return this.ignoredFilesystemDimensions;
  }
}
