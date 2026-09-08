# Umsetzung: AI-Prompts, Performance und Automatisierungen

Die drei Funktionspakete sind im Quellcode implementiert. Migration und neue Seeder sind vorbereitet. Meine Prüfungen der bereitgestellten Datenbank waren ausschließlich lesend. Die Migration wurde auf einer eigens angelegten, anschließend entfernten lokalen Testdatenbank ausgeführt. Ein Deployment wurde nicht vorgenommen.

## Implementierte Funktionen

- **AI-Prompts:** 236 bisher im Code enthaltene Anweisungsbausteine werden durch `AiPromptTemplate` und unveränderliche `AiPromptVersion`-Datensätze aufgelöst. Entwurf speichern, Vorschau, Verwendungsnachweise, Textvergleich, Veröffentlichung und Wiederherstellung stehen in der Agent-Workbench bereit. Normale generische Formulare verwenden dieselben Entitäten. Chat-Manifeste bleiben fest; ältere Chats erhalten ihren Stand beim nächsten Aufruf einmalig, auch über Backendinstanzen hinweg. E-Mail-Wiederholungen behalten ihren Promptstand. Eigenständige AI-Aufrufe erhalten Versionsreferenzen und Diagnoseinformationen. Fehlende Prompts und ungültige Platzhalter führen zu Konfigurationsfehlern. Toolrechte und Bestätigungspflichten bleiben technische Prüfungen. Siehe [Promptverwaltung](../ai/published-prompts.md).
- **Qualität:** Testsammlungen verwenden strukturierte Erwartungen und kontrollierte Toolantworten. Der Testexecutor führt keine echten Toolaktionen aus. Laufprotokolle speichern Promptmanifest, Testprüfsumme, Ergebnis, Toolspur, Laufzeit und gemeldete Tokenwerte; Freitextkriterien bleiben manuell bewertbar. Ein anderer Promptstand lässt sich mit denselben Fällen vergleichen.
- **Performance:** Übersetzungs-Bundles mit ETag, beibehaltene Anfragenbündelung und Sprachwechselbehandlung, verzögertes Laden verdeckter Dialoge und Dashboardkataloge, wiederverwendete Metadaten innerhalb einer Kalenderoperation, Phasenmessungen und Query-Zähler. Kalenderzustellungen erfassen Wartezeit und Providerdauer getrennt. Markdown hat einen optionalen eigenen Modellstandard und getrennte Messphasen. Abgelaufene Azure-Tokens, ungültige Mailadressen und dauerhafte Webhookfehler werden gezielter behandelt. Siehe [Messprotokoll](performance-comparison-protocol.md).
- **Automatisierungen:** Administratoren öffnen den generischen, verzögert geladenen Regelgraphen über Tabellen- und Datensatzmenüs. Feld-, Inbox-, E-Mail-, Teams- und Webhookregeln erscheinen einschließlich eingehender Referenzwege, Bedingungen, Aktionen, Priorität, Aktivierung und Wiederholungssperren. Zyklen, Fortsetzungen, maximal 200 Knoten und eine Tastaturliste sind berücksichtigt. Der datensatzbezogene Verlauf zeigt Ereignis-/Kettenkennungen, gespeicherte Regelstände und tatsächliche Zustellergebnisse getrennt. Historische E-Mails ohne eindeutigen Ereignisbezug bleiben eigenständig. Siehe [Automatisierungsansicht](automation-inspection.md).

