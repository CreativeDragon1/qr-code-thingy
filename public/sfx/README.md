# Sound files go here

Two files, these exact names:

- `mogo.mp3` — plays on a successful scan
- `mono.mp3` — plays on any failure (invalid code, not found, already used)

They are not in version control because they are yours to supply. Keep each one
under about a second so it finishes before the next person steps up to the scanner.

If either file is missing the app still works — it just scans silently and logs a
warning to the browser console. Nothing crashes.
