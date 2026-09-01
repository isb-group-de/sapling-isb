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
import { SystemTelemetryController } from './system-telemetry.controller';
import { SystemTelemetryEnvironmentService } from './services/system-telemetry-environment.service';
import { SystemErrorRecorderService } from './services/system-error-recorder.service';
import { SystemCheckService } from './services/system-check.service';
import { SystemRemediationService } from './services/system-remediation.service';
import { SystemProcessErrorCaptureService } from './services/system-process-error-capture.service';
import { SystemQueueErrorCaptureService } from './services/system-queue-error-capture.service';

@Module({
  imports: [AuthModule, GenericModule, OpenTaskEventsModule],
  controllers: [SystemController, SystemTelemetryController],
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
    SystemTelemetryEnvironmentService,
    SystemErrorRecorderService,
    SystemCheckService,
    SystemRemediationService,
    SystemProcessErrorCaptureService,
    SystemQueueErrorCaptureService,
  ],
  exports: [
    HttpTelemetryService,
    SystemTelemetryCollectorService,
    AiUsageTelemetryService,
    SystemErrorRecorderService,
  ],
})
export class SystemModule {}
