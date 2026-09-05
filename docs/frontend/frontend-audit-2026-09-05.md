# Frontend-Audit – 5. September 2026

## Ziel und Vorgehen

Visueller Audit der angemeldeten lokalen Sapling-Anwendung im Codex-Browser.
Ziel: höhere Informationsdichte, konsistente Tabellen, Tabs und Dialoge sowie
lesbare Inhalte ohne Verlust bestehender Aktionen. Die Ansichten wurden nach
dem Laden anhand von Screenshots und gerendertem DOM beurteilt. Skeletons und
vorübergehende Ladefehler wurden nicht als fertige Oberfläche gewertet.

Desktop-Prüfungen erfolgten im dunklen und hellen Design; mobile Stichproben bei
390 × 844 CSS-Pixeln. Das ist ein Audit der gemeinsamen Komponenten und der
erreichbaren Arbeitsbereiche, keine vollständige Kombination aller Entitäten,
Rollen, Bildschirmgrößen und möglichen Datenzustände. Es wurden keine fachlichen
Datensätze gespeichert, Rechte geändert, Nachrichten verschickt oder Importe
ausgeführt.

## Umgesetzte Korrekturen

### Nachkontrolle: Schatten und Rahmen (5./6. September)

Die Arbeitszeittabelle aus dem Screenshot wurde im dunklen Design reproduziert.
Die eckigen Flächen an den oberen Rundungen entstanden durch die zusammengesetzten
Sticky-/Backdrop-Ebenen; die zusätzliche innere Rundung verursachte eine zweite,
versetzte Kontur. Die gemeinsame Tabellenhülle besitzt jetzt Hintergrund, Rundung
und explizite Clip-Kontur. Der innere Scrollbereich hat keine eigene Rundung mehr.
Das gilt für generische Sapling-Tabellen und lokale `SaplingDataTable`-Ansichten.

Seiten- und innere Dialogflächen verwenden einen kompakten Schatten passend zum
8-Pixel-Seitenabstand. Die Layoutspalten um die Rechteverwaltungs-Mitglieder,
Kalender-Seitenleiste und d.velop-Tabellen schneiden die Schatten ihrer Kinder
nicht mehr ab. Die jeweiligen Tabellen und Listen behalten ihre Scrollbereiche.
Der eigene große Außenschatten des Formularkonfigurations-Editors wurde angeglichen.

Kanban-Spalten sowie Kanban- und Posteingangskarten erhalten einen kleinen
Schattenabstand am Scrollrand. Bei Karten nutzen auch Hover/Fokus die kompakte
Schattengröße. Dialog-Bodys nutzen einen ausgeglichenen Innenabstand mit negativem
Außenabstand; eingebettete Markdown-Flächen verwenden eine innere Hervorhebung.
Es wurden keine Ereignisbehandlung, Sortierung, Berechtigungen oder Daten verändert.

Erneut nach dem Laden im Codex-Browser kontrolliert: Dashboard, Arbeitszeit/Konto,
Systemmonitor (Übersicht/Nutzung), Rechteverwaltung, Unternehmenstabelle und
Datensatzdialog, Formularkonfiguration, CRM-Cockpit, Kalender, Notizen,
Wissensbereich, Agentenverwaltung (Profil/Versionen), d.velop, Import-Leerzustand,
Kanban, Dateibrowser, Ticket-Arbeitsbereich, Feedbackseite, Posteingang und
Komponentenbibliothek einschließlich Maildialog.
Kanban- und Posteingangskarten wurden zusätzlich mit Tastaturfokus geprüft.
Import und d.velop konnten weiterhin nur mit den vorhandenen Leerzuständen
beurteilt werden.

Die Tabellenbasis wurde zusätzlich im hellen Systemmonitor geprüft. Bei 390 × 844
CSS-Pixeln bleiben Kontodialog, Systemmonitor und Kanban ohne horizontalen Seitenüberlauf;
breite Tabellen behalten ihren eigenen horizontalen Scrollbereich.

