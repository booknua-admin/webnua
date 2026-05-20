/* =============================================================================
 * webnua-track.js — Webnua visitor-engagement tracking script.
 *
 * Auto-injected into the <head> of every PUBLISHED Webnua website page and
 * funnel step by the public renderer. Never loaded in the editor preview or
 * the authed app. Zero dependencies, first-party.
 *
 * Implements reference/visitor-tracking-design.md §4.1 + §5 (consent) + §9
 * (identity / sessions). It batches events and POSTs them to /api/track.
 *
 * Config is read from this script tag's data-attributes:
 *   data-tracking-key   — the per-surface public token
 *   data-surface-kind   — 'website' | 'funnel'
 *   data-page-ref       — the page / funnel-step slug
 *   data-consent-mode   — 'banner' | 'implied'
 *
 * Consent (§5): a bottom-of-screen banner. "Accept all" is the obvious
 * primary action; "Learn more" expands per-category opt-out toggles
 * (Essential / Analytics / Marketing). Mode 'implied' skips the banner and
 * tracks on load. Until the visitor decides, only the essential `page_view`
 * is sent, with an ephemeral (non-persisted) visitor id.
 * ============================================================================= */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Find this script's tag. `document.currentScript` is null for an async /
  // deferred external script, so fall back to the id the renderer sets, then
  // to any tag carrying the tracking-key attribute.
  var script =
    document.getElementById('webnua-track') ||
    document.currentScript ||
    document.querySelector('script[data-tracking-key]');
  if (!script) return;

  var CONFIG = {
    trackingKey: script.getAttribute('data-tracking-key') || '',
    surfaceKind: script.getAttribute('data-surface-kind') || 'website',
    pageRef: script.getAttribute('data-page-ref') || '',
    consentMode: script.getAttribute('data-consent-mode') || 'banner',
    endpoint: script.getAttribute('data-endpoint') || '/api/track',
  };
  if (!CONFIG.trackingKey) return;

  // ---- storage helpers (fail-soft if storage is blocked) -------------------

  function lsGet(k) {
    try {
      return window.localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function lsSet(k, v) {
    try {
      window.localStorage.setItem(k, v);
    } catch (e) {
      /* ignore */
    }
  }

  function randomId() {
    try {
      return crypto.randomUUID().replace(/-/g, '');
    } catch (e) {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    }
  }

  // ---- consent (§5) --------------------------------------------------------
  // Three categories. `essential` is non-optional (the site's own page-view
  // count); `analytics` covers behaviour + performance signals; `marketing`
  // covers campaign attribution (UTM params). State is stored per-category in
  // first-party storage — nothing about consent is sent to Webnua.

  var CONSENT_KEY = 'webnua_consent';
  var CONSENT_VERSION = 1;

  /** Which consent category an event type needs. */
  function categoryFor(type) {
    return type === 'page_view' ? 'essential' : 'analytics';
  }

  function readConsent() {
    if (CONFIG.consentMode === 'implied') {
      return { decided: true, analytics: true, marketing: true };
    }
    var raw = lsGet(CONSENT_KEY);
    if (raw) {
      try {
        var p = JSON.parse(raw);
        if (p && p.v === CONSENT_VERSION) {
          return {
            decided: true,
            analytics: !!p.analytics,
            marketing: !!p.marketing,
          };
        }
      } catch (e) {
        /* fall through to undecided */
      }
    }
    return { decided: false, analytics: false, marketing: false };
  }

  function writeConsent(analytics, marketing) {
    consent = {
      decided: true,
      analytics: !!analytics,
      marketing: !!marketing,
    };
    lsSet(
      CONSENT_KEY,
      JSON.stringify({
        v: CONSENT_VERSION,
        analytics: consent.analytics,
        marketing: consent.marketing,
      }),
    );
  }

  var consent = readConsent();

  // ---- identity (§9) -------------------------------------------------------
  // visitor_id persists first-party ONLY with analytics consent; before that
  // it is ephemeral — a per-load random id, never written to storage.

  var VID_KEY = 'webnua_vid';
  var SID_KEY = 'webnua_sid';
  var SESSION_IDLE_MS = 30 * 60 * 1000;
  var visitorId;
  var sessionId;

  function resolveIdentity() {
    if (consent.analytics) {
      visitorId = lsGet(VID_KEY);
      if (!visitorId) {
        visitorId = randomId();
        lsSet(VID_KEY, visitorId);
      }
      var now = Date.now();
      var raw = lsGet(SID_KEY);
      if (raw) {
        var parts = raw.split('|');
        if (
          parts.length === 2 &&
          now - parseInt(parts[1], 10) < SESSION_IDLE_MS
        ) {
          sessionId = parts[0];
          lsSet(SID_KEY, sessionId + '|' + now);
          return;
        }
      }
      sessionId = randomId();
      lsSet(SID_KEY, sessionId + '|' + now);
    } else {
      visitorId = 'anon-' + randomId();
      sessionId = 'sess-' + randomId();
    }
  }
  resolveIdentity();

  // ---- event queue + flush -------------------------------------------------

  var queue = [];
  var flushTimer = null;
  var FLUSH_DEBOUNCE_MS = 3000;

  function enqueue(type, payload) {
    if (categoryFor(type) !== 'essential' && !consent.analytics) return;
    queue.push({
      type: type,
      pageRef: CONFIG.pageRef,
      visitorId: visitorId,
      sessionId: sessionId,
      occurredAt: Date.now(),
      payload: payload || {},
    });
    if (queue.length >= 20) {
      flush(false);
    } else {
      scheduleFlush();
    }
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = window.setTimeout(function () {
      flushTimer = null;
      flush(false);
    }, FLUSH_DEBOUNCE_MS);
  }

  function flush(useBeacon) {
    if (queue.length === 0) return;
    if (flushTimer) {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }
    var batch = queue.splice(0, 80);
    var body = JSON.stringify({
      trackingKey: CONFIG.trackingKey,
      events: batch,
    });
    if (useBeacon && navigator.sendBeacon) {
      try {
        navigator.sendBeacon(
          CONFIG.endpoint,
          new Blob([body], { type: 'application/json' }),
        );
        return;
      } catch (e) {
        /* fall through to fetch */
      }
    }
    try {
      fetch(CONFIG.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body,
        keepalive: true,
      }).catch(function () {
        /* fire-and-forget */
      });
    } catch (e) {
      /* ignore */
    }
  }

  // ---- page view -----------------------------------------------------------

  function trackPageView() {
    var payload = {
      surfaceKind: CONFIG.surfaceKind,
      referrer: (document.referrer || '').slice(0, 300),
      path: window.location.pathname,
      viewportWidth: window.innerWidth || 0,
      device:
        window.innerWidth < 640
          ? 'mobile'
          : window.innerWidth < 1024
            ? 'tablet'
            : 'desktop',
    };
    // UTM attribution is the `marketing` category — only captured on consent.
    if (consent.marketing) {
      try {
        var sp = new URLSearchParams(window.location.search);
        ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) {
          var v = sp.get(k);
          if (v) payload[k] = v.slice(0, 120);
        });
      } catch (e) {
        /* ignore */
      }
    }
    enqueue('page_view', payload);
  }

  // ---- scroll depth --------------------------------------------------------

  var SCROLL_THRESHOLDS = [25, 50, 75, 90];
  var scrollFired = {};
  function onScroll() {
    var doc = document.documentElement;
    var scrollable = doc.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return;
    var pct = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
    for (var i = 0; i < SCROLL_THRESHOLDS.length; i++) {
      var t = SCROLL_THRESHOLDS[i];
      if (pct >= t && !scrollFired[t]) {
        scrollFired[t] = true;
        enqueue('scroll_depth', { depth: t });
      }
    }
  }

  // ---- element clicks ------------------------------------------------------

  function onClick(e) {
    var el = e.target;
    var hops = 0;
    while (el && el !== document.body && hops < 4) {
      var tag = (el.tagName || '').toLowerCase();
      if (tag === 'a' || tag === 'button' || el.getAttribute('role') === 'button') {
        var label = (el.innerText || el.textContent || '').trim().slice(0, 120);
        enqueue('element_click', {
          label: label,
          href: el.getAttribute('href') || '',
          tag: tag,
        });
        return;
      }
      el = el.parentElement;
      hops++;
    }
  }

  // ---- forms ---------------------------------------------------------------
  // form_start         — first focus of any field in a <form>
  // form_field         — a field completed (blur, non-empty)
  // form_abandon       — page hidden with a started, unsubmitted form
  // form_submit        — a form's submit event (carries data-webnua-submission).
  //                      Fires in the capture phase the moment a submit is
  //                      attempted — this is "submit attempted", NOT "submit
  //                      succeeded". For non-controlled HTML forms this is the
  //                      only signal we can offer.
  // form_submit_error  — React-mediated forms (FormBlock) call
  //                      `window.webnuaTrack.formSubmitError(formEl, payload)`
  //                      after the API rejects. Pairs with form_submit so the
  //                      operator can read successful = submit − error.

  var formState = {}; // formIndex -> { started, submitted, abandoned }

  function formIndexOf(formEl) {
    var forms = document.querySelectorAll('form');
    for (var i = 0; i < forms.length; i++) {
      if (forms[i] === formEl) return i;
    }
    return -1;
  }

  function onFocusIn(e) {
    var field = e.target;
    if (!field || !field.form) return;
    var idx = formIndexOf(field.form);
    if (idx < 0) return;
    if (!formState[idx]) formState[idx] = { started: false, submitted: false };
    if (!formState[idx].started) {
      formState[idx].started = true;
      enqueue('form_start', { formIndex: idx });
    }
  }

  function onFocusOut(e) {
    var field = e.target;
    if (!field || !field.form) return;
    var tag = (field.tagName || '').toLowerCase();
    if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') return;
    if (!field.value || !String(field.value).trim()) return;
    var idx = formIndexOf(field.form);
    if (idx < 0) return;
    enqueue('form_field', {
      formIndex: idx,
      field: (field.name || field.getAttribute('id') || tag).slice(0, 80),
    });
  }

  function onSubmit(e) {
    var formEl = e.target;
    if (!formEl || (formEl.tagName || '').toLowerCase() !== 'form') return;
    var idx = formIndexOf(formEl);
    if (idx < 0) return;
    if (!formState[idx]) formState[idx] = { started: true, submitted: false };
    formState[idx].submitted = true;
    enqueue('form_submit', {
      formIndex: idx,
      submissionId: formEl.getAttribute('data-webnua-submission') || '',
    });
  }

  function flushAbandons() {
    var idxs = Object.keys(formState);
    for (var i = 0; i < idxs.length; i++) {
      var s = formState[idxs[i]];
      if (s && s.started && !s.submitted && !s.abandoned) {
        s.abandoned = true;
        enqueue('form_abandon', { formIndex: parseInt(idxs[i], 10) });
      }
    }
  }

  // ---- programmatic API ----------------------------------------------------
  // Exposed on `window.webnuaTrack` for React-mediated forms (FormBlock) that
  // know the API outcome the capture-phase `onSubmit` listener never can.
  // Stable surface — additions are non-breaking; renames need a deprecation.

  function formSubmitError(formEl, info) {
    if (!formEl || (formEl.tagName || '').toLowerCase() !== 'form') return;
    var idx = formIndexOf(formEl);
    if (idx < 0) return;
    var payload = {
      formIndex: idx,
      submissionId:
        (formEl.getAttribute('data-webnua-submission') || '').slice(0, 80),
    };
    if (info && typeof info.reason === 'string') {
      payload.reason = info.reason.slice(0, 200);
    }
    if (info && typeof info.status === 'number') {
      payload.status = info.status;
    }
    enqueue('form_submit_error', payload);
    // The capture-phase onSubmit already flipped `submitted = true` so the
    // abandon flush won't re-fire. Leave that — the visitor DID attempt to
    // submit; the divergence between submit + error counts IS the signal.
  }

  // ---- web vitals (§1.1) ---------------------------------------------------

  function trackVitals() {
    if (typeof PerformanceObserver === 'undefined') return;

    // LCP — keep the latest, report on hide.
    var lcp = 0;
    try {
      var lcpObs = new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        var last = entries[entries.length - 1];
        if (last) lcp = last.renderTime || last.loadTime || last.startTime || 0;
      });
      lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      /* unsupported */
    }

    // CLS — accumulate layout-shift without recent input.
    var cls = 0;
    try {
      var clsObs = new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          if (!entry.hadRecentInput) cls += entry.value || 0;
        });
      });
      clsObs.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      /* unsupported */
    }

    // INP — worst interaction latency (approx; longest `event` duration).
    var inp = 0;
    try {
      var inpObs = new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          if (entry.duration > inp) inp = entry.duration;
        });
      });
      inpObs.observe({ type: 'event', buffered: true, durationThreshold: 40 });
    } catch (e) {
      /* unsupported */
    }

    function reportVitals() {
      if (lcp > 0) enqueue('web_vital', { name: 'LCP', value: Math.round(lcp) });
      if (cls > 0)
        enqueue('web_vital', { name: 'CLS', value: Math.round(cls * 1000) / 1000 });
      if (inp > 0) enqueue('web_vital', { name: 'INP', value: Math.round(inp) });
    }
    // Report once, on the first hide.
    var reported = false;
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden' && !reported) {
        reported = true;
        reportVitals();
      }
    });
  }

  // ---- consent banner (§5) -------------------------------------------------
  // A bottom-of-screen "Powered by Webnua" banner. Compact state: a one-line
  // summary + "Learn more" (secondary) + "Accept all" (primary, the obvious
  // option). "Learn more" expands per-category opt-out toggles. The category
  // descriptions ARE the cookie/tracking policy — they describe exactly what
  // this (single, identical-for-every-client) script instruments.

  var CONSENT_CATEGORIES = [
    {
      id: 'essential',
      name: 'Essential',
      locked: true,
      desc:
        'Required for the site to work, plus a basic anonymous page-view ' +
        'count. Always on.',
    },
    {
      id: 'analytics',
      name: 'Analytics',
      locked: false,
      desc:
        'How visitors scroll, click and use forms, plus page-speed ' +
        '(performance) measurements. Helps improve the site.',
    },
    {
      id: 'marketing',
      name: 'Marketing',
      locked: false,
      desc:
        'Campaign attribution — which ad or link brought you here ' +
        '(UTM tags). No advertising profiles, no third parties.',
    },
  ];

  function applyConsentChange() {
    // A fresh decision can promote the visitor to a persistent identity.
    resolveIdentity();
    if (consent.analytics) {
      // Behaviour/perf instrumentation only matters once analytics is on —
      // re-run the on-load scroll check so an already-scrolled page counts.
      onScroll();
    }
  }

  function showConsentBanner() {
    if (CONFIG.consentMode !== 'banner' || consent.decided) return;
    if (document.getElementById('webnua-consent')) return;

    var bar = document.createElement('div');
    bar.id = 'webnua-consent';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie & tracking consent');
    bar.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:2147483000;' +
      'background:#0a0a0a;color:#f5f1ea;' +
      'font:13px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;' +
      'box-shadow:0 -2px 24px rgba(0,0,0,0.28);box-sizing:border-box';

    function btn(label, primary) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = primary
        ? 'background:#d24317;color:#fff;border:0;border-radius:7px;' +
          'padding:9px 20px;font-weight:700;cursor:pointer;font-size:13px;' +
          'white-space:nowrap'
        : 'background:transparent;color:#f5f1ea;border:1px solid #6e685c;' +
          'border-radius:7px;padding:9px 16px;cursor:pointer;font-size:13px;' +
          'white-space:nowrap';
      return b;
    }

    function dismiss() {
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    }

    var brand =
      '<span style="font:11px/1 JetBrains Mono,ui-monospace,monospace;' +
      'letter-spacing:0.12em;text-transform:uppercase;color:#e8743b">' +
      'Powered by Webnua</span>';

    // -- compact view --------------------------------------------------------
    function renderCompact() {
      bar.innerHTML = '';
      var wrap = document.createElement('div');
      wrap.style.cssText =
        'max-width:1100px;margin:0 auto;padding:14px 20px;display:flex;' +
        'flex-wrap:wrap;align-items:center;gap:14px';

      var copy = document.createElement('div');
      copy.style.cssText = 'flex:1 1 320px;min-width:240px';
      copy.innerHTML =
        brand +
        '<div style="margin-top:3px">We use cookies to see how this site ' +
        'is used and to improve it. Accept all, or choose what you share.</div>';

      var actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:10px;align-items:center';
      var learn = btn('Learn more', false);
      var accept = btn('Accept all', true);
      learn.addEventListener('click', renderDetailed);
      accept.addEventListener('click', function () {
        writeConsent(true, true);
        applyConsentChange();
        dismiss();
      });
      actions.appendChild(learn);
      actions.appendChild(accept);

      wrap.appendChild(copy);
      wrap.appendChild(actions);
      bar.appendChild(wrap);
    }

    // -- detailed view (per-category opt-out) --------------------------------
    function renderDetailed() {
      bar.innerHTML = '';
      var wrap = document.createElement('div');
      wrap.style.cssText =
        'max-width:1100px;margin:0 auto;padding:16px 20px;' +
        'max-height:70vh;overflow-y:auto';

      var head = document.createElement('div');
      head.innerHTML =
        brand +
        '<div style="margin-top:3px;font-weight:700;font-size:14px">' +
        'Your tracking choices</div>';
      wrap.appendChild(head);

      var toggles = {};
      CONSENT_CATEGORIES.forEach(function (cat) {
        var row = document.createElement('label');
        row.style.cssText =
          'display:flex;gap:12px;align-items:flex-start;padding:12px 0;' +
          'border-bottom:1px solid #2a2a28;cursor:' +
          (cat.locked ? 'default' : 'pointer');

        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = cat.locked ? true : true; // opt-out model: on by default
        cb.disabled = !!cat.locked;
        cb.style.cssText =
          'margin-top:2px;width:16px;height:16px;accent-color:#d24317;' +
          'flex:0 0 auto';
        toggles[cat.id] = cb;

        var text = document.createElement('div');
        text.innerHTML =
          '<div style="font-weight:700">' +
          cat.name +
          (cat.locked
            ? ' <span style="color:#6e685c;font-weight:400">· always on</span>'
            : '') +
          '</div><div style="color:#c9c0b0;margin-top:2px">' +
          cat.desc +
          '</div>';

        row.appendChild(cb);
        row.appendChild(text);
        wrap.appendChild(row);
      });

      var actions = document.createElement('div');
      actions.style.cssText =
        'display:flex;gap:10px;justify-content:flex-end;' +
        'margin-top:14px;flex-wrap:wrap';
      var save = btn('Save choices', false);
      var acceptAll = btn('Accept all', true);
      save.addEventListener('click', function () {
        writeConsent(toggles.analytics.checked, toggles.marketing.checked);
        applyConsentChange();
        dismiss();
      });
      acceptAll.addEventListener('click', function () {
        writeConsent(true, true);
        applyConsentChange();
        dismiss();
      });
      actions.appendChild(save);
      actions.appendChild(acceptAll);
      wrap.appendChild(actions);

      bar.appendChild(wrap);
    }

    renderCompact();
    (document.body || document.documentElement).appendChild(bar);
  }

  // ---- wire it up ----------------------------------------------------------

  function start() {
    trackPageView();
    trackVitals();
    showConsentBanner();

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    document.addEventListener('click', onClick, true);
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    document.addEventListener('submit', onSubmit, true);

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        flushAbandons();
        flush(true);
      }
    });
    window.addEventListener('pagehide', function () {
      flushAbandons();
      flush(true);
    });
  }

  // Stable programmatic surface — must be assigned before `start()` so React
  // hydration sees it on first render even if `start()` is deferred to
  // DOMContentLoaded.
  window.webnuaTrack = window.webnuaTrack || {};
  window.webnuaTrack.formSubmitError = formSubmitError;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
