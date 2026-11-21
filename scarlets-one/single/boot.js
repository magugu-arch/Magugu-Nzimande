/*
 * First thing the page runs. Where JavaScript is off (an iPhone's file
 * preview, Android's HTML Viewer) none of this runs and the still preview
 * shows. Where it is on, the page switches to the app, and switches back to
 * the still preview if the app has not started.
 */
(function (doc) {
  'use strict';
  var html = doc.documentElement;
  function meta(name, content) {
    var element = doc.querySelector('meta[name="' + name + '"]');
    if (element) element.setAttribute('content', content);
  }
  var boot = {
    started: false,
    failed: false,
    fallBack: function () {
      if (boot.started || boot.failed) return;
      boot.failed = true;
      html.className = html.className.replace(/\bjs\b/, '').trim();
      meta('viewport', 'width=390');
      meta('color-scheme', 'light');
    },
  };
  window.__SO_BOOT__ = boot;
  html.className = 'js';
  meta('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
  meta('color-scheme', 'light dark');
  window.addEventListener('error', function () {
    boot.fallBack();
  });
  setTimeout(boot.fallBack, 15000);
})(document);