## Nachgewiesene Ergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| Historische Basis | 07.09.2026, Europe/Berlin, `host:sapling.isb-solutions.de`; 12:55–13:15 separat |
| Normale API-Aufrufe außerhalb des Updatefensters | 62.380 Aufrufe, Mittelwert 53,95 ms |
| Historische Übersetzungen | 15.747 Aufrufe, 473.281.190 erfasste Antwortbytes |
| Historisches Herauslösen von Serienterminen | 11 Aufrufe, Mittelwert 18.268,5 ms, Maximum 47.177 ms; vor dem Update |
| Kompletter deutscher Übersetzungskatalog | Alle 5.947 Schlüssel in 224 Namensräumen unverändert; 3 Bundles statt 236 paginierter Abrufe, entsprechend 98,7 % weniger Abrufen für diesen Testfall |
| Bundleprüfung | 261.853 JSON-Bytes insgesamt; 207 ms isolierte Serviceprüfung, kein HTTP-Lastvergleich |
| Migration auf separater Testdatenbank | Up/Down, 236 initiale Prompts, Veröffentlichung, Wiederherstellung, direkte SQL-Unveränderlichkeit und wiederholter Seeder erfolgreich |
| Vorhandene Dokument→Ticket-Regeln | Lesend geprüft: 24 Knoten, 22 Kanten, Feld- und Inboxregeln sowie mögliches folgendes Ticketänderungsereignis |
| Schema-Snapshot | Additiv; vorhandene Tabellen, Spalten, Indizes und Constraints unverändert |
| Backend- und Frontendbuild | Erfolgreich; Frontend als Produktionsbuild mit Vite 8.2.2 |

Die Skripte liegen in `backend/maintenance`: `performance-baseline.cjs`, `verify-translation-bundles.cjs`, `verify-prompt-migration.cjs` und `verify-automation-graph.cjs`. Sie lassen sich vom Repository-Stamm aus mit Node erneut ausführen. Die drei Service-/Migrationsprüfungen verwenden zuvor gebauten Backendcode. Zugangsdaten und Datensatzinhalte werden nicht in den Bericht geschrieben.

## Vollständiges Quality Gate

### Folgekorrektur: gemeinsame Dialogbausteine und Verlaufstabelle

Der Dialog verwendet nun zusätzlich die gemeinsame Record-Dialog-Shell mit ihren Randabständen, `SaplingDialogEditHero` und `SaplingActionBar`. Verlauf und Regeldetails sind in eigene Komponenten im Automatisierungsverzeichnis ausgelagert. Die Hinweisbox wächst nicht mehr mit dem freien Dialogplatz. E-Mail-Zustellungen werden über `SaplingDataTable` mit Datum, Betreff, Empfängern, Status und Versuchen angezeigt. Die bestehende Administrator-API ergänzt dazu lediglich Betreff und An-Empfänger der bereits zugeordneten Delivery-Datensätze; eine historische Kette wird weiterhin nicht angenommen. Der Betreff öffnet die vorhandene, exakt gefilterte Zustellungsansicht und schließt den Inspektionsdialog.

Der Detailkopf bleibt mit rechts ausgerichtetem „Regel öffnen“ sichtbar, während nur sein Inhalt scrollt. Der weiße Rahmen wurde durch die gemeinsame dezente Oberfläche ersetzt. Beide Ansichten wurden im angemeldeten Codex-Browser mit dem vorhandenen Ticket geprüft. Für diese Folgekorrektur bestehen die gezielten Prüfungen: fünf Backendtests für Verlauf und Administratorzugriff, sieben Frontendtests einschließlich Tabelleninhalten und Navigation, beide Typechecks, Lint der betroffenen Module und der Frontendbuild. Die vollständige Acht-Schritte-Tabelle unten dokumentiert den vorherigen Graph-Layout-Stand.

### Nachbesserung: Platz und Lesbarkeit des Automatisierungsplans

Der Automatisierungsdialog verwendet jetzt wie `SaplingDialogEdit` die Größe `3xl` und 90vh Höhe. Zuvor begrenzte die Standardgrößenklasse trotz `max-width` die verfügbare Breite. Der Graph nutzt den verbleibenden Dialogbereich mit eigenem Scrollbereich; Regeldetails sind in ihrer Höhe begrenzt.

Die Layoutberechnung liegt als reine Funktion zusammen mit der Oberfläche unter `components/automation`. Jede Regel erhält eine eigene Zeile mit festen Spalten für Ereignis, Regel, Bedingung, Referenz und Aktion. Fehlende optionale Schritte verschieben andere Regeln nicht. Folgeketten verlaufen auf getrennten Spuren außerhalb der Knoten. Mehrzeilige Beschriftungen, dezente Zeilenflächen und die Hervorhebung zusammengehöriger Pfeile bei Maus- oder Tastaturfokus verbessern die Lesbarkeit. Die Tests prüfen Ausrichtung ohne Überlappungen, getrennte Rückverbindungen, fehlende Knoten und lange Beschriftungen.

