# Email Template Guide

This file explains what gets filled in automatically when a ticket email is sent.
Edit `emails/ticket.ejs` for the actual HTML — everything else on this page is just
a reference for what each placeholder does.

You do not need to know how to code to change the wording, colours or layout in
`emails/ticket.ejs`. You only need to leave the placeholders below intact.

## Placeholders

| Placeholder             | Auto-filled with                                              |
|-------------------------|---------------------------------------------------------------|
| `<%= name %>`           | Attendee's name from the database                             |
| `<%= email %>`          | Attendee's email from the database                            |
| `<%= idnum %>`          | Their unique ID (also the number encoded in the QR)           |
| `<%= eventName %>`      | From the `EVENT_NAME` environment variable                    |
| `<%= eventDate %>`      | From `EVENT_DATE`. Leave the variable blank to hide the row   |
| `<%= eventLocation %>`  | From `EVENT_LOCATION`. Leave blank to hide the row            |
| `cid:qrcode`            | The generated QR code image (do not edit)                     |
| `cid:logo`              | Club logo (replace the file, keep the cid)                    |

## The two images

**`cid:qrcode` is the actual ticket.** Do not remove that `<img>` tag, and do not
replace it with a normal `https://...` image link. "cid" means the picture travels
inside the email itself, so it still shows up when someone has image loading turned
off and when they have no signal at the door. A hosted link would fail in both
cases and is also the single most common reason ticket emails get marked as spam.

**`cid:logo` is your club logo.** To change it, replace the file at
`public/logo.png` — keep the filename the same. If that file is missing the email
still sends, just without a logo in the header.

## Things that are safe to change

Anything that is not a `<%= ... %>` placeholder or a `cid:` image:

- All the wording
- The colours (the dark teal is `#123638`, the accent is `#256C70`)
- The order of the sections
- The subject line — that one lives in `src/lib/mailer.ts`, not in the .ejs file

## Things to be careful about

- The layout is built out of `<table>` tags on purpose. Email programs, especially
  Outlook, ignore modern layout CSS, so tables are the only thing that renders
  consistently. If you replace them with `<div>`s the ticket will look broken for
  some recipients.
- Styles must stay written inline on each tag (`style="..."`). A `<style>` block at
  the top of the page gets stripped out by several email clients.
- `<%=` escapes special characters, which is what stops a name containing a
  character like `&` or `<` from breaking the layout. Do not change it to `<%-`.

## Previewing a change

There is no preview page. The reliable way to check a change is to send yourself a
real one: open the admin page, search for a test attendee whose email address you
control, and press **Send ticket**. Check it on a phone, since that is where almost
everyone will open it.
