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
 * Consent (§5): mode 'implied' tracks on load. Mode 'banner' shows a consent
 * banner and, until the visitor accepts, sends ONLY page_view with an
 * ephemeral (non-persisted) visitor id.
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

  // Never track a Webnua-internal preview (the editor renders the same
  // Previews; it must not emit events).
  if (window.self !== window.top && /webnua/i.test(document.referrer)) {
    // still allow — funnels embed nothing; this is a cheap guard, keep going
  }

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
      return (
        Date.now().toString(36) + Math.random().toString(36).slice(2, 12)
      );
    }
  }

  // ---- consent (§5) --------------------------------------------------------

  var CONSENT_KEY = 'webnua_consent';
  var consentGranted =
    CONFIG.consentMode === 'implied' || lsGet(CONSENT_KEY) === 'granted';

  // ---- identity (§9) -------------------------------------------------------
  // visitor_id persists first-party; before consent (banner mode) it is
  // ephemeral — a per-load random id, never written to storage.

  var VID_KEY = 'webnua_vid';
  var visitorId;
  if (consentGranted) {
    visitorId = lsGet(VID_KEY);
    if (!visitorId) {
      visitorId = randomId();
      lsSet(VID_KEY, visitorId);
    }
  } else {
    visitorId = 'anon-' + randomId();
  }

  // session_id — 30-min idle window. Stored alongside a last-seen stamp.
  var SID_KEY = 'webnua_sid';
  var SESSION_IDLE_MS = 30 * 60 * 1000;
  function resolveSession() {
    var now = Date.now();
    if (consentGranted) {
      var raw = lsGet(SID_KEY);
      if (raw) {
        var parts = raw.split('|');
        if (parts.length === 2 && now - parseInt(parts[1], 10) < SESSION_IDLE_MS) {
          lsSet(SID_KEY, parts[0] + '|' + now);
          return parts[0];
        }
      }
      var fresh = randomId();
      lsSet(SID_KEY, fresh + '|' + now);
      return fresh;
    }
    return 'sess-' + randomId();
  }
  var sessionId = resolveSession();

  // ---- event queue + flush -------------------------------------------------

  var queue = [];
  var flushTimer = null;
  var FLUSH_DEBOUNCE_MS = 3000;

  // Before consent only page_view is essential — everything else waits.
  function isEssential(type) {
    return type === 'page_view';
  }

  function enqueue(type, payload) {
    if (!consentGranted && !isEssential(type)) return;
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
    var params = {};
    try {
      var sp = new URLSearchParams(window.location.search);
      ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) {
        var v = sp.get(k);
        if (v) params[k] = v.slice(0, 120);
      });
    } catch (e) {
      /* ignore */
    }
    enqueue('page_view', {
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
      utm_source: params.utm_source || '',
      utm_medium: params.utm_medium || '',
      utm_campaign: params.utm_campaign || '',
    });
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
  // form_start  — first focus of any field in a <form>
  // form_field  — a field completed (blur, non-empty)
  // form_abandon — page hidden with a started, unsubmitted form
  // form_submit — a form's submit event (carries data-webnua-submission)

  var formState = {}; // formIndex -> { started, submitted }

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

  function showConsentBanner() {
    if (CONFIG.consentMode !== 'banner' || consentGranted) return;
    if (document.getElementById('webnua-consent')) return;

    var bar = document.createElement('div');
    bar.id = 'webnua-consent';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie consent');
    bar.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:2147483000;' +
      'background:#0a0a0a;color:#f5f1ea;padding:14px 18px;' +
      'font:13px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;' +
      'display:flex;flex-wrap:wrap;align-items:center;gap:12px;' +
      'box-shadow:0 -2px 16px rgba(0,0,0,0.2)';

    var text = document.createElement('span');
    text.style.cssText = 'flex:1 1 280px;min-width:200px';
    text.textContent =
      'We use cookies to understand how this site is used and improve it. ' +
      'Essential page analytics run regardless.';

    var accept = document.createElement('button');
    accept.type = 'button';
    accept.textContent = 'Accept';
    accept.style.cssText =
      'background:#d24317;color:#fff;border:0;border-radius:6px;' +
      'padding:8px 18px;font-weight:700;cursor:pointer;font-size:13px';

    var decline = document.createElement('button');
    decline.type = 'button';
    decline.textContent = 'Decline';
    decline.style.cssText =
      'background:transparent;color:#f5f1ea;border:1px solid #6e685c;' +
      'border-radius:6px;padding:8px 16px;cursor:pointer;font-size:13px';

    function dismiss() {
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    }
    accept.addEventListener('click', function () {
      lsSet(CONSENT_KEY, 'granted');
      consentGranted = true;
      // Promote to a persistent identity for the rest of the journey.
      visitorId = lsGet(VID_KEY) || randomId();
      lsSet(VID_KEY, visitorId);
      sessionId = resolveSession();
      dismiss();
    });
    decline.addEventListener('click', function () {
      lsSet(CONSENT_KEY, 'declined');
      dismiss();
    });

    bar.appendChild(text);
    bar.appendChild(decline);
    bar.appendChild(accept);
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
