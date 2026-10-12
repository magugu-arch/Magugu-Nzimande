/* ---------------------------------------------------------------------------
 * Images and file details: what this one file holds, read from the metadata
 * embedded in it, so anyone reviewing the demo can check every image against
 * the manifest — its original filename, size, SHA-256 and where it is used.
 * ------------------------------------------------------------------------- */

function fileMetadata() {
  try {
    var el = document.getElementById('mx-metadata');
    return el ? JSON.parse(el.textContent) : null;
  } catch (err) {
    return null;
  }
}

function kb(bytes) {
  return bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' MB' : Math.round(bytes / 1024) + ' KB';
}

function openFileDetails() {
  var meta = fileMetadata();
  pushScreen({
    title: 'Images and file details',
    render: function (el) {
      if (!meta) {
        $('.scroller', el).innerHTML = emptyState('info', 'No file details', 'This copy of the demo has no embedded metadata.', '');
        return;
      }
      var imgs = meta.images;
      $('.scroller', el).innerHTML =
        '<div class="group-title">This file</div><div class="group">' +
        [
          ['What it is', meta.status],
          ['Version', meta.version + ' · built ' + meta.built],
          ['Source', meta.brief],
          ['Offline', meta.offline],
          [
            'Contents',
            meta.contents.products + ' sample products · ' + meta.contents.stories + ' stories · ' + meta.contents.events + ' sample events · markets ' + meta.contents.markets.join(', '),
          ],
          ['Images', imgs.verified + ' verified concept images' + (imgs.additions ? ' + ' + imgs.additions + ' recorded addition' + (imgs.additions === 1 ? '' : 's') : '') + ', embedded in the file'],
          ['Never used', imgs.excluded.join('; ')],
        ]
          .map(function (r) {
            return '<div class="row no-icon"><span class="row-main"><span class="row-sub" style="display:block">' + esc(r[0]) + '</span><span class="row-title" style="font-weight:500">' + esc(r[1]) + '</span></span></div>';
          })
          .join('') +
        '</div>' +
        '<div class="group-title">Embedded images (' + imgs.items.length + ')</div>' +
        '<div class="asset-list">' +
        imgs.items
          .map(function (a) {
            return (
              '<article class="asset-card" data-asset-card="' +
              esc(a.id) +
              '">' +
              '<button class="card-link asset-thumb" data-action="zoom" data-id="' +
              esc(a.id) +
              '" aria-label="' +
              esc(a.title + '. Opens zoom.') +
              '">' +
              media(a.id, { decorative: true }) +
              '</button><div class="asset-meta"><span class="eyebrow">' +
              esc(a.id) +
              ' · ' +
              esc(a.category) +
              '</span><h3>' +
              esc(a.title) +
              '</h3>' +
              (a.addition ? '<span class="tag warn">' + icon('alert') + 'Addition — confirm approval</span>' : '<span class="tag ok">' + icon('check') + 'Verified manifest</span>') +
              '<dl>' +
              [
                ['Alt text', a.alt],
                ['Original file', a.originalFilename],
                ['Embedded', a.embeddedSize.width + ' × ' + a.embeddedSize.height + ' px · ' + kb(a.bytes)],
                ['Master', a.masterSize.width + ' × ' + a.masterSize.height + ' px'],
                ['Used for', a.placement.join(', ')],
                ['SHA-256', a.sha256],
              ]
                .concat(
                  a.addition
                    ? [
                        ['Supplied by', a.addition.suppliedBy + ' · ' + a.addition.date],
                        ['Purpose', a.addition.purpose],
                        ['Approval', a.addition.approval],
                      ]
                    : [],
                )
                .map(function (r) {
                  return '<dt>' + esc(r[0]) + '</dt><dd' + (r[0] === 'SHA-256' ? ' class="hash"' : '') + '>' + esc(r[1]) + '</dd>';
                })
                .join('') +
              '</dl></div></article>'
            );
          })
          .join('') +
        '</div>' +
        '<p class="note" style="padding:0.75rem calc(var(--gutter) + 0.25rem) 0">Concept assets, not approved product photography or live SKUs. The SHA-256 matches the manifest in the project repository.</p>';
      sweepImages(el);
    },
  });
}
