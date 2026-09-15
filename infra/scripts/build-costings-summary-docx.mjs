/**
 * The costings, as line items.
 *
 * A companion to build-costings-docx.mjs rather than a replacement. That one is
 * the full audit — every workstream with the defect it closed written out, which
 * is what somebody checking the work needs. This one is what somebody checking
 * the money needs: one line per workstream, days to hours to rands, a total, and
 * the outstanding work as a short summary beside it.
 *
 * Every figure comes from costings-data.mjs, the same module both other
 * documents read, so the three cannot disagree with each other or with the
 * repository. Nothing here is written down twice.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import {
  BRANCH,
  BUILT_DAYS,
  BUILT_ON,
  DONE_SHARE,
  HEAD,
  HOURS,
  RATE,
  REMAIN_DAYS,
  REPO,
  n,
  rands,
  remaining,
  workstreams,
} from './costings-data.mjs';

/** The palette, read from the token file the site itself is built from. */
const BRAND = JSON.parse(
  readFileSync(path.join(REPO, 'packages/ui/src/tokens.json'), 'utf8'),
).brand;

const RED = BRAND.red.replace('#', '');
const BLACK = BRAND.black.replace('#', '');
const GREY = '6E6660';
const LINE = 'D6CFC6';
const WASH = 'FCE8EB';
const PAPER = 'F7F5F2';

const FONT = 'Calibri';
const WIDTH = 9700;

/**
 * What is still outstanding, said in a line rather than a paragraph.
 *
 * The full document carries the long version of each of these. A costings sheet
 * is read across a row, so the wording is cut to what changes the number: what
 * is built already, and what it is waiting on.
 */
const NEEDS = {
  'PayFast sandbox and go-live': 'Adapter and checkout journey built. Needs a merchant account, then sandbox failure and retry testing.',
  'GAAP adapter and onboarding': 'Mapping and payload built against no vendor. Needs GAAP’s integration specification and per-store codes.',
  'Uber Direct onboarding': 'Adapter written and tested against a stub. Needs an Uber Direct account.',
  'Persistent database': 'Migration written and checked. Needs a server provisioned and the move made.',
  'Mailgun and Clickatell onboarding': 'Both transports written. Needs accounts, a verified sending domain and deliverability testing.',
  'Privacy policy and legal review': 'Endpoints built and tested. Needs retention periods, consent copy and an information officer.',
  'Production monitoring and rollback': 'Health endpoint and structured logs built. Needs an error-tracking service and a tested rollback.',
  'Deployment, domain, CDN and certificates': 'Container written. Needs a host, a domain, certificates and secrets management.',
  'Food photography integration': 'Twelve items wear a comped image. Needs the commissioned shoot.',
  'Accessibility audit with a person': 'Contrast maths and static scans done. Needs a screen-reader pass on the deployed build.',
};

// --------------------------------------------------------------- helpers ---

const text = (value, over = {}) =>
  new TextRun({ text: String(value), size: 18, color: BLACK, font: FONT, ...over });

const para = (runs, over = {}) =>
  new Paragraph({ spacing: { after: 0 }, children: Array.isArray(runs) ? runs : [runs], ...over });

const cell = (runs, { width, fill, align, bold } = {}) =>
  new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 90, bottom: 90, left: 120, right: 120 },
    verticalAlign: VerticalAlign.TOP,
    ...(fill ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill } } : {}),
    children: [
      para(
        (Array.isArray(runs) ? runs : [runs]).map((run) =>
          typeof run === 'string' ? text(run, bold ? { bold: true } : {}) : run,
        ),
        align ? { alignment: align } : {},
      ),
    ],
  });

const headCell = (label, width, align) =>
  new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: RED },
    children: [
      para(
        text(label.toUpperCase(), {
          bold: true,
          size: 15,
          color: 'FFFFFF',
          characterSpacing: 16,
        }),
        align ? { alignment: align } : {},
      ),
    ],
  });

const RIGHT = AlignmentType.RIGHT;

const heading = (label) =>
  new Paragraph({
    spacing: { before: 360, after: 160 },
    border: { bottom: { style: 'single', size: 12, color: BLACK, space: 4 } },
    children: [text(label, { size: 26, bold: true })],
  });

const body = (value, over = {}) =>
  new Paragraph({
    spacing: { after: 140, line: 276 },
    children: [text(value, { size: 20, ...over })],
  });

// ----------------------------------------------------------------- built ---