Im angemeldeten Codex-Browser wurde der geöffnete Ticketplan mit den vorhandenen Dokument→Ticket-Regeln geprüft: vollständige Spaltenbreite, getrennte Regelzeilen, äußerer Rückpfeil, Hervorhebung und gleichzeitig nutzbare Regeldetails. Die Tastaturhervorhebung bleibt beim Verlassen des Knotens mit der Maus erhalten und ist zusätzlich durch einen Komponententest abgesichert. Der Frontend-Produktionsbuild besteht; sein vorhandener Hinweis auf Chunks über 500 kB bleibt sichtbar. Sämtliche Änderungen an der Gestaltung liegen im bestehenden Framework-Stylesheet, ohne Inline-CSS oder lokale Style-Blöcke. Die bestehenden Größenausnahmen unten sind unverändert.

### Nachbesserung: leere generische Promptansichten

Die beiden neuen Prompt-Entitäten besaßen zunächst keine expliziten `SaplingForm`-Layouts. Daher zeigte die Tabelle trotz 236 vorhandener Vorlagen keine Datenspalten und das Formular praktisch nur den Schlüssel. Beide Entitäten definieren jetzt Sichtbarkeit, Reihenfolge, Gruppen und Breiten für Tabellen, mobile Listen und Formulare. Alle Versionsfelder sind schreibgeschützt; Titel, Beschreibung und Entwurf einer Vorlage bleiben bearbeitbar. Fehlende Swagger-Dekoratoren wurden ebenfalls ergänzt.

Zusätzlich wurden die zwölf neu hinzugekommenen Felder in acht vorhandenen Entitäten geprüft und mit expliziten Layouts ergänzt: Evaluationserwartungen und Tool-Fixtures, Einsatzbereich und Testergebnis, Promptmanifeste, Markdown-Modellstandard, Regelsnapshots sowie Queue-/Providerzeiten. JSON-Diagnosefelder werden im Formular angezeigt, ohne die Standardtabellen mit langen Inhalten zu überladen. `translationData_083.json` ergänzt 19 deutsche/englische Beschriftungen; lokal wurde ausschließlich dieser neue Übersetzungsseeder ausgeführt. Eine Schemamigration ist hierfür nicht erforderlich.

Im angemeldeten Codex-Browser wurden die gefüllte Vorlagentabelle, der Entwurf mit Markdown-Vorschau und die Versionstabelle geprüft. Im Versionsformular sind Promptinhalt, Änderungsnotiz, Veröffentlichungsdatum und Prüfsumme sichtbar und schreibgeschützt; die Gruppenüberschriften sind übersetzt. Die zwölf zusätzlichen Regressionstests prüfen sichtbare Spalten, vollständige Formularlayouts, Gruppenübersetzungen und unveränderliche Versionsfelder. Es wurden keine vorhandenen Prompttexte über die Oberfläche verändert oder veröffentlicht.

### Nachbesserung: Nest-Startfehler am 08.09.2026

Der neue Evaluation-Service machte beim Laden der Anwendung einen bestehenden Importkreis sichtbar: `AiAgentContextService → McpService → SaplingMcpService → AiService → AiAgentContextService`. Dadurch blieb insbesondere Konstruktorposition 9 von `AiService` undefiniert; weitere Chatdienste waren ebenfalls betroffen. Die MCP-Fassade und die MCP-Suchwerkzeuge verwenden jetzt direkt `AiVectorService`. Der bisherige Aufruf über `AiService` delegierte ausschließlich an diesen Dienst. Berechtigungsprüfungen und Suchverhalten bleiben erhalten.