Die unten dokumentierte vollständige Test-Suite gehört zum ursprünglichen Audit.
Für die anschließenden CSS-Korrekturen wurden Formatierung, Frontend-Typprüfung,
Produktionsbuild und die Browser-Nachkontrolle verwendet.

### Ursprünglicher Audit

| Bereich               | Befund                                                                      | Änderung                                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nebentabellen         | Unterschiedliche Kopfzeilen, Abstände, Scrollregeln und fehlende Sortierung | Gemeinsame `SaplingDataTable` auf der bestehenden `sapling-table`-Gestaltung; kompakte Zeilen, feste Kopfzeilen, Tastaturbedienung, expliziter Leerzustand |
| Sortierung            | Formatierte Zahlen und Datumswerte müssen fachlich richtig sortiert werden  | Rohwert-Accessor, stabile Sortierung aufwärts/abwärts/Originalreihenfolge; leere Werte bleiben hinten; Originaldaten werden nicht verändert                |
| Systemmonitor         | Eigene Tabellen; nur 20 von 250 geladenen Prüfungen sichtbar                | Alle geladenen Prüfungen scrollbar; gemeinsame Benutzer-, Request-, KI-, Fehler- und Reparaturtabellen                                                     |
| Rechteverwaltung      | Große wiederholte Zusammenfassungen verdrängten die Matrix                  | Kompakte Rollenauswahl und Kennzahlenzeile; gleichmäßige Checkbox-Spalten; ausreichende Breite der Entitätsnamen                                           |
| Feldrechte            | Abweichende Tabelle mit wichtigen Gruppenaktionen                           | Gemeinsame Tabellenfläche, alphabetische Sortierung innerhalb der ursprünglichen Gruppen; Gruppen- und Sammelaktionen erhalten                             |
| Dialoge               | Durchscheinende Hintergrundinhalte, uneinheitlicher Scrollvertrag           | Deckende Theme-Fläche; Kopf und Footer bleiben außerhalb des scrollbar begrenzten Bodys; flexiblere Labels in der Datensatznavigation                      |
| Songbird              | Hintergrundtext störte die Lesbarkeit                                       | Dieselbe deckende Oberfläche bei erhaltener Chat-, Seitenleisten- und Composer-Struktur                                                                    |
| Seitenköpfe           | Große Abstände und identische wiederholte Titel                             | Kompaktere Typografie und Abstände; identische Eyebrow/Titel nicht doppelt; Dashboardaktionen gemeinsam umbrechend                                         |
| Tabs                  | Unterschiedliche Gestaltung der Verwaltungsansichten                        | Gemeinsame Tabklasse in Monitoring, Customer 360 und Agentenarbeitsbereich                                                                                 |
| Dashboard-KPIs        | Überlappende Verlaufspunkte und getrennte Wortteile bei Statistiklabels     | Kleine Punkte mit Beschriftung bei Hover/Fokus; ausreichend breite Statistikzellen; sortierbare KPI-Listen                                                 |
| Formularkonfiguration | Zahlenfelder und ihre Labels zu schmal                                      | Zweispaltiges Feldraster mit breiteren Eingaben und vollständiger Hilfetextzeile                                                                           |
| d.velop               | Hoher vertikaler Aktionsstapel und uneinheitliche Metadatentabellen         | Umbrechende horizontale Aktionsleiste, kompaktere Abstände, drei gemeinsame Tabellen                                                                       |
| Import                | Abgeschnittene Stapelauswahl, auseinandergezogener Leerzustand              | Breitere Toolbarfelder, zusammenhängender Leerzustand, gemeinsame Vorschau- und Zuordnungstabellen                                                         |
| Posteingang           | Überdimensionierte Zusammenfassungskarten und Wortumbrüche                  | Kompakte Kennzahlen mit kleineren Icons und zusammenhängenden Labels                                                                                       |
| Dateien               | Lange Mail-Absender und Empfänger abgeschnitten                             | Umbruchfähige Werte; großer Mailkopf separat begrenzt und scrollbar                                                                                        |
| Kanban                | Lange Spalten- und Kartentitel abgeschnitten                                | Vollständige umbrechende Titel                                                                                                                             |
| Helles Design         | Gelbe und violette Statuslabels schwer lesbar                               | Dunklere Schrift aus derselben Statusfarbe; dunkles Design unverändert                                                                                     |

