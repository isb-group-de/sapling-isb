# Sapling Deployment für Ubuntu

Dieser Ordner enthält das lokale, interaktive Deployment für neue Sapling-Systeme. Es benötigt keine GitHub Actions und führt keine Remote-Befehle von einem CI-System aus. Der Quellcode wird über ein frei konfigurierbares Git-Remote bezogen.

Das historische Skript [`../deploy.sh`](../deploy.sh) bleibt ausschließlich für Bestandssysteme erhalten.

Der Installer ist für Neuinstallationen gedacht. Erkennt er unter dem gewählten Zielpfad ein vorhandenes Deployment oder Datenverzeichnis ohne seine eigene Konfiguration, bricht er ab; eine Bestandsmigration muss mit gesichertem Datenbank- und Storage-Backup separat geplant werden.

## Voraussetzungen

- frischer oder dedizierter Ubuntu-Server; getestet ist Ubuntu 26.04 LTS
- amd64 oder arm64
- root- beziehungsweise `sudo`-Zugriff
- öffentliche Domain, die auf den Server zeigt
- ausgehender Zugriff auf Ubuntu-, NodeSource-, Docker-, NPM-, Git- und Zertifikatsdienste
- mindestens 10 GiB freier Speicher; 4 GiB RAM oder zusätzlicher Swap werden empfohlen

## Erstinstallation

Den Ordner von einem Administratorrechner auf den Server kopieren:

```bash
scp -r deploy operator@sapling.example.com:sapling-deploy
ssh operator@sapling.example.com
sudo bash ~/sapling-deploy/setup.sh
```

Der Assistent fragt Domain, Git-Quelle, Datenbank, Redis, TLS, Seed-Datensatz, ersten Administrator und optionale OAuth-Provider ab. Secrets werden verdeckt eingegeben und in Dateien mit eingeschränkten Rechten gespeichert. Die lokale Infrastruktur ist auf PostgreSQL 18 mit pgvector 0.8.6 und Redis 7.4.10 festgelegt.

Das Setup aktualisiert Ubuntu. Wenn `/var/run/reboot-required` angelegt wird, beendet es sich mit Code `20`. Nach dem Neustart denselben Setup-Befehl erneut ausführen; abgeschlossene Systemphasen werden nicht wiederholt.

## Zielstruktur

```text
/var/www/sapling/
├── repository.git
├── current -> releases/<timestamp>-<commit>
├── releases/
└── shared/
    ├── backend/.env
    ├── frontend/.env
    ├── storage/
    ├── log/
    ├── backups/database/
    ├── deployment/
    └── infrastructure/
```

Code-Releases sind unveränderlich. Datenbank, Redis, Uploads, Logs und Konfiguration liegen außerhalb der Releases. `backend/storage` wird je Release auf `shared/storage` verlinkt.

## Betrieb

```bash
sudo saplingctl update
sudo saplingctl update --ref main
sudo saplingctl status
sudo saplingctl doctor
sudo saplingctl backup
sudo saplingctl configure
sudo saplingctl rollback <release-verzeichnis>
```

`update` führt `git fetch` aus und löst Branch, Tag oder Commit auf. Bei unverändertem Commit ist der Lauf ein No-op. Mit `--force` kann derselbe Commit erneut gebaut werden.

Vor jeder Migration ist ein erfolgreicher, komprimierter `pg_dump` zwingend. Danach stoppt das Backend kurz, Migrationen und Seeder laufen, der `current`-Symlink wird atomar gewechselt und PM2 startet das neue Release. Ein fehlerhafter Healthcheck aktiviert wieder den vorherigen Code. Bereits ausgeführte Datenbankmigrationen werden dabei nicht automatisch zurückgenommen.

Standardmäßig bleiben fünf Releases und sieben Datenbank-Backups erhalten. Diese Werte stehen in `/etc/sapling/deployment.conf` als `KEEP_RELEASES` und `KEEP_BACKUPS`.

## TLS

Im Modus `letsencrypt` richtet das Setup Certbot, den Renewal-Timer und einen Nginx-Reload-Hook ein. Prüfung:

```bash
sudo certbot renew --dry-run
```

Im Modus `custom` prüft das Setup Domain, Gültigkeit und Schlüsselpaar und installiert die Dateien geschützt unter `/etc/nginx/ssl/sapling`. Die Erneuerung eines eigenen Zertifikats bleibt Betreiberaufgabe; `saplingctl doctor` warnt 14 Tage vor Ablauf.

## Datenwiederherstellung

`saplingctl rollback` ist ausschließlich ein Code-Rollback. Eine Datenbankwiederherstellung muss bewusst im Wartungsfenster erfolgen. Bei Docker-PostgreSQL muss `pg_restore` im Container ausgeführt beziehungsweise das Backup in den Container gestreamt werden. Vor einer Wiederherstellung zusätzlich den aktuellen Datenbankzustand und `shared/storage` sichern.

## Sicherheitsmodell

- NPM-Build und PM2 laufen als eigener Benutzer `sapling`.
- Der Benutzer `sapling` gehört nicht zur Docker-Gruppe.
- PostgreSQL und Redis werden bei lokaler Installation nur an `127.0.0.1` gebunden.
- UFW öffnet nur den erkannten SSH-Port sowie HTTP und HTTPS.
- Das bekannte Produktions-Seed-Konto wird vor dem ersten Anwendungsstart durch die interaktiv gewählten Admin-Zugangsdaten ersetzt.
- Deployment-Secrets werden nicht in Frontend-Variablen, Git oder normalen Logs gespeichert.

## Statische Prüfung

Auf einem Linux-Entwicklungsrechner:

```bash
bash deploy/tests/static-tests.sh
shellcheck deploy/setup.sh deploy/saplingctl deploy/lib/*.sh deploy/tests/*.sh
```