`ai-module.bootstrap.spec.ts` kompiliert den Backendcode in ein eigenes temporäres Verzeichnis und startet einen separaten Node-Prozess. Dieser lädt zuerst die wirkliche Anwendung und lässt Nest alle 35 AI-Provider und 6 Controller der vorhandenen Module auflösen. AI- und Prompt-Module sowie ihre Klassen bleiben unverändert im Test; ausschließlich Datenbank-, Authentifizierungs- und andere Infrastrukturgrenzen erhalten Testobjekte. Queue-Recovery und Datenbank-Start-Hooks werden nicht ausgeführt. Die Prüfung benötigt keine Datenbankverbindung und erfasst die Importreihenfolge ohne Jest-Modulmocks. Der Nachweis wurde zusätzlich mit dem alten Importkreis in einer temporären Buildkopie geprüft: Fehler an Position 9 vor der Korrektur, erfolgreiche Nest-Instanziierung danach. Das ist eine DI-Startprüfung, kein vollständiger Betriebsstart mit externen Diensten.

Auch nach `npm run build --prefix backend` besteht die Prüfung mit `node backend/dist/api/ai/ai-module.bootstrap-check.js` vom Repository-Stamm aus. Beide neuen TypeScript-Dateien sind in Formatierung, Lint und Typecheck enthalten. Beim Import der aktuellen Providerbibliotheken meldet Node 26 bestehende ExperimentalWarnings zu Web Crypto; diese werden nicht unterdrückt.

Nach der Korrektur antwortete außerdem der laufende lokale Backend-Endpunkt `http://localhost:3000/api/system/state` mit HTTP 200. Alle acht Qualitätsprüfungen wurden nach der Änderung vollständig erneut ausgeführt und bestanden.

| Kommando | Ergebnis |
| --- | --- |
| `npm run format --prefix backend` | erfolgreich |
| `npm run format --prefix frontend` | erfolgreich |
| `npm run type-check:backend` | erfolgreich |
| `npm run type-check:frontend` | erfolgreich |
| `npm run lint --prefix backend -- --max-warnings=0` | keine Fehler/Warnungen |
| `npm run lint --prefix frontend` | keine Fehler/Warnungen |
| `npm run test:backend` | 1.216 Tests erfolgreich; 1 vorhandener Opt-in-Test ausgelassen |
| `npm run test:frontend` | 1.090 Tests erfolgreich, 246 Testdateien; keine unbehandelten Fehler |

Produktions- und Testdateien sind in Formatierung, Lint und Typechecks enthalten. Die neuen Prompt-Testfixtures liegen deshalb innerhalb des geprüften Quellbaums. Der vorhandene PostgreSQL-Rollup-Test benötigt ausdrücklich `SAPLING_TELEMETRY_SQL_TESTS=1` und gehört nicht zum standardmäßig ausgeführten Lauf. Die ergänzten Prüfungen decken insbesondere unveränderte Chatstände, Platzhalter, isolierte Evaluationen, direkte Administratorprüfungen, fehlende Historie, Zustellkorrelation, Webhook-Wiederholungen, parallele Übersetzungsabrufe sowie Kalenderoperationen mit 1/10/50 Vorkommen ab. Bestehende Konflikt-, Rollback- und Sommerzeittests bestehen weiterhin.

## Struktur und noch ausstehende Abnahme

Promptauflösung und Veröffentlichung liegen gemeinsam unter `api/ai/prompts`. Automatisierungsadapter, Inspektionsdienst und Konfigurationslader liegen unter `api/automation`; die zugehörige Oberfläche und Beschriftungslogik unter `components/automation`. Der Regellader wurde aus dem Prozessor herausgelöst, die E-Mail-Wertvergleiche aus dem E-Mail-Automatisierungsdienst. Bestehende öffentliche Service-Einstiegspunkte bleiben erhalten. Neue Gestaltung liegt im eingebundenen Framework-Stylesheet. Die Vue-Quellen enthalten keine Inline-Style-Attribute, Style-Bindungen oder komponentenlokalen Style-Blöcke.