## Tabelleninventar

18 lokale Tabellen verwenden `SaplingDataTable`:

- Systemmonitor: Requests, Benutzer, KI-Nutzung, Fehler, Systemprüfungen, Reparaturen (6).
- d.velop: Repositorys, Kategorien, Eigenschaften (3).
- Agenten: Versionen und Auswertungen (2).
- Konto: Arbeitszeiten (1).
- Rechte: Entitätsmatrix und Provider-Benutzerimport (2).
- Import: Ergebnisvorschau, CSV-Stichprobe, Wertezuordnung (3).
- KPI-Liste (1).

Die gruppierte Feldrechtematrix nutzt zusätzlich `SaplingTableSurface` und eine
Sortierung innerhalb ihrer Gruppen. Aktions-, Auswahl- und komplexe editierbare
Zielwertspalten bieten bewusst keine inhaltlich sinnlose Sortierung. Die mobile
Kartenansicht der Rechte und Arbeitszeiten bleibt erhalten.

Die generische `SaplingTable` bleibt für Metadaten-CRUD zuständig und behält ihre
Filter, Exporte, Auswahl, Pagination und Datensatzaktionen. Die kleine Ergänzung
übernimmt diese Funktionen nicht künstlich für lokale Aggregate. Die einzige
verbleibende native Tabelle außerhalb der gemeinsamen Fläche ist die strukturelle
Tabellenvorschau der Formularkonfiguration; sie bildet ein Layout statt Datensätze ab.

## Browserabdeckung

| Ansicht                          | Geprüfter Zustand                                                                                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard                        | Geladene Kennzahlen, Listen, Verlauf; kompakter Kopf und Beschriftungen nach Korrektur                                                                                                  |
| Unternehmen und Personen         | Geladene SaplingTable und vorhandene Datensatzdialoge; mobile Unternehmensliste ohne Seitenüberlauf; im mobilen Unternehmensdialog letztes Feld bei sichtbarem Kopf und Footer erreicht |
| Systemmonitor                    | Übersicht, Vorfälle, Nutzung und Leistung; echte Request-Sortierung numerisch geprüft; 250 Prüfungszeilen in begrenztem Scrollbereich                                                   |
| Rechteverwaltung                 | Geladene Rollen, Matrix, Mitglieder, Feldrechte; Sortieren nach Seite und innerhalb der Feldgruppen; mobile Darstellung                                                                 |
| Formularkonfiguration            | Geladene Felder und Live-Vorschau; Zahlenfelder nach Korrektur vollständig lesbar                                                                                                       |
| CRM-Arbeitsbereich               | Sales- und Account-Cockpit, bestehender Kunde in Customer 360 einschließlich vollständig geladenem Service-Tab                                                                          |
| Kalender                         | Geladene Arbeitswoche mit Terminen                                                                                                                                                      |
| Notizen                          | Bestehende Karten und Bearbeitungsdialog; ohne Speichern geschlossen                                                                                                                    |
| Wissensbasis                     | Artikelliste und vollständig geladener Dokumentationsartikel                                                                                                                            |
| KI-Agenten                       | Agentenliste, Profil, Versionstabelle                                                                                                                                                   |
| d.velop                          | Tatsächlicher Leerzustand ohne Verbindung; alle drei Tabellen und Aktionsleiste                                                                                                         |
| Import                           | Tatsächlicher Zustand ohne Datei/Stapel; vollständig lesbare Toolbar und Leerzustände                                                                                                   |
| Issue-Ansicht                    | Geladene Issue-Zähler und Erfassungsformular; keine Übermittlung                                                                                                                        |
| Komponenten-Playground           | Felder, Tabellen, KPI-Demos und Maildialog mit langem Body                                                                                                                              |
| Konto                            | Profil, Arbeitszeiten, Design/Sprache; Scrollen zu unteren Profilfeldern bei sichtbarem Kopf und Footer; mobile Stichprobe                                                              |
| Dateien                          | Geladene Dateiliste und bestehende E-Mail-Vorschau; Mailkopf nach Korrektur ohne horizontalen Textüberlauf                                                                              |
| Partner-Tickets                  | Geladene Tabelle mit Filterseitenleiste; Statuskontrast im hellen Design nach Korrektur                                                                                                 |
| Kanban                           | Geladene Spalten und Karten; lange Titel                                                                                                                                                |
| Posteingang und Meldungszentrale | Geladene offene Aufgaben und Zusammenfassungen sowie tatsächlicher Meldungs-Leerzustand                                                                                                 |
| Songbird                         | Geladene Chatoberfläche ohne konfigurierten Provider; deckende Oberfläche nach Korrektur                                                                                                |