/**
 * Numbered order, which the working list is not in.
 *
 * The workstreams are appended as they are done, so the source array runs
 * 1…20, 26, 25, 24… A reader checking a costings sheet is looking for a row,
 * and a column of identifiers that does not ascend is a column nobody can scan.
 */
const built = [...workstreams].sort((a, b) => Number(a[0]) - Number(b[0]));

const builtRows = built.map(([id, title, , days]) =>
  new TableRow({
    children: [
      cell(id, { width: 600, fill: PAPER }),
      cell(title, { width: 5200 }),
      cell(n(days), { width: 900, align: RIGHT }),
      cell(n(HOURS(days)), { width: 1000, align: RIGHT }),
      cell(rands(HOURS(days) * RATE), { width: 2000, align: RIGHT }),
    ],
  }),
);

const builtTable = new Table({
  width: { size: WIDTH, type: WidthType.DXA },
  columnWidths: [600, 5200, 900, 1000, 2000],
  rows: [
    new TableRow({
      tableHeader: true,
      children: [
        headCell('#', 600),
        headCell('Workstream', 5200),
        headCell('Days', 900, RIGHT),
        headCell('Hours', 1000, RIGHT),
        headCell(`At R ${RATE}/hr`, 2000, RIGHT),
      ],
    }),
    ...builtRows,
    new TableRow({
      children: [
        cell('', { width: 600, fill: WASH }),
        cell('Total, work completed', { width: 5200, fill: WASH, bold: true }),
        cell(n(BUILT_DAYS), { width: 900, fill: WASH, align: RIGHT, bold: true }),
        cell(n(HOURS(BUILT_DAYS)), { width: 1000, fill: WASH, align: RIGHT, bold: true }),
        cell(rands(HOURS(BUILT_DAYS) * RATE), {
          width: 2000,
          fill: WASH,
          align: RIGHT,
          bold: true,
        }),
      ],
    }),
  ],
});

// ------------------------------------------------------------- remaining ---

const remainingRows = remaining.map(([name, , days, third]) =>
  new TableRow({
    children: [
      cell(name, { width: 2600, bold: true }),
      cell(NEEDS[name] ?? '', { width: 3400 }),
      cell(n(days), { width: 700, align: RIGHT }),
      cell(rands(HOURS(days) * RATE), { width: 1500, align: RIGHT }),
      cell(text(third, { size: 16, color: GREY }), { width: 1500 }),
    ],
  }),
);

const remainingTable = new Table({
  width: { size: WIDTH, type: WidthType.DXA },
  columnWidths: [2600, 3400, 700, 1500, 1500],
  rows: [
    new TableRow({
      tableHeader: true,
      children: [
        headCell('Workstream', 2600),
        headCell('What it is waiting on', 3400),
        headCell('Days', 700, RIGHT),
        headCell(`At R ${RATE}/hr`, 1500, RIGHT),
        headCell('Third-party cost', 1500),
      ],
    }),
    ...remainingRows,
    new TableRow({
      children: [
        cell('Total, work outstanding', { width: 2600, fill: WASH, bold: true }),
        cell('', { width: 3400, fill: WASH }),
        cell(n(REMAIN_DAYS), { width: 700, fill: WASH, align: RIGHT, bold: true }),
        cell(rands(HOURS(REMAIN_DAYS) * RATE), {
          width: 1500,
          fill: WASH,
          align: RIGHT,
          bold: true,
        }),
        cell(text('Quotes required', { size: 16, bold: true }), { width: 1500, fill: WASH }),
      ],
    }),
  ],
});

// ----------------------------------------------------------------- total ---

const TOTAL_DAYS = BUILT_DAYS + REMAIN_DAYS;

const summaryTable = new Table({
  width: { size: WIDTH, type: WidthType.DXA },
  columnWidths: [4200, 1200, 1500, 2800],
  rows: [
    new TableRow({
      tableHeader: true,
      children: [
        headCell('Scope', 4200),
        headCell('Days', 1200, RIGHT),
        headCell('Hours', 1500, RIGHT),
        headCell(`At R ${RATE}/hr`, 2800, RIGHT),
      ],
    }),
    new TableRow({
      children: [
        cell('Work completed to date', { width: 4200 }),
        cell(n(BUILT_DAYS), { width: 1200, align: RIGHT }),
        cell(n(HOURS(BUILT_DAYS)), { width: 1500, align: RIGHT }),
        cell(rands(HOURS(BUILT_DAYS) * RATE), { width: 2800, align: RIGHT }),
      ],
    }),
    new TableRow({
      children: [
        cell('Work still outstanding', { width: 4200 }),
        cell(n(REMAIN_DAYS), { width: 1200, align: RIGHT }),
        cell(n(HOURS(REMAIN_DAYS)), { width: 1500, align: RIGHT }),
        cell(rands(HOURS(REMAIN_DAYS) * RATE), { width: 2800, align: RIGHT }),
      ],
    }),
    new TableRow({
      children: [
        cell('Total engineering, end to end', { width: 4200, fill: WASH, bold: true }),
        cell(n(TOTAL_DAYS), { width: 1200, fill: WASH, align: RIGHT, bold: true }),
        cell(n(HOURS(TOTAL_DAYS)), { width: 1500, fill: WASH, align: RIGHT, bold: true }),
        cell(rands(HOURS(TOTAL_DAYS) * RATE), {
          width: 2800,
          fill: WASH,
          align: RIGHT,
          bold: true,
        }),
      ],
    }),
  ],
});

