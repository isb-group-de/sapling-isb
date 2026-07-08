import { Migration } from '@mikro-orm/migrations';

export class Migration20260708123000 extends Migration {
  override up(): void {
    this.addSql(
      `delete from "entity_route_item" where "route" = 'sales-pipeline';`,
    );
    this.addSql(
      `delete from "translation_item" where ("entity" = 'navigation' and "property" = 'salesPipeline') or "entity" = 'salesPipeline';`,
    );
    this.addSql(`
      update "knowledge_article_item"
      set
        "title" = 'Chancen-Board nutzen',
        "summary" = 'Das Chancen-Board visualisiert Verkaufschancen nach Phase und hilft beim Priorisieren der nächsten Vertriebsaktionen.',
        "tags" = 'dokumentation, hilfe, sales, kanban, opportunity',
        "context_key" = 'app.kanban.salesOpportunity',
        "documentation_markdown" = $$## Zweck und Zielgruppe

Das Chancen-Board ist die operative Kanban-Ansicht für Vertriebsrollen, Sales-Leads und Account Manager. Es zeigt Verkaufschancen nach Vertriebsphase und hilft, nächste Schritte, erwarteten Umsatz, Abschlusswahrscheinlichkeit und Verantwortliche schnell zu prüfen.

## Kopfbereich und Kennzahlen

Der Kopfbereich zeigt Anzahl der sichtbaren Spalten, Datensätze, offene Datensätze und aktualisierte Datensätze. Aktualisieren lädt Phasen und Verkaufschancen neu. Datensatz erstellen öffnet den Erstell-Dialog, wenn die Rolle Insert-Rechte für Verkaufschancen besitzt.

## Suche und Umfang

Die Suche filtert Karten nach Opportunity-, Firmen- oder Kontaktinformationen und kann über das Leeren-Symbol zurückgesetzt werden. Die Umschaltung Offen/Alle entscheidet, ob nur offene Phasen und aktive Verkaufschancen oder auch geschlossene Phasen angezeigt werden. Der Filterbereich rechts grenzt das Board nach Personen und Firmen ein.

## Board-Spalten

Jede Spalte steht für eine Opportunity-Phase. Im Spaltenkopf stehen Icon, Farbe, Titel, Beschreibung und Anzahl der enthaltenen Karten. Leere Spalten zeigen einen Leerzustand, damit sichtbar bleibt, dass die Phase existiert, aber aktuell keine passende Verkaufschance enthält.

## Karten

Eine Karte zeigt die wichtigsten Wertfelder der Verkaufschance, darunter Firma, erwarteten Umsatz, Wahrscheinlichkeit, nächsten Schritt, Verantwortlichen und Abschlussdatum. Ein Klick auf die Karte öffnet den generischen Bearbeitungsdialog der Verkaufschance. Dort werden fachliche Werte angepasst, nicht direkt auf der Karte.

## Drag and Drop

Wenn Update-Rechte vorhanden sind, kann eine Karte in eine andere Spalte gezogen werden. Beim Ziehen erscheint eine Vorschau in der Zielspalte. Beim Ablegen wird die konfigurierte Phase der Verkaufschance aktualisiert und Sapling zeigt eine Erfolgsmeldung. Wenn eine Karte gesperrt wirkt oder nicht gezogen werden kann, fehlen meist Update-Rechte. Wenn das Ablegen fehlschlägt, prüfe Phasenlogik, Filter und ob die Verkaufschance nach der Änderung noch sichtbar sein darf.

## Dialoge und Löschlogik

Der Erstell- und Bearbeitungsdialog ist der generische Sapling-Dialog für salesOpportunity. Speichern übernimmt Änderungen, Abbrechen schließt ohne Übernahme, und Löschen folgt der generischen Sicherheitsabfrage, wenn die Rolle Löschrechte besitzt.

## Werte verstehen

Das Board liest Verkaufschancen-Felder wie Phase, erwarteter Umsatz, Wahrscheinlichkeit, Abschlussdatum, Verantwortliche und Verknüpfungen. Ein unplausibler Wert wird im Verkaufschancen-Datensatz korrigiert. Filter, Spaltenumfang und Rollenrechte erklären, warum eine Karte fehlt oder in einer anderen Spalte steht.$$,
        "updated_at" = now()
      where "context_key" = 'app.salesPipeline' or "title" = 'Sales-Pipeline nutzen';
    `);
  }

  override down(): void {}
}
