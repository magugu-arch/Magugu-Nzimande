/*
 * First thing the page runs. Where JavaScript is off (an iPhone's file
 * preview, Android's HTML Viewer) none of this runs and the still preview
 * shows. Where it is on, the page switches to the app, and switches back to
 * the still preview if the app has not started.
 */
(function (doc) {
  'use strict';
  var html = doc.documentElement;
  // An Artifact supplies its own document and viewport: leave those alone.
  var ownsDocument = window.__SO_TARGET__ !== 'artifact';
  function meta(name, content) {
    var element = ownsDocument ? doc.querySelector('meta[name="' + name + '"]') : null;
    if (element) element.setAttribute('content', content);
  }
  function setClass(name, on) {
    var names = html.className ? html.className.split(/\s+/) : [];
    var kept = [];
    for (var i = 0; i < names.length; i += 1) {
      if (names[i] && names[i] !== name) kept.push(names[i]);
    }
    if (on) kept.push(name);
    html.className = kept.join(' ');
  }
  var boot = {
    started: false,
    failed: false,
    setClass: setClass,
    showApp: function () {
      setClass('js', true);
      meta('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
      meta('color-scheme', 'light dark');
    },
    fallBack: function () {
      if (boot.started || boot.failed) return;
      boot.failed = true;
      setClass('js', false);
      meta('viewport', 'width=390');
      meta('color-scheme', 'light');
    },
  };
  window.__SO_BOOT__ = boot;
  boot.showApp();
  window.addEventListener('error', function () {
    boot.fallBack();
  });
  setTimeout(boot.fallBack, 15000);
})(document);