Einschränkungen: Keine befüllten d.velop-/Provider-Importdaten, keine ausgeführte
CSV-Verarbeitung und kein laufender KI-Chat verfügbar. Die entsprechenden
Komponenten wurden zusätzlich im Code geprüft. Nicht jede Entität, jedes
Dialoguntermenü oder jeder Fehlerzustand wurde einzeln im Browser aufgerufen.
Ein vorübergehender Monitoring-Ladefehler verschwand nach Neuladen; die endgültige
Bewertung erfolgte mit echten geladenen Daten. Eine historische ResizeObserver-
Meldung und lokale Performance-Telemetrie sind keine belastbare Produktionsmessung.
Zum Abschluss wurden die ursprüngliche dunkle Darstellung und die normale
Desktopgröße wiederhergestellt; der Browser zeigt den geladenen Systemmonitor.

## Struktur und Styling

Monitoring-Nutzung und Formatierer liegen als zusammenhängende Module beim
Systemmonitor; die Arbeitszeitdarstellung liegt beim Konto. Beide früher über
600 Zeilen großen Elternkomponenten sind dadurch kleiner. Arbeitszeitstile wurden
aus dem Dialogstylesheet in eine eigene zentral importierte Framework-Datei
verschoben. Die obsolete d.velop-Leerzeilenkomponente wurde entfernt.

Der einzige gefundene lokale Vue-Styleblock (Automationsregeln) wurde in das
Framework übernommen. Die abschließende Suche nach `<style>`, `:style=` und
statischen `style=`-Attributen in Vue-Komponenten ergibt keine Treffer. Dynamische
Darstellung über die etablierte `v-css-vars`-Direktive bleibt erhalten. Entfernte
Sonderregeln, Importe und die alte d.velop-Leerzeile wurden auf Verwendungen geprüft.

## Verifikation

Der vollständige finale Lauf wurde nach der letzten Codebereinigung in dieser
Reihenfolge ausgeführt. Alle acht Kommandos endeten mit Exitcode 0.

| Prüfung               | Kommando                                            | Ergebnis                          |
| --------------------- | --------------------------------------------------- | --------------------------------- |
| Backend-Formatierung  | `npm run format --prefix backend`                   | Bestanden                         |
| Frontend-Formatierung | `npm run format --prefix frontend`                  | Bestanden                         |
| Backend-Typprüfung    | `npm run type-check:backend`                        | Keine Fehler                      |
| Frontend-Typprüfung   | `npm run type-check:frontend`                       | Keine Fehler                      |
| Backend-Lint          | `npm run lint --prefix backend -- --max-warnings=0` | Keine Fehler oder Warnungen       |
| Frontend-Lint         | `npm run lint --prefix frontend`                    | Keine Fehler oder Warnungen       |
| Alle Backend-Tests    | `npm run test:backend`                              | 214 Suiten, 1.044 Tests bestanden |
| Alle Frontend-Tests   | `npm run test:frontend`                             | 216 Dateien, 892 Tests bestanden  |

