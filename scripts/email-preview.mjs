/* Writes every email template to disk so they can be opened in a browser and
   checked against the site, without sending anything to anybody.

     node scripts/email-preview.mjs && open .preview-email/*.html

   Emails are the one surface with no dev server and no hot reload, so the only
   way to iterate on them is to render them. */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const { seatEmail, appEmail } = createRequire(import.meta.url)("../app/email.js");

const OUT = ".preview-email";
mkdirSync(OUT, { recursive: true });

const cases = [
  [
    "seat-founding",
    seatEmail({
      name: "Tejas Gupta", elder_name: "Kamala", seat: 4, tier: "founding",
      seats: 50, free_months: 3, founding: 10, already: false,
    }),
  ],
  [
    "seat-regular",
    seatEmail({
      name: "Priya", elder_name: "Appa", seat: 23, tier: "seat",
      seats: 50, free_months: 3, founding: 10, already: false,
    }),
  ],
  /* The thin case: no name, no elder's name — every sentence still has to read
     like English. This is the one that catches "Hello ," and "Seat is held". */
  [
    "seat-anonymous",
    seatEmail({ seat: 37, tier: "seat", seats: 50, free_months: 3, founding: 10 }),
  ],
  ["app-ios", appEmail({ platform: "ios" })],
  ["app-unknown", appEmail({})],
];

for (const [name, mail] of cases) {
  writeFileSync(join(OUT, `${name}.html`), mail.html);
  writeFileSync(join(OUT, `${name}.txt`), `Subject: ${mail.subject}\n\n${mail.text}`);
  console.log(`  ${name.padEnd(16)} ${mail.subject}`);
}
console.log(`\n${cases.length} templates → ${OUT}/\n`);
