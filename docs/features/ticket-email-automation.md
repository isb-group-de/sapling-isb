# Ticket-E-Mail-Automatisierung

Für Tickets sind drei automatische E-Mail-Regeln eingerichtet. Alle drei
Regeln senden ihre Nachricht an die Person, die im Ticket als Kundenkontakt
beziehungsweise Ticketbesitzer eingetragen ist.

## 1. Ticketanlage

Beim Anlegen eines neuen Tickets erhält der eingetragene Kundenkontakt eine
Eingangsbestätigung. Darin stehen unter anderem die Ticketnummer, der Titel,
der aktuelle Status und die Priorität.

Die Nachricht wird nur einmal pro Ticket versendet. Ist das Ticket als
„Incognito“ gekennzeichnet, wird keine automatische E-Mail gesendet.

## 2. Ticket in Bearbeitung

Wechselt ein Ticket vom Status „Offen“ in den Status „In Bearbeitung“, erhält
der eingetragene Kundenkontakt eine Zwischenmeldung. Die Nachricht informiert
darüber, dass die Bearbeitung begonnen hat.

Auch diese Nachricht wird nur einmal pro Ticket versendet. Andere
Statuswechsel lösen sie nicht aus. Bei einem als „Incognito“ gekennzeichneten
Ticket wird keine automatische E-Mail gesendet.

## 3. Ticket gelöst

Wechselt ein Ticket vom Status „In Bearbeitung“ in den Status „Geschlossen“,
erhält der eingetragene Kundenkontakt eine Abschlussmeldung. Sie enthält auch
die im Ticket hinterlegte Lösungsbeschreibung.

Die Abschlussmeldung wird ebenfalls nur einmal pro Ticket versendet. Ein
direkter Wechsel von „Offen“ nach „Geschlossen“ löst sie nicht aus. Bei einem
als „Incognito“ gekennzeichneten Ticket wird keine automatische E-Mail
gesendet.

## Warum ein Hersteller eine Nachricht erhalten konnte

Die Regeln unterscheiden nicht selbstständig zwischen Kunde, Hersteller und
Dienstleister. Sie verwenden immer die Person, die im Ticket als
Kundenkontakt beziehungsweise Ticketbesitzer eingetragen ist.

Wurde dort ein Ansprechpartner des Herstellers eingetragen, ging die
automatische Nachricht deshalb an diesen Hersteller. Das war kein zusätzlicher
Versand an alle Beteiligten, sondern eine Folge der Empfängerzuordnung im
Ticket.

## Richtiger Arbeitsablauf

Im Ticket müssen der tatsächliche Kundenkontakt und dessen Kundenfirma als
Ticketbesitzer hinterlegt bleiben.

Ein Hersteller oder Dienstleister wird stattdessen an der Kundenfirma als
Dienstleister hinterlegt. Soll er kontaktiert werden, kann dafür die bei der
Kundenfirma angezeigte Dienstleister-E-Mail-Adresse verwendet werden. Dadurch
bleibt der Kunde Besitzer des Tickets und automatische Statusmeldungen gehen
weiterhin an den richtigen Kundenkontakt.

