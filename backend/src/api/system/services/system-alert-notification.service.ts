import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { OpenTaskEventsService } from '../../current/open-task-events.service';
import { SystemAlertIncidentItem } from '../../../entity/SystemAlertIncidentItem';
import { executeRows } from './sql-query.utils';

@Injectable()
export class SystemAlertNotificationService {
  constructor(
    private readonly em: EntityManager,
    private readonly openTaskEvents: OpenTaskEventsService,
  ) {}

  async notifyOpened(incident: SystemAlertIncidentItem): Promise<void> {
    if (incident.handle == null) return;
    const em = this.em.fork();
    const [references, admins] = await Promise.all([
      executeRows(
        em,
        `select subscription."handle" as "subscriptionHandle",
           template."handle" as "templateHandle"
         from "inbox_subscription_item" subscription
         join "inbox_template_item" template on template."handle" = subscription."template_handle"
         where subscription."description" = 'System monitoring alerts'
           and subscription."is_active" = true and template."is_active" = true limit 1`,
      ),
      executeRows(
        em,
        `select distinct person."handle"
         from "person_item" person
         join "person_item_roles" person_role on person_role."person_item_handle" = person."handle"
         join "role_item" role on role."handle" = person_role."role_item_handle"
         where person."is_active" = true and role."is_administrator" = true`,
      ),
    ]);
    const reference = references[0];
    const handles = admins.map((row) => Number(row.handle));
    if (!reference || handles.length === 0) return;
    const title = `${incident.severity === 'critical' ? 'Critical' : 'Warning'}: ${incident.rule.title}`;
    const dimension = incident.dimensionKey
      ? ` (${incident.dimensionKey})`
      : '';
    const body = `${incident.rule.title}${dimension}\n\nObserved: ${incident.observedValue.toFixed(2)} · Threshold: ${incident.threshold.toFixed(2)}`;
    for (const personHandle of handles) {
      await em.getConnection().execute(
        `insert into "inbox_notification_item" (
          "entity_handle", "subscription_handle", "template_handle",
          "recipient_person_handle", "created_by_handle", "reference_handle",
          "title", "body_markdown", "body_text", "request_payload",
          "is_read", "created_at", "updated_at"
        ) values ('systemAlertIncident', ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, false, now(), now())`,
        [
          reference.subscriptionHandle,
          reference.templateHandle,
          personHandle,
          personHandle,
          String(incident.handle),
          title,
          body,
          body,
          JSON.stringify({
            source: 'system-monitoring',
            incidentHandle: incident.handle,
          }),
        ],
      );
    }
    this.openTaskEvents.notifyUsers(handles);
  }
}
