// ============================================================
// Granite — "Ask the Oracle" brand-by-domain layer
// ------------------------------------------------------------
// One app, two brands. The brand is chosen from the signed-in
// user's email domain:
//   crashservices.com  -> CRASH  (blue)
//   jmksolicitors.com  -> JMK    (burgundy)
// Anything else falls back to a neutral palette.
//
// This file re-skins the existing UI by overriding the CSS
// custom properties already used throughout the pages
// (--navy / --navy-light / --gold / --gold-light / --sidebar),
// so no per-page CSS rewrite is required.
// ============================================================
(function () {
  'use strict';

  const BRANDS = {
    crash: {
      key: 'crash',
      name: 'CRASH Services',
      product: 'Ask the Oracle',
      logoHtml: 'Ask the <span>Oracle</span>',
      logoImg: 'assets/crash-logo.png',   // white-background CRASH logo
      vars: {
        '--navy': '#003175',        // CRASH primary blue
        '--navy-light': '#1a4a8f',
        '--gold': '#4a90e2',        // accent (provisional — pending CRASH marketing guidance)
        '--gold-light': '#7db4ee',
        '--sidebar': '#002457',
      },
      // CRASH wordmark is Helvetica / Arial sans-serif (confirmed).
      font: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    },
    jmk: {
      key: 'jmk',
      name: 'JMK Solicitors',
      product: 'Ask the Oracle',
      logoHtml: 'Ask the <span>Oracle</span>',
      logoImg: 'assets/jmk-logo.png',     // white-background JMK logo
      vars: {
        '--navy': '#3f0b03',        // JMK burgundy
        '--navy-light': '#5c1206',
        '--gold': '#b8b8b6',        // JMK secondary text grey
        '--gold-light': '#d2d2d0',
        '--sidebar': '#2c0702',
      },
      font: "'Century Gothic', 'Futura', 'Arial', sans-serif",
    },
    neutral: {
      key: 'neutral',
      name: 'Ask the Oracle',
      product: 'Ask the Oracle',
      logoHtml: 'Ask the <span>Oracle</span>',
      vars: {
        '--navy': '#1f2937',
        '--navy-light': '#374151',
        '--gold': '#c9a84c',
        '--gold-light': '#e8c96a',
        '--sidebar': '#111827',
      },
      font: "'Arial', sans-serif",
    },
  };

  function brandForDomain(email) {
    const domain = String(email || '').toLowerCase().split('@')[1] || '';
    if (domain === 'crashservices.com') return BRANDS.crash;
    if (domain === 'jmksolicitors.com') return BRANDS.jmk;
    return BRANDS.neutral;
  }

  function applyBrand(brand) {
    if (!brand) return;
    const root = document.documentElement;
    Object.entries(brand.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    if (brand.font) document.body && (document.body.style.fontFamily = brand.font);

    // Product / logo: prefer the real logo image, fall back to text wordmark.
    const logo = document.getElementById('brand-logo');
    if (logo) {
      if (brand.logoImg) {
        const img = new Image();
        img.alt = brand.name;
        // white pill so a white-background logo reads on the dark top bar
        img.style.cssText = 'height:30px;display:block;background:#fff;padding:3px 8px;border-radius:6px;';
        img.onerror = function () { logo.innerHTML = brand.logoHtml; }; // file not present yet
        img.onload = function () { logo.innerHTML = ''; logo.appendChild(img); };
        img.src = brand.logoImg;
      } else {
        logo.innerHTML = brand.logoHtml;
      }
    }
    document.title = brand.product + (brand.key !== 'neutral' ? ' — ' + brand.name : '');

    // Remember for snappier paint on next load (no PII beyond the brand key)
    try { localStorage.setItem('oracle_brand', brand.key); } catch (_) {}
    window.__oracleBrand = brand;
    document.body && document.body.setAttribute('data-brand', brand.key);
  }

  function applyBrandForEmail(email) {
    applyBrand(brandForDomain(email));
  }

  // Standing disclaimer (source-transparency, not advice). Injected once.
  function injectDisclaimer() {
    if (document.getElementById('oracle-disclaimer')) return;
    const bar = document.createElement('div');
    bar.id = 'oracle-disclaimer';
    bar.textContent =
      'Ask the Oracle returns answers drawn from curated source material, with citations. ' +
      'It is a research aid, not legal advice — always verify against the cited sources.';
    bar.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:9999;' +
      'font:400 11px/1.4 Arial,sans-serif;color:#fff;background:rgba(0,0,0,0.72);' +
      'padding:6px 14px;text-align:center;letter-spacing:0.01em;';
    (document.body || document.documentElement).appendChild(bar);
    // keep content clear of the fixed bar
    if (document.body) document.body.style.paddingBottom = '34px';
  }

  function init() {
    // 1) Paint last-known brand immediately to avoid a flash.
    let cached = null;
    try { cached = localStorage.getItem('oracle_brand'); } catch (_) {}
    applyBrand(BRANDS[cached] || BRANDS.neutral);

    // 2) Disclaimer everywhere.
    injectDisclaimer();

    // 3) Re-brand the moment the signed-in email appears in the top bar.
    const emailEl = document.getElementById('user-email-display');
    if (emailEl) {
      const sync = () => {
        const t = (emailEl.textContent || '').trim();
        if (t.includes('@')) applyBrandForEmail(t);
      };
      sync();
      new MutationObserver(sync).observe(emailEl, { childList: true, characterData: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API (for explicit calls from auth flows if desired)
  window.AskOracleBrand = { applyBrand, applyBrandForEmail, brandForDomain, BRANDS };
})();