// ------------------------------------------------------------- document ---

const doc = new Document({
  creator: 'Magugu Nzimande',
  title: 'bb.q Chicken ordering website — costings',
  description: `Work completed and outstanding, at R ${RATE} an hour.`,
  styles: {
    default: {
      document: { run: { font: FONT, size: 20, color: BLACK } },
    },
  },
  sections: [
    {
      properties: { page: { margin: { top: 1100, right: 1100, bottom: 1100, left: 1100 } } },
      children: [
        new Paragraph({
          spacing: { after: 60 },
          children: [
            text('COSTINGS', {
              size: 16,
              bold: true,
              color: RED,
              characterSpacing: 28,
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 60 },
          children: [text('bb.q Chicken ordering website', { size: 40, bold: true })],
        }),
        new Paragraph({
          spacing: { after: 100 },
          children: [
            text(
              `${BUILT_ON}  ·  Prepared by Magugu Nzimande  ·  Commit ${HEAD} on ${BRANCH}`,
              { size: 18, color: GREY },
            ),
          ],
        }),
        new Paragraph({
          spacing: { after: 260 },
          children: [
            text('Rate applied: ', { size: 18, color: GREY }),
            text(`R ${RATE} per hour`, { size: 18, bold: true }),
            text('  ·  One experienced full-stack developer, eight-hour days.', {
              size: 18,
              color: GREY,
            }),
          ],
        }),

        new Paragraph({
          spacing: { after: 240 },
          border: { left: { style: 'single', size: 18, color: RED, space: 8 } },
          indent: { left: 160 },
          children: [
            text('The effort is measured; the rate is not. ', { size: 19, bold: true }),
            text(
              `Every day below was sized against what the workstream contains and cross-checked against the volume of code in the repository. R ${RATE} an hour is an input to the arithmetic and has not been approved by anyone — change it and every figure moves with it.`,
              { size: 19 },
            ),
          ],
        }),

        heading('1.  Work completed'),
        body(
          `${built.length} workstreams, ${n(BUILT_DAYS)} working days. Days include the design, the tests and the documentation for each item — not coding time with everything else deducted.`,
        ),
        builtTable,

        heading('2.  Work still to be done'),
        body(
          `${remaining.length} workstreams, ${n(REMAIN_DAYS)} working days, and not one of them can start today. Each is waiting on an account, a contract, a specification or a signature; the engineering behind every seam is built and tested against a stand-in. Third-party costs are named rather than priced — those are quotes to obtain, not fees we set.`,
        ),
        remainingTable,

        heading('3.  Summary'),
        summaryTable,
        new Paragraph({
          spacing: { before: 200, after: 140, line: 276 },
          children: [
            text(
              `${DONE_SHARE}% of the engineering is complete. What remains is weighted towards vendor onboarding rather than construction, so its calendar time depends on how quickly accounts, credentials and contracts arrive rather than on how fast anyone writes code.`,
              { size: 20 },
            ),
          ],
        }),
        new Paragraph({
          spacing: { after: 140, line: 276 },
          children: [
            text(
              'No project management, account management, agency overhead, margin or VAT is included. Those are commercial layers that sit on top of these figures.',
              { size: 20, color: GREY },
            ),
          ],
        }),
      ],
    },
  ],
});

const out = path.join(REPO, 'WEBSITE_COSTINGS_SUMMARY.docx');
Packer.toBuffer(doc).then((buffer) => {
  writeFileSync(out, buffer);
  console.log(
    `Wrote ${path.relative(REPO, out)} — ${Math.round(buffer.length / 1024)} kB · ` +
      `${built.length} built rows, ${remaining.length} outstanding rows`,
  );
});
