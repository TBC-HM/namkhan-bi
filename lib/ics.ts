// lib/ics.ts
// Minimal RFC-5545 ICS file generator. One file per activity block.

export interface IcsInput {
  uid: string;
  title: string;
  startUtc: Date;
  endUtc: Date;
  location?: string;
  description?: string;
}

function fmt(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeIcs(s: string): string {
  return (s || '').replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
}

export function buildIcs(opts: IcsInput): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Namkhan BI//Proposal Builder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${opts.uid}@thenamkhan.com`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(opts.startUtc)}`,
    `DTEND:${fmt(opts.endUtc)}`,
    `SUMMARY:${escapeIcs(opts.title)}`,
    opts.location ? `LOCATION:${escapeIcs(opts.location)}` : '',
    opts.description ? `DESCRIPTION:${escapeIcs(opts.description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}