**Die Performance-Abnahme ist noch offen:** 30 % bessere LCP, 50 % schnellere langsame Kalenderfälle und unverändertes API-p95 benötigen den beschriebenen kontrollierten Vorher/Nachher-Lauf. Die Bundleprüfung ersetzt keinen Kaltstartvergleich der einzelnen Seiten. Historische Antwortbytes sind kein Nachweis komprimierten Netzwerkvolumens. Der Build meldet weiterhin bestehende Chunks über 500 kB. Ein angemeldeter manueller UI-Abnahmelauf gegen ein migriertes Testsystem wurde nicht abgeschlossen.

Der Server liest Übersetzungsdaten bei jeder Revalidierung frisch. Damit werden Änderungen auch über Backendinstanzen hinweg sofort sichtbar; der geplante 60-Sekunden-Servercache wurde zugunsten dieser einfacheren Invalidierung weggelassen. Das kostet eine kleine Datenbankprojektion je Bundle-Revalidierung.

Die abschließende lesende Kontrolle fand Migration `Migration20260908120000` und die neuen Seeder inzwischen auch in der konfigurierten lokalen Datenbank: Ausführung laut Datenbank am 08.09.2026 um 11:17 Uhr Europe/Berlin. Dieser lokale Stand hat sich während der Arbeit verändert; die eigenen Migrationsprüfungen liefen auf separaten Testdatenbanken. Der aktuelle deutsche Katalog enthält dadurch 6.103 Schlüssel in 227 Namensräumen: erneut vollständig geprüft, 3 Bundles statt 239 paginierter Abrufe, 268.779 JSON-Bytes. Die ursprünglichen 5.947 Schlüssel oben beschreiben den früheren Messstand. Es wurde kein Produktionsdeployment ausgeführt.

Für weitere Zielsysteme sind Migration und Seeder über den normalen Deploymentablauf auszuführen. Offen bleiben der angemeldete UI-Abnahmelauf und die kontrollierten Lastmessungen mit identischem Datenstand und deaktivierten externen Sendungen.

## Größenprüfung und Ausnahmen

Der 600-Zeilen-Richtwert wurde repositoryweit geprüft. Neue Module bleiben darunter. Die folgende Liste dokumentiert verbleibende Ausnahmen; ein flächiger Umbau unveränderter Kalender-, Formular- und Kontomodule gehört nicht zum freigegebenen Funktionsumfang. Die ausgelagerten E-Mail-Wertvergleiche und Regelabfragen reduzieren die bearbeiteten Dienste, ohne deren öffentlichen Vertrag zu verändern.

