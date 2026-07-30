import {
  ScriptResultClient,
  ScriptResultClientMethods,
} from './core/script.result.client.js';
import { ScriptClass } from './core/script.class.js';

export class DvelopEntityMappingController extends ScriptClass {
  async execute(
    items: object[],
    name: string,
    parameter?: unknown,
  ): Promise<ScriptResultClient> {
    if (name !== 'aiCreatePropertyMappings') {
      return super.execute(items, name, parameter);
    }

    void parameter;
    const item = this.requireSingleItem(items);
    const handle = this.requireHandle(item);

    return new ScriptResultClient(
      ScriptResultClientMethods.callURL,
      true,
      buildAiChatPromptUrl(
        buildPropertyMappingPrompt(handle, item),
        'd.velop Cloud-Eigenschaftszuordnung erstellen',
        handle,
      ),
    );
  }

  private requireSingleItem(items: object[]): Record<string, unknown> {
    const item = items[0];

    if (items.length !== 1 || !item || typeof item !== 'object') {
      throw new Error('script.singleSelectionRequired');
    }

    return item as Record<string, unknown>;
  }

  private requireHandle(item: Record<string, unknown>): string | number {
    const handle = item.handle;

    if (
      (typeof handle === 'string' && handle.trim()) ||
      (typeof handle === 'number' && Number.isFinite(handle))
    ) {
      return handle;
    }

    throw new Error('global.invalidPayload');
  }
}

function buildPropertyMappingPrompt(
  handle: string | number,
  item: Record<string, unknown>,
): string {
  const entityLabel = normalizeReferenceLabel(item.entity);
  const connectionLabel = normalizeReferenceLabel(item.connection);
  const objectDefinitionLabel = normalizeReferenceLabel(item.objectDefinition);

  return [
    'Bitte erstelle fuer diese d.velop Cloud-Zuordnung passende Eigenschaftszuordnungen.',
    '',
    `Aktuelle Zuordnung: ${String(handle)}`,
    entityLabel ? `Sapling-Entitaet aus der Liste: ${entityLabel}` : null,
    connectionLabel
      ? `d.velop Cloud-Verbindung aus der Liste: ${connectionLabel}`
      : null,
    objectDefinitionLabel
      ? `Ablagekategorie aus der Liste: ${objectDefinitionLabel}`
      : null,
    '',
    'Arbeitsweise:',
    '1. Lade die Zuordnung mit generic_get.',
    `   entityHandle: dvelopEntityMapping, handle: ${JSON.stringify(handle)}, relations: ["connection", "entity", "objectDefinition", "searchCategories", "searchCategories.objectDefinition", "propertyMappings", "propertyMappings.property"]`,
    '2. Pruefe, ob connection und entity gesetzt sind. Wenn eine davon fehlt, stoppe und erklaere, was konfiguriert werden muss.',
    '3. Lade das Sapling-Schema der gemappten Entitaet mit entity_schema. Verwende exakt die technischen Feldnamen aus dem Schema.',
    '4. Lade die aktiven d.velop Eigenschaften der Verbindung mit generic_list auf dvelopProperty. Filtere ueber connection.handle, objectDefinition.handle der Ablagekategorie und isActive=true, sortiere nach title ASC und lade bei Bedarf alle Seiten mit hoechstens 100 Datensaetzen pro Seite. Wenn keine Ablagekategorie gesetzt ist, verwende nur Eigenschaften ohne objectDefinition.',
    '5. Lade vorhandene Eigenschaftszuordnungen mit generic_list auf dvelopEntityMappingProperty fuer diese mapping.handle und Relation property.',
    '6. Erzeuge konservative Matches zwischen d.velop Eigenschaften und Sapling-Feldern.',
    '',
    'Matching-Regeln:',
    '- Erstelle oder aktualisiere nur Zuordnungen, bei denen du dir fachlich sicher bist.',
    '- Verwende nur d.velop Eigenschaften, die zur Ablagekategorie der Zuordnung passen.',
    '- Ueberspringe die d.velop Systemfelder property_caption und property_remark; der Ablagedialog akzeptiert sie nicht als URL-Prefill-Properties.',
    '- Verwende dvelopEntityMappingProperty.mapping = aktuelle Zuordnung und property = d.velop Eigenschafts-Handle.',
    '- Verwende sourceField fuer Sapling-Feldnamen, die der Dokumentdienst lesen kann.',
    '- Bevorzuge Top-Level-Skalarfelder wie handle, number, title, externalNumber, createdAt oder startDate.',
    '- Relation-Felder duerfen nur als Top-Level-Handle-Felder verwendet werden, nicht als verschachtelte Anzeigenamen.',
    '- Vermeide Collections, Read-only/Systemfelder, Security-Felder, Tokens, API-Keys, Passwoerter und rein technische Metadaten.',
    '- Verwende staticValue nur fuer wirklich feste Werte; erfinde keine Konstanten.',
    '- Wenn fuer eine d.velop Eigenschaft bereits eine Zuordnung existiert, nutze generic_update statt eine Dublette anzulegen.',
    '- Lege neue Zuordnungen mit isActive=true und sortOrder in 10er-Schritten an.',
    '- Aendere keine Suchkategorien und keine Ablagekategorie.',
    '',
    'Gib danach kompakt aus:',
    '- angelegte oder aktualisierte Zuordnungen mit d.velop Eigenschaft, sourceField/staticValue und kurzer Begruendung',
    '- bewusst uebersprungene d.velop Eigenschaften mit Grund',
    '- offene Rueckfragen, falls Pflichtfelder nicht sicher gemappt werden konnten',
    '',
    'Bereite schreibende Aenderungen ueber generic_create oder generic_update vor. Wenn Sapling eine Bestaetigung verlangt, sage klar, dass die vorbereiteten Aktionen noch bestaetigt werden muessen.',
  ]
    .filter(
      (line): line is string => typeof line === 'string' && line.length > 0,
    )
    .join('\n');
}

function buildAiChatPromptUrl(
  prompt: string,
  title: string,
  handle?: string | number,
): string {
  const params = new URLSearchParams({
    prompt,
    title,
    autoSend: 'true',
    newChat: 'true',
    agentHandle: 'songbirdGeneral',
    contextEntityHandle: 'dvelopEntityMapping',
  });

  if (handle != null) {
    params.set('contextRecordHandle', String(handle));
  }

  return `sapling-ai-chat://prompt?${params.toString()}`;
}

function normalizeReferenceLabel(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const record = value as Record<string, unknown>;

  return [record.handle, record.title, record.name]
    .filter((part) => typeof part === 'string' || typeof part === 'number')
    .map(String)
    .join(' - ');
}