Produktions- und Testcode sind in Formatierung, Linting und Typprüfung enthalten.
Geprüft wurden die Package-Skripte, TypeScript-Includes, ESLint-Regeln sowie Jest-
und Vitest-Konfigurationen. Die Frontend-Test-Typprüfung läuft über das eigene
`tsconfig.vitest.json`; der Backend-Typecheck schließt Tests nicht aus. Die drei
neuen Tabellen-Regressionsfälle decken numerische/natürliche Sortierung,
Originalreihenfolge, leere Werte, unveränderte Eingabedaten, Aktualisierung,
ARIA-Sortierzustände und nicht sortierbare Aktionsspalten ab.

Die vollständigen Tests liefen mit den benötigten Node-Unterprozessen außerhalb
der eingeschränkten Windows-Prozesssandbox. Ein früherer Sandbox-Lauf hatte
`spawn EPERM` im ORM-Persistenztest beziehungsweise beim Vite-Start geliefert;
der finale Lauf enthält diese Fehler nicht. Erwartete Fehlerprotokolle aus
Mock-Szenarien, Hinweise auf experimentelle Node-WebCrypto-Algorithmen und der
Vitest-Hinweis zur jsdom-Laufzeit sind keine fehlgeschlagenen Tests. Testisolation
und Assertions wurden nicht abgeschwächt.

`git diff --check` ist erfolgreich. Backenddateien, Datenmodell, Berechtigungslogik
und API-Verträge wurden nicht geändert. Die beiden Dokumentationsdateien wurden
zusätzlich mit Prettier formatiert; ihr relativer Audit-Link ist vorhanden.

### Quellumfang

Nach dem Qualitätslauf mit `source-stats.ps1` und `sloc` gemessen, ausschließlich
unter `backend/src` und `frontend/src`. Quellzeilen schließen Leer- und reine
Kommentarzeilen aus; generierte Quellen innerhalb dieser Verzeichnisse sind
entsprechend dem Statistikskript enthalten.

| Bereich  | Analysierte Dateien | Quellzeilen |
| -------- | ------------------: | ----------: |
| Backend  |                 896 |     143.926 |
| Frontend |                 996 |     163.272 |
| Gesamt   |               1.892 |     307.198 |

Für die Statistik wurde ein Cache unter `.tmp/npm-cache` verwendet, da der globale
npm-Cache aus der Sandbox nicht beschreibbar war. Es wurden keine Projektabhängigkeiten
oder Lockdateien dafür geändert.

### Dateigrößen und bewusst unveränderter Bestand

Die geänderten Elternmodule haben jetzt 578 Zeilen (`SaplingSystemMonitoring.vue`),
549 Zeilen (`SaplingAccount.vue`) und 556 Zeilen (`SaplingFrameworkDialogs.css`).
Neue Dateien liegen zwischen 5 und 174 Zeilen. Alle Zeilenzahlen hier sind physische
Zeilen, einschließlich Leerzeilen.

Der Größencheck hat weiterhin folgende vorhandene Dateien über 600 Zeilen gefunden.
Diese sind keine im Rahmen dieses Audits neu eingeführten Überschreitungen. Eine
vollständige strukturelle Bereinigung des gesamten Repositories wurde zugunsten des
ausdrücklich visuellen Auftrags und des Erhalts der Funktionalität nicht vorgenommen.
Die Tabelle dokumentiert den verbleibenden Bestand; sie erklärt nicht alle Dateien
pauschal zu dauerhaften Ausnahmen von der Größenrichtlinie.