| Datei | Physische Zeilen | Begründung |
| --- | ---: | --- |
| [frontend/src/constants/mdi.icons.ts](../../frontend/src/constants/mdi.icons.ts) | 21386 | Generierter Iconkatalog; außerhalb der Regel für gepflegte Implementierungen. |
| [backend/src/database/migration/Migration20260708104812.ts](../../backend/src/database/migration/Migration20260708104812.ts) | 2761 | Bereits ausgeführte, zusammengehörige Schemarevision. Gemäß Projektvorgabe nicht nachträglich aufteilen oder verändern. |
| [backend/src/entity/CompanyItem.ts](../../backend/src/entity/CompanyItem.ts) | 902 | Eine vollständige ORM-Entitätsdeklaration einschließlich zusammengehöriger Sapling-Feldmetadaten. Eine künstliche Aufteilung von Property-Dekoratoren würde die Metadatenerkennung und Zuordnung erschweren. |
| [backend/src/entity/TicketItem.ts](../../backend/src/entity/TicketItem.ts) | 896 | Eine vollständige ORM-Entitätsdeklaration einschließlich zusammengehöriger Sapling-Feldmetadaten. Eine künstliche Aufteilung von Property-Dekoratoren würde die Metadatenerkennung und Zuordnung erschweren. |
| [frontend/src/composables/dialog/useSaplingDialogMailEditor.ts](../../frontend/src/composables/dialog/useSaplingDialogMailEditor.ts) | 853 | Gemeinsamer reaktiver Zustand für Empfänger, Signatur, Anhänge und Speichern eines Mailentwurfs. Eine weitere Aufteilung ist ein eigenständiger Editorumbau außerhalb dieses Pakets. |
| [backend/src/calendar/azure/azure-calendar.operations.ts](../../backend/src/calendar/azure/azure-calendar.operations.ts) | 851 | Zusammengehöriger Azure-Synchronisationsablauf mit gemeinsamem Provider-/Tokenkontext. Die neue Ablaufprüfung wurde separat in azure-token-expiry extrahiert; das bestehende Synchronisationsprotokoll bleibt zusammen. |
| [backend/src/entity/PersonItem.ts](../../backend/src/entity/PersonItem.ts) | 807 | Eine vollständige ORM-Entitätsdeklaration einschließlich zusammengehöriger Sapling-Feldmetadaten. Eine künstliche Aufteilung von Property-Dekoratoren würde die Metadatenerkennung und Zuordnung erschweren. |
| [backend/src/calendar/azure/azure.calendar.service.spec.ts](../../backend/src/calendar/azure/azure.calendar.service.spec.ts) | 765 | Zusammenhängende Vertragstests der Azure-Synchronisation mit gemeinsamem Graph-/Kalenderfixture; unverändert belassen. |
| [backend/src/entity/EventItem.ts](../../backend/src/entity/EventItem.ts) | 761 | Eine vollständige ORM-Entitätsdeklaration einschließlich zusammengehöriger Sapling-Feldmetadaten. Eine künstliche Aufteilung von Property-Dekoratoren würde die Metadatenerkennung und Zuordnung erschweren. |
| [backend/src/calendar/calendar.recurrence.ts](../../backend/src/calendar/calendar.recurrence.ts) | 749 | Gemeinsame Kalenderarithmetik für Expansion, Ausnahmen, Zeitzonen und Sommerzeit. Das Performancepaket nutzt diese getesteten Regeln unverändert. |
| [backend/src/calendar/google/google-calendar.operations.ts](../../backend/src/calendar/google/google-calendar.operations.ts) | 739 | Zusammenhängendes Google-Synchronisationsprotokoll mit gemeinsamem Providerkontext; unverändert belassen. |
| [frontend/src/components/event/SaplingEventToolbar.vue](../../frontend/src/components/event/SaplingEventToolbar.vue) | 718 | Gemeinsame Kalendernavigation und Auswahl-/Batchsteuerung einer Toolbar; kein Teil des geänderten Metadaten- und Messpfads. |
| [backend/src/entity/SalesOpportunityItem.ts](../../backend/src/entity/SalesOpportunityItem.ts) | 711 | Eine vollständige ORM-Entitätsdeklaration einschließlich zusammengehöriger Sapling-Feldmetadaten. Eine künstliche Aufteilung von Property-Dekoratoren würde die Metadatenerkennung und Zuordnung erschweren. |
| [backend/src/api/generic/generic.service.ts](../../backend/src/api/generic/generic.service.ts) | 703 | Bestehende öffentliche Nest-Fassade für generische Operationen; die tatsächlichen Mutationen und das neue Metadatensharing liegen in eigenen Diensten. |
| [frontend/src/components/dialog/fields/__tests__/SaplingFieldSingleSelect.test.ts](../../frontend/src/components/dialog/fields/__tests__/SaplingFieldSingleSelect.test.ts) | 697 | Gemeinsame Verhaltensmatrix des Einzelreferenzfelds mit identischer Mount-/API-Konfiguration; unverändert belassen. |
| [backend/src/entity/global/entity.decorator.ts](../../backend/src/entity/global/entity.decorator.ts) | 667 | Zentrale Dekoratortypen und Registrierung bilden einen zusammengehörigen Metadatenvertrag; unverändert belassen. |
| [frontend/src/components/dialog/fields/SaplingFieldSingleSelect.vue](../../frontend/src/components/dialog/fields/SaplingFieldSingleSelect.vue) | 633 | Zusammengehöriger Auswahl-, Such- und Referenzzustand des dynamischen Einzelreferenzfelds; unverändert belassen. |
| [frontend/src/composables/dialog/__tests__/useSaplingDialogEdit.test.ts](../../frontend/src/composables/dialog/__tests__/useSaplingDialogEdit.test.ts) | 629 | Gemeinsame Vertragstests des generischen Bearbeitungsdialogs mit derselben Formular- und Relationsfixture; unverändert belassen. |
| [backend/src/api/webhook/webhook.service.ts](../../backend/src/api/webhook/webhook.service.ts) | 627 | Bestehender öffentlicher Dienst für Abonnementauflösung und Einplanung. Die geänderte Fehlerklassifikation liegt separat im Delivery-Executor. |
| [backend/src/api/automation/automation-processor.service.ts](../../backend/src/api/automation/automation-processor.service.ts) | 618 | Zentrale Reihenfolge, Prioritätsbelegung, Wiederholungssperren und Ereignisverarbeitung benötigen denselben Verarbeitungskontext. Regelabfragen wurden bereits in automation-rule-loader ausgelagert; der verbleibende Ablauf bleibt geschlossen nachvollziehbar. |
| [frontend/src/composables/account/useSaplingInbox.ts](../../frontend/src/composables/account/useSaplingInbox.ts) | 617 | Gemeinsamer reaktiver Inbox-/SSE-Zustand einschließlich Wiederverbindung und Lesestatus; unverändert belassen. |
| [frontend/src/assets/styles/framework/SaplingFrameworkAppearance.css](../../frontend/src/assets/styles/framework/SaplingFrameworkAppearance.css) | 613 | Kanonischer gemeinsamer Ort der vorhandenen Theme- und Appearance-Regeln; keine Aufspaltung in konkurrierende Stylesheets. |
| [frontend/src/composables/event/useSaplingEvent.ts](../../frontend/src/composables/event/useSaplingEvent.ts) | 611 | Gemeinsamer Kalenderbereichs-, Auswahl- und Navigationszustand; vorhandene Bereichsladung bleibt erhalten. |
| [frontend/src/components/dialog/fields/SaplingFieldEmailSubscriptionConditions.vue](../../frontend/src/components/dialog/fields/SaplingFieldEmailSubscriptionConditions.vue) | 608 | Zusammenhängender Editor für die bestehende gruppierte E-Mail-Bedingungsstruktur; der Graph verwendet diese Struktur ohne Editorumbau. |
| [frontend/src/components/dialog/SaplingDialogEditFieldRenderer.vue](../../frontend/src/components/dialog/SaplingDialogEditFieldRenderer.vue) | 604 | Zentrale Auswahl des passenden Feldbausteins anhand eines Metadatenvertrags; die eigentlichen Feldkomponenten sind bereits getrennt. |
| [frontend/src/composables/account/useSaplingAccount.ts](../../frontend/src/composables/account/useSaplingAccount.ts) | 602 | Gemeinsamer Zustand der vorhandenen Kontoeinstellungen und deren Speicherablauf; unverändert belassen. |
| [frontend/src/components/table/SaplingTable.vue](../../frontend/src/components/table/SaplingTable.vue) | 601 | Öffentlicher Kompositionspunkt der generischen Tabelle. Toolbar, Overlays und Logik sind bereits ausgelagert; die zusätzliche Änderung ist die Weitergabe der Automatisierungsaktion. |
| [frontend/src/components/dialog/SaplingDialogEdit.vue](../../frontend/src/components/dialog/SaplingDialogEdit.vue) | 601 | Öffentlicher Kompositionspunkt des generischen Bearbeitungsdialogs; Feldrenderer, Tabs und Speicherlogik sind bereits ausgelagert. |

## Quellumfang

Gemessen mit dem Quality-Gate-Skript und `sloc`, ausschließlich unter `backend/src` und `frontend/src`; Leerzeilen und reine Kommentarzeilen sind nicht enthalten.

| Bereich | Dateien | Quellzeilen |
| --- | ---: | ---: |
| Backend | 968 | 151.340 |
| Frontend | 1.071 | 172.575 |
| Gesamt | 2.039 | 323.915 |
