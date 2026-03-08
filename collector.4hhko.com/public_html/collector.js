(function () {
  'use strict';

  const config = {
    endpoint: '',
    sessionEndpoint: '/session.php',
    enableVitals: true,
    enableErrors: true,
    sampleRate: 1.0,
    debug: false,
    respectConsent: false,
    detectBots: true
  };

  let initialized = false;
  let blocked = false;           // Set true if consent/bot/sampling blocks collection
  const customData = {};           // Data set via set()
  let userId = null;             // Data set via identify()
  let sessionId = null;          // Set once by initSession() on init
  const plugins = [];              // Registered plugins
  const reportedErrors = new Set();
  let errorCount = 0;
  const MAX_ERRORS = 50;

  const vitals = {
      lcp: null,
      cls: 0,
      inpEntries: [],
      _observers: [],
      _clsSessionValue: 0,
      _clsSessionEntries: [],
      _clsMaxSession: 0
  };

  let pageShowTime = Date.now();
  let totalVisibleTime = 0;

  const activityLog = [];
  const MAX_ACTIVITY = 500;
  let lastActivityTime = Date.now();
  let idleStart = null;
  const IDLE_THRESHOLD = 2000;
  let mouseMoveThrottle = 0;
  let scrollThrottle = 0;
  const THROTTLE_MS = 100;
  const MAX_QUEUE_SIZE = 50;


  /**
   * Merge properties from src into dst (shallow).
   */
  function merge(dst, src) {
    for (const key of Object.keys(src)) {
      dst[key] = src[key];
    }
    return dst;
  }

  /**
   * Check whether the user has granted analytics consent.
   * Returns false if Global Privacy Control is set or if the
   * analytics_consent cookie is absent or set to 'false'.
   */
  function hasConsent() {
    // Check Global Privacy Control
    if (navigator.globalPrivacyControl) {
      return false;
    }

    // Check consent cookie
    const cookies = document.cookie.split(';');
    for (const c of cookies) {
      const cookie = c.trim();
      if (cookie.indexOf('analytics_consent=') === 0) {
        return cookie.split('=')[1] === 'true';
      }
    }

    // No consent signal â€” default to true (opposite GDPR opt-in model)
    return true;
  }

  /**
   * Detect common bots and automated browsers.
   * Returns true if the visitor appears to be a bot.
   */
  function isBot() {
    // WebDriver flag (Puppeteer, Selenium, Playwright)
    if (navigator.webdriver) return true;

    // Headless browser indicators in user agent
    const ua = navigator.userAgent;
    if (/HeadlessChrome|PhantomJS|Lighthouse/i.test(ua)) return true;

    // Automation framework globals
    if (window._phantom || window.__nightmare || window.callPhantom) return true;

    return false;
  }

  /**
   * Determine whether this session should be sampled.
   * Uses a persistent random value per session so the decision
   * is consistent across page navigations within the same session.
   */
  function isSampled() {
    if (config.sampleRate >= 1.0) return true;
    if (config.sampleRate <= 0) return false;

    const key = '_collector_sample';
    let val = sessionStorage.getItem(key);
    if (val === null) {
      val = Math.random();
      sessionStorage.setItem(key, val);
    } else {
      val = parseFloat(val);
    }
    return val < config.sampleRate;
  }

  /**
   * Return the session ID initialized by initSession().
   */
  function getSessionId() {
    return sessionId;
  }

  /**
   * Fetch the session endpoint to get or create the server-set session cookie.
   * Stores the returned ID in sessionId for all subsequent calls to getSessionId().
   * Falls back to a client-generated ID if the request fails.
   */
  async function initSession() {
    try {
      const res = await fetch(config.sessionEndpoint, { credentials: 'same-origin' });
      const data = await res.json();
      sessionId = data.session;
    } catch (e) {
      sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
  }

  /**
   * Collect network information via the Network Information API.
   */
  function getNetworkInfo() {
    if (!('connection' in navigator)) return {};
    const conn = navigator.connection;
    return {
      effectiveType: conn.effectiveType,
      downlink: conn.downlink,
      rtt: conn.rtt,
      saveData: conn.saveData
    };
  }

  /**
   * Detect whether the browser renders images.
   * Tests with a 1x1 GIF data URI which decodes synchronously.
   */
  function detectImagesEnabled() {
      const flag = document.getElementById('detectImageFlag');
      if (!flag) return null;
      return (flag.complete && flag.naturalWidth > 0);
  }

  /**
   * Detect whether CSS stylesheets are applied by injecting a
   * test rule and reading back the computed style.
   */
  function detectCssEnabled() {
      const style = document.createElement('style');
      const element = document.createElement('div');

      try {
          style.textContent = '._c_detect{visibility:hidden!important};'
          document.body.appendChild(style);
          element.className = '_c_detect';
          document.body.appendChild(element);
          return window.getComputedStyle(element).visibility === 'hidden';
      } catch (e) {
          return false;
      } finally {
          style.parentNode?.removeChild(style);
          element.parentNode?.removeChild(element);
      }
  }

  /**
   * Collect a complete technographic profile.
   */
  function getTechnographics() {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      cookiesEnabled: navigator.cookieEnabled,
      jsEnabled: true,
      imagesEnabled: detectImagesEnabled(),
      cssEnabled: detectCssEnabled(),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      pixelRatio: window.devicePixelRatio,
      cores: navigator.hardwareConcurrency || 0,
      memory: navigator.deviceMemory || 0,
      network: getNetworkInfo(),
      colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  // â”€â”€ Navigation Timing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Extract key milestones from the Navigation Timing API.
   */
    async function getNavigationTiming() {
        return new Promise((resolve) => {
            const observer = new PerformanceObserver((list) => {
              const n = list.getEntries()[0];
              observer.disconnect();
              resolve({
                  pageStartTime:  n.fetchStart,
                  pageEndTime:    n.loadEventEnd,
                  pageLoadTime:   n.loadEventEnd - n.fetchStart,
                  dnsLookup:      n.domainLookupEnd - n.domainLookupStart,
                  tcpConnect:     n.connectEnd - n.connectStart,
                  tlsHandshake:   n.secureConnectionStart > 0 ? n.connectEnd - n.secureConnectionStart : 0,
                  ttfb:           n.responseStart - n.requestStart,
                  download:       n.responseEnd - n.responseStart,
                  domInteractive: n.domInteractive - n.fetchStart,
                  domComplete:    n.domComplete - n.fetchStart,
                  loadEvent:      n.loadEventEnd - n.fetchStart,
                  fetchTime:      n.responseEnd - n.fetchStart,
                  transferSize:   n.transferSize,
                  headerSize:     n.transferSize - n.encodedBodySize,
                  raw:            JSON.parse(JSON.stringify(n))
              });
            });
            observer.observe({ type: 'navigation', buffered: true });
        });
    }

  // â”€â”€ Resource Timing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * NOTE SHOULD BE CALLED AFTER LOAD
   */
  function getResourceSummary() {
    const resources = performance.getEntriesByType('resource');
    const summary = {
      script:         { count: 0, totalSize: 0, totalDuration: 0 },
      link:           { count: 0, totalSize: 0, totalDuration: 0 },
      img:            { count: 0, totalSize: 0, totalDuration: 0 },
      font:           { count: 0, totalSize: 0, totalDuration: 0 },
      fetch:          { count: 0, totalSize: 0, totalDuration: 0 },
      xmlhttprequest: { count: 0, totalSize: 0, totalDuration: 0 },
      other:          { count: 0, totalSize: 0, totalDuration: 0 }
    };
    resources.forEach((r) => {
      const type = summary[r.initiatorType] ? r.initiatorType : 'other';
      summary[type].count++;
      summary[type].totalSize += r.transferSize || 0;
      summary[type].totalDuration += r.duration || 0;
    });
    return { totalResources: resources.length, byType: summary };
  }

  function initWebVitals() {
      // ── Largest Contentful Paint ──────────────────────────────────────────
      // LCP is only finalized on page hide/visibility change, so we force
      // takeRecords() at that point to ensure we capture the last entry.
      try {
          const lcpObs = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              if (entries.length) {
                  vitals.lcp = entries[entries.length - 1].startTime;
              }
          });
          lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
          vitals._observers.push(lcpObs);

          addEventListener('visibilitychange', () => {
              if (document.visibilityState === 'hidden') {
                  lcpObs.takeRecords(); // flush any pending LCP entry
                  lcpObs.disconnect();
              }
          }, { once: true });
      } catch (e) { /* LCP not supported */ }

      // ── Cumulative Layout Shift ───────────────────────────────────────────
      // Implements session windowing per spec:
      //   - New session starts after ≥1s gap, capped at 5s max duration.
      //   - CLS = the largest session window value seen.
      try {
          const SESSION_GAP    = 1000; // ms — gap that ends a session window
          const SESSION_MAX    = 5000; // ms — max duration of one session window

          const clsObs = new PerformanceObserver((list) => {
              list.getEntries().forEach((entry) => {
                  if (entry.hadRecentInput) return;

                  const lastEntry = vitals._clsSessionEntries.at(-1);
                  const sessionStart = vitals._clsSessionEntries[0];

                  const gapExceeded = lastEntry &&
                      (entry.startTime - lastEntry.startTime) > SESSION_GAP;
                  const durationExceeded = sessionStart &&
                      (entry.startTime - sessionStart.startTime) > SESSION_MAX;

                  if (gapExceeded || durationExceeded) {
                      // Commit current session, start a new one
                      vitals._clsSessionValue = 0;
                      vitals._clsSessionEntries = [];
                  }

                  vitals._clsSessionEntries.push(entry);
                  vitals._clsSessionValue += entry.value;

                  if (vitals._clsSessionValue > vitals._clsMaxSession) {
                      vitals._clsMaxSession = vitals._clsSessionValue;
                      vitals.cls = vitals._clsMaxSession;
                  }
              });
          });
          clsObs.observe({ type: 'layout-shift', buffered: true });
          vitals._observers.push(clsObs);
      } catch (e) { /* CLS not supported */ }

      // ── Interaction to Next Paint ─────────────────────────────────────────
      // durationThreshold: 40ms — aligns with INP "needs improvement" boundary
      // and avoids noise from trivially fast events.
      try {
          const inpObs = new PerformanceObserver((list) => {
              list.getEntries().forEach((entry) => {
                  vitals.inpEntries.push(entry.duration);
              });
          });
          inpObs.observe({ type: 'event', buffered: true, durationThreshold: 40 });
          vitals._observers.push(inpObs);
      } catch (e) { /* INP not supported */ }
  }

  // Returns a snapshot of current vitals.
  // INP is the 98th-percentile interaction duration, matching the spec.
  // Call this on visibilitychange:'hidden' or pagehide for the most accurate read.
  function getWebVitals() {
      let inp = null;
      if (vitals.inpEntries.length) {
          const sorted = [...vitals.inpEntries].sort((a, b) => a - b);
          // p98 index: ceil(n * 0.98) - 1, clamped to valid range
          const index = Math.min(
              Math.ceil(sorted.length * 0.98) - 1,
              sorted.length - 1
          );
          inp = sorted[index];
      }
      return { lcp: vitals.lcp, cls: vitals.cls, inp };
  }

  // NOTE INCLUDE IN FINAL CALL
  // Cleanly tear down all observers (useful in SPAs on route change).
  function disconnectWebVitals() {
      vitals._observers.forEach((obs) => obs.disconnect());
      vitals._observers = [];
  }

  // â”€â”€ Error Tracking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Report an error with deduplication and rate limiting.
   */
  function reportError(errorData) {
    if (errorCount >= MAX_ERRORS) return;

    const key = `${errorData.type}:${errorData.message || ''}:${errorData.source || ''}:${errorData.line || ''}`;
    if (reportedErrors.has(key)) return;
    reportedErrors.add(key);
    errorCount++;

    send({
      type: 'error',
      error: errorData,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      session: getSessionId()
    });

    window.dispatchEvent(new CustomEvent('collector:error', {
      detail: { errorData: errorData, count: errorCount }
    }));
  }

  /**
   * Initialize error listeners for JS errors, resource failures,
   * and unhandled promise rejections.
   */
  function initErrorTracking() {
    // JS runtime errors and resource load failures (capture phase)
    window.addEventListener('error', (event) => {
      if (event instanceof ErrorEvent) {
        reportError({
          type: 'js-error',
          message: event.message,
          source: event.filename,
          line: event.lineno,
          column: event.colno,
          stack: event.error ? event.error.stack : '',
          url: window.location.href
        });
      } else {
        const target = event.target;
        if (target && (target.tagName === 'IMG' || target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
          reportError({
            type: 'resource-error',
            tagName: target.tagName,
            src: target.src || target.href || '',
            url: window.location.href
          });
        }
      }
    }, true);

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      reportError({
        type: 'promise-rejection',
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : '',
        url: window.location.href
      });
    });
  }

  // ── Activity Tracking ─────────────────────────────────────────────────────

  /**
   * Push one event into the activity buffer, dropping the oldest
   * if the cap is reached.
   */
  function pushActivity(event) {
    if (activityLog.length >= MAX_ACTIVITY) activityLog.shift();
    activityLog.push(event);
  }

  /**
   * Called on any user interaction. Closes out an idle period if one
   * was in progress, then resets the last-activity timestamp.
   */
  function onActivity() {
    const now = Date.now();
    if (idleStart !== null) {
      const idleDuration = now - lastActivityTime;
      pushActivity({ type: 'idle_start', start: lastActivityTime, duration: idleDuration });
      pushActivity({ type: 'idle_end', end: now, duration: idleDuration });
      idleStart = null;
    }
    lastActivityTime = now;
  }

  /**
   * Drain the activity buffer and send it as a single beacon.
   */
  function flushActivityLog() {
    if (!activityLog.length) return;
    const events = activityLog.splice(0);
    send({
      type: 'activity',
      events: events,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      session: getSessionId()
    });
  }

  /**
   * Attach listeners for mouse, scroll, keyboard, and idle detection.
   */
  function initActivityTracking() {
    // Idle detection: check every 250 ms whether the user has gone quiet
    setInterval(() => {
      const now = Date.now();
      if (idleStart === null && (now - lastActivityTime) >= IDLE_THRESHOLD) {
        idleStart = lastActivityTime + IDLE_THRESHOLD;
      }
    }, 250);

    // Mouse move — throttled to avoid flooding
    window.addEventListener('mousemove', (e) => {
      const now = Date.now();
      if (now - mouseMoveThrottle >= THROTTLE_MS) {
        mouseMoveThrottle = now;
        pushActivity({ type: 'mousemove', x: e.clientX, y: e.clientY, t: now });
      }
      onActivity();
    });

    // Mouse clicks with button info (0=left, 1=middle, 2=right)
    window.addEventListener('mousedown', (e) => {
      pushActivity({ type: 'click', x: e.clientX, y: e.clientY, button: e.button, t: Date.now() });
      onActivity();
    });

    // Scroll position — throttled
    window.addEventListener('scroll', () => {
      const now = Date.now();
      if (now - scrollThrottle >= THROTTLE_MS) {
        scrollThrottle = now;
        pushActivity({ type: 'scroll', x: window.scrollX, y: window.scrollY, t: now });
      }
      onActivity();
    }, { passive: true });

    // Keyboard — record physical key code, not the typed character
    window.addEventListener('keydown', (e) => {
      pushActivity({ type: 'keydown', code: e.code, t: Date.now() });
      onActivity();
    });
    window.addEventListener('keyup', (e) => {
      pushActivity({ type: 'keyup', code: e.code, t: Date.now() });
      onActivity();
    });

    // Periodic flush every 30 s so data isn't lost on long sessions
    setInterval(flushActivityLog, 30000);
  }

  // ── Retry Queue ───────────────────────────────────────────────────────────

  /**
   * Queue a failed payload for retry on the next page load.
   */
  function queueForRetry(payload) {
    try {
      const queue = JSON.parse(sessionStorage.getItem('_collector_retry') || '[]');
      if (queue.length >= MAX_QUEUE_SIZE) return;
      queue.push(payload);
      sessionStorage.setItem('_collector_retry', JSON.stringify(queue));
    } catch (e) { /* sessionStorage unavailable or full */ }
  }

  /**
   * Process any queued retries from previous page loads.
   */
  function processRetryQueue() {
    try {
      const queue = JSON.parse(sessionStorage.getItem('_collector_retry') || '[]');
      if (!queue.length) return;
      sessionStorage.removeItem('_collector_retry');
      queue.forEach((payload) => { send(payload); });
    } catch (e) { /* sessionStorage unavailable */ }
  }

  // â”€â”€ Payload Delivery â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Send a payload to the analytics endpoint.
   * Uses sendBeacon with fetch fallback. Failed sends are queued
   * for retry. In debug mode, logs to console instead.
   */
  function send(payload) {
    // Debug mode: log instead of sending
    if (config.debug) {
      console.log('[Collector] Debug payload:', payload);
      return;
    }
    
    if (!config.endpoint) {
      console.warn('[Collector] No endpoint configured');
      return;
    }

    // Self-measurement
    const markSupported = typeof performance.mark === 'function';
    if (markSupported) {
      performance.mark('collector_send_start');
    }

    const json = JSON.stringify(payload);
    let sent = false;

    // Try sendBeacon first
    if (navigator.sendBeacon) {
      sent = navigator.sendBeacon(
        config.endpoint,
        new Blob([json], { type: 'text/plain' })
      );
    }

    // Fallback to fetch with keepalive
    if (!sent) {
      fetch(config.endpoint, {
        method: 'POST',
        body: json,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true
      }).catch(() => {
        queueForRetry(payload);
      });
    }

    // Self-measurement
    if (markSupported) {
      performance.mark('collector_send_end');
      performance.measure('collector_send', 'collector_send_start', 'collector_send_end');
    }

    // Notify listeners (for test pages)
    window.dispatchEvent(new CustomEvent('collector:beacon', { detail: payload }));
  }

  // â”€â”€ Collect & Send â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Build and send the full pageview payload.
   */
  async function collect(type) {
    let payload = {
      type: type || 'pageview',
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
      enteredAt: new Date(pageShowTime).toISOString(),
      timestamp: new Date().toISOString(),
      session: getSessionId(),
      technographics: getTechnographics(),
      timing: await getNavigationTiming().catch(() => {return {}}),
      resources: getResourceSummary(),
      vitals: getWebVitals(),
      errorCount: errorCount,
      customData: customData
    };

    if (userId) {
      payload.userId = userId;
    }

    // Let plugins augment the payload
    plugins.forEach((plugin) => {
      if (typeof plugin.beforeSend === 'function') {
        const result = plugin.beforeSend(payload);
        if (result === false) return; // Plugin can suppress the beacon
        if (result && typeof result === 'object') {
          payload = result;
        }
      }
    });

    send(payload);

    window.dispatchEvent(new CustomEvent('collector:payload', { detail: payload }));
  }

  // â”€â”€ Time-on-Page Tracking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Handle visibility changes: accumulate visible time and send
   * exit beacons when the page is hidden.
   */
  function initTimeOnPage() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        totalVisibleTime += Date.now() - pageShowTime;

        // Flush any buffered activity before the page unloads
        flushActivityLog();

        // Send exit beacon with time-on-page
        const exitPayload = {
          type: 'page_exit',
          url: window.location.href,
          timeOnPage: totalVisibleTime,
          vitals: getWebVitals(),
          errorCount: errorCount,
          timestamp: new Date().toISOString(),
          session: getSessionId()
        };

        // Let plugins flush on exit
        plugins.forEach((plugin) => {
          if (typeof plugin.onExit === 'function') {
            plugin.onExit(exitPayload);
          }
        });

        send(exitPayload);
      } else {
        // Page became visible again â€” reset the timer
        pageShowTime = Date.now();
      }
    });
  }

  // â”€â”€ Command Queue Processing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Drain the _cq array and replace it with a live proxy.
   */
  function processQueue() {
    const queue = window._cq || [];
    for (const args of queue) {
      const method = args[0];
      const params = args.slice(1);
      if (typeof publicAPI[method] === 'function') {
        publicAPI[method](...params);
      }
    }
    // Replace array with live proxy
    window._cq = {
      push: (args) => {
        const method = args[0];
        const params = args.slice(1);
        if (typeof publicAPI[method] === 'function') {
          publicAPI[method](...params);
        }
      }
    };
  }

  // â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const publicAPI = {
    /**
     * Initialize the collector with the given options.
     * Checks consent, bot detection, and sampling gates.
     */
    init: async function (options) {
      if (initialized) {
        console.warn('[Collector] Already initialized');
        return;
      }

      // Self-measurement: initialization timing
      if (typeof performance.mark === 'function') {
        performance.mark('collector_init_start');
      }

      // Merge user options into config
      if (options) merge(config, options);

      // Gate 1: Consent
      if (config.respectConsent && !hasConsent()) {
        console.log('[Collector] No consent â€” collection disabled');
        blocked = true;
        initialized = true;
        return;
      }

      // Gate 2: Bot detection
      if (config.detectBots && isBot()) {
        console.log('[Collector] Bot detected â€” collection disabled');
        blocked = true;
        initialized = true;
        return;
      }

      // Gate 3: Sampling
      if (!isSampled()) {
        console.log(`[Collector] Session not sampled (rate: ${config.sampleRate})`);
        blocked = true;
        initialized = true;
        return;
      }

      initialized = true;
      console.log('[Collector] Initialized', config);

      // Fetch/create the server-set session cookie before anything else runs.
      // All subsystems and beacons depend on getSessionId(), so this must
      // resolve first. Falls back to a client-generated ID on failure.
      await initSession();

      // Start subsystems
      if (config.enableVitals) initWebVitals();
      if (config.enableErrors) initErrorTracking();
      initTimeOnPage();
      initActivityTracking();

      // Process retry queue from previous page
      processRetryQueue();

      // Collect pageview after the page is fully loaded
      if (document.readyState === 'complete') {
        setTimeout(() => { collect('pageview'); }, 0);
      } else {
        window.addEventListener('load', () => {
          setTimeout(() => { collect('pageview'); }, 0);
        });
      }

      // Self-measurement
      if (typeof performance.mark === 'function') {
        performance.mark('collector_init_end');
        performance.measure('collector_init', 'collector_init_start', 'collector_init_end');
      }
    },

    /**
     * Track a custom event.
     */
    track: function (eventName, eventData) {
      if (!initialized || blocked) return;
      const payload = {
        type: 'event',
        event: eventName,
        data: eventData || {},
        timestamp: new Date().toISOString(),
        url: window.location.href,
        session: getSessionId(),
        customData: customData
      };
      if (userId) payload.userId = userId;
      send(payload);
    },

    /**
     * Set a custom key-value pair on all subsequent payloads.
     */
    set: function (key, value) {
      customData[key] = value;
    },

    /**
     * Identify the current user.
     */
    identify: function (id) {
      userId = id;
    },

    /**
     * Register a plugin/extension.
     * The plugin object may define:
     *   - init(config)       Called on registration
     *   - beforeSend(payload) Called before each beacon
     *   - onExit(payload)    Called on page exit
     */
    use: function (plugin) {
      if (!plugin || typeof plugin !== 'object') {
        console.warn('[Collector] Invalid plugin');
        return;
      }
      plugins.push(plugin);
      if (typeof plugin.init === 'function') {
        plugin.init(config);
      }
      console.log(`[Collector] Plugin registered: ${plugin.name || '(unnamed)'}`);
    }
  };

  // â”€â”€ Bootstrap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Process the command queue immediately
  processQueue();

  // â”€â”€ Expose for test pages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  window.__collector = {
    getNavigationTiming: getNavigationTiming,
    getResourceSummary: getResourceSummary,
    getTechnographics: getTechnographics,
    getWebVitals: getWebVitals,
    getSessionId: getSessionId,
    getNetworkInfo: getNetworkInfo,
    reportError: reportError,
    collect: collect,
    hasConsent: hasConsent,
    isBot: isBot,
    isSampled: isSampled,
    getErrorCount: () => errorCount,
    getConfig: () => config,
    isBlocked: () => blocked,
    getActivityLog: () => activityLog,
    flushActivityLog: flushActivityLog,
    api: publicAPI
  };

})();