| Datei                                                                               | Zeilen | Einordnung / Grund für unveränderten Stand                                                                        |
| ----------------------------------------------------------------------------------- | -----: | ----------------------------------------------------------------------------------------------------------------- |
| `frontend/src/constants/mdi.icons.ts`                                               |  21386 | Generierter Iconkatalog; Generierungskompatibilität erhalten                                                      |
| `backend/src/database/migration/Migration20260708104812.ts`                         |   2761 | Bestehende ausgeführte Migration; nicht nachträglich umstrukturieren                                              |
| `backend/src/entity/CompanyItem.ts`                                                 |    902 | Zusammengehörige Entitäts- und Feldmetadaten; keine Änderung des Datenmodells im visuellen Audit                  |
| `backend/src/entity/TicketItem.ts`                                                  |    896 | Ticket-Metadaten und Dekoratoren; Modelländerungen außerhalb dieses Auftrags                                      |
| `backend/src/calendar/azure/azure-calendar.operations.ts`                           |    819 | Kalender-Synchronisationsabläufe; Zerlegung benötigt gesonderte Integrationsprüfung                               |
| `backend/src/entity/PersonItem.ts`                                                  |    793 | Personen-Metadaten; generische Formular- und Rechteverträge erhalten                                              |
| `backend/src/calendar/azure/azure.calendar.service.spec.ts`                         |    765 | Bestehende Azure-Synchronisationstests vollständig erhalten                                                       |
| `backend/src/entity/EventItem.ts`                                                   |    761 | Termin-Metadaten und Beziehungen; unverändertes fachliches Modell                                                 |
| `backend/src/calendar/google/google-calendar.operations.ts`                         |    739 | Google-Synchronisationsabläufe; gesonderte Integrationsrefaktorierung erforderlich                                |
| `backend/src/calendar/calendar.recurrence.ts`                                       |    721 | Rekurrenz- und Zeitzonenlogik; keine fachlichen Änderungen zur Layoutkorrektur                                    |
| `backend/src/entity/SalesOpportunityItem.ts`                                        |    711 | Verkaufschancen-Metadaten; Modellverträge erhalten                                                                |
| `backend/src/api/generic/generic.service.ts`                                        |    681 | Zentrale generische CRUD-Orchestrierung; sicherheitsrelevante Grenzen nicht für einen visuellen Audit verschieben |
| `backend/src/api/automation/automation-processor.service.ts`                        |    645 | Automationsausführung; funktionale Refaktorierung separat bewerten                                                |
| `backend/src/entity/global/entity.decorator.ts`                                     |    639 | Zentrale Dekorator- und Registry-Verträge; nicht mit UI-Styling vermischen                                        |
| `frontend/src/components/event/SaplingEventToolbar.vue`                             |    634 | Bestehende Kalenderaktionen und Ansichtssteuerung; keine konkrete Korrektur im Audit nötig                        |
| `backend/src/api/webhook/webhook.service.ts`                                        |    627 | Webhook-Verarbeitung; externe Effekte außerhalb der visuellen Änderung                                            |
| `frontend/src/composables/dialog/__tests__/useSaplingDialogEdit.test.ts`            |    627 | Bestehende umfassende Dialogtests unverändert erhalten                                                            |
| `backend/src/api/mail/email-automation.service.ts`                                  |    609 | Mailautomationsabläufe; Versandverhalten unverändert                                                              |
| `frontend/src/components/dialog/fields/SaplingFieldEmailSubscriptionConditions.vue` |    608 | Zusammengehöriger Bedingungseditor; kein belegter visueller Fehler für eine zusätzliche Zerlegung                 |
| `frontend/src/components/dialog/fields/__tests__/SaplingFieldSingleSelect.test.ts`  |    607 | Bestehende Auswahlfeld-Regressionsfälle erhalten                                                                  |
| `frontend/src/assets/styles/framework/SaplingFrameworkMessageCenter.css`            |    601 | Zusammengehörige Meldungszentrale und responsive Zustände; keine künstliche Aufteilung für eine einzelne Zeile    |
