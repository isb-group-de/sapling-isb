/**
 * @class SystemModule
 * @version         1.0
 * @author          Martin Rosbund
 * @summary         Module providing system-related services and controller for system information endpoints.
 *
 * @property        {SystemController}     SystemController     Controller for system endpoints
 * @property        {CpuService}           CpuService           Service for CPU information
 * @property        {MemoryService}        MemoryService        Service for memory information
 * @property        {FilesystemService}    FilesystemService    Service for filesystem information
 * @property        {NetworkService}       NetworkService       Service for network information
 * @property        {OsService}            OsService            Service for operating system information
 * @property        {TimeService}          TimeService          Service for time information
 * @property        {VersionService}       VersionService       Service for application version information
 */
import { Module } from '@nestjs/common';
import { SystemController } from './system.controller';
import { CpuService } from './services/cpu.service';
import { MemoryService } from './services/memory.service';
import { FilesystemService } from './services/filesystem.service';
import { NetworkService } from './services/network.service';
import { OsService } from './services/os.service';
import { TimeService } from './services/time.service';
import { VersionService } from './services/version.service';
import { AuthModule } from '../../auth/auth.module';
import { GenericModule } from '../generic/generic.module';
import { DatabaseService } from './services/database.service';
import { DocumentStorageService } from './services/document-storage.service';
import { HttpTelemetryService } from './services/http-telemetry.service';
import { SystemTelemetryCollectorService } from './services/system-telemetry-collector.service';
import { SystemMonitoringQueryService } from './services/system-monitoring-query.service';
import { AiUsageTelemetryService } from './services/ai-usage-telemetry.service';
import { SystemAlertService } from './services/system-alert.service';
import { SystemTelemetryRetentionService } from './services/system-telemetry-retention.service';
import { SystemAlertNotificationService } from './services/system-alert-notification.service';
import { OpenTaskEventsModule } from '../current/open-task-events.module';
import { TelemetrySpoolService } from './services/telemetry-spool.service';

@Module({
  imports: [AuthModule, GenericModule, OpenTaskEventsModule],
  controllers: [SystemController],
  providers: [
    CpuService,
    MemoryService,
    FilesystemService,
    NetworkService,
    OsService,
    TimeService,
    VersionService,
    DatabaseService,
    DocumentStorageService,
    HttpTelemetryService,
    SystemTelemetryCollectorService,
    SystemMonitoringQueryService,
    AiUsageTelemetryService,
    SystemAlertService,
    SystemTelemetryRetentionService,
    SystemAlertNotificationService,
    TelemetrySpoolService,
  ],
  exports: [
    HttpTelemetryService,
    SystemTelemetryCollectorService,
    AiUsageTelemetryService,
  ],
})
export class SystemModule {}
