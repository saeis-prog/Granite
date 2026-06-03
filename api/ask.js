/**
 * credit-hire.ai — AI Query API
 * Vercel Serverless Function: /api/ask
 *
 * POST body: { question: string }
 * Returns:   { answer: string, cases: CaseSummary[] }
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';

// ── Query logging (fire-and-forget, never blocks the response) ──
async function logQuery(question, scope, casesMatched, articlesMatched, stopReason) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return; // silently skip if env vars not set
  try {
    await fetch(`${url}/rest/v1/query_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        query_text: question.slice(0, 2000), // cap at 2000 chars
        scope,
        cases_matched: casesMatched,
        articles_matched: articlesMatched,
        stop_reason: stopReason || null,
      }),
    });
  } catch (_) {
    // logging failure must never affect the user response
  }
}

// ── Load databases (cached between warm invocations) ──
let caseDb = null;
let liabilityDb = null;
let knowledgeDb = null;
let gtaRates = null;
let highwayCode = null;
let termsDb = null;

function loadGtaRates() {
  try {
    const filePath = join(process.cwd(), 'gta_rates.json');
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function getGtaRates() {
  if (!gtaRates) gtaRates = loadGtaRates();
  return gtaRates;
}

/**
 * Detect if query is about GTA rates and extract relevant info.
 * Returns a string to inject into the AI prompt, or null.
 */
function buildGtaRateContext(question) {
  const q = question.toLowerCase();
  const isRateQuery = (
    (q.includes('gta') && (q.includes('rate') || q.includes('group') || q.includes('daily'))) ||
    /\b(S\d{1,2}|P\d{1,2}|SP\d{1,2}|F\d{1,2}|M\d{0,2}|PV\d{1,2}|CV\d{1,2}|CP\d{1,2}|CM\d{1,2}|CS\d{1,2}|RV\d{1,2}|T\d{0,2}|NT\d{0,2}|T4|PT\d{0,2}|B\d{1,2})\b/i.test(question) ||
    (q.includes('rate') && (q.includes('hire') || q.includes('vehicle') || q.includes('car') || q.includes('van') || q.includes('commercial') || q.includes('taxi') || q.includes('motorcycle'))) ||
    (q.includes('group') && (q.includes('vehicle') || q.includes('car') || q.includes('rate') || q.includes('van') || q.includes('commercial')))
  );
  if (!isRateQuery) return null;

  const rates = getGtaRates();
  if (!rates || !rates.rate_periods || rates.rate_periods.length === 0) return null;

  // Try to detect a specific date from the question
  let targetDate = null;
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,  // DD/MM/YYYY or DD-MM-YYYY
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,  // YYYY-MM-DD
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i,
    /(\d{4})/  // just a year
  ];
  const monthNames = { january:1, february:2, march:3, april:4, may:5, june:6, july:7, august:8, september:9, october:10, november:11, december:12 };

  for (const pat of datePatterns) {
    const m = question.match(pat);
    if (m) {
      if (m[0].match(/^\d{4}$/) && parseInt(m[0]) >= 2019 && parseInt(m[0]) <= 2026) {
        // Just a year — use July 1 of that year as midpoint
        targetDate = `${m[0]}-07-01`;
        break;
      } else if (m[0].match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
        // DD/MM/YYYY
        const d = m[1].padStart(2,'0'), mo = m[2].padStart(2,'0'), y = m[3];
        targetDate = `${y}-${mo}-${d}`;
        break;
      } else if (m[0].match(/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/)) {
        targetDate = m[0];
        break;
      } else if (monthNames[m[1]?.toLowerCase()]) {
        const mo = String(monthNames[m[1].toLowerCase()]).padStart(2,'0');
        targetDate = `${m[2]}-${mo}-15`;
        break;
      }
    }
  }

  // Try to detect specific group codes (Cars, Commercial, Private Hire, Motorcycles)
  const groupMatches = question.match(/\b(SP\d{1,2}|S\d{1,2}|P\d{1,2}|F\d{1,2}|M\d{0,2}|PV\d{1,2}|CV\d{1,2}|CP\d{1,2}|CM\d{1,2}|CS\d{1,2}|RV\d{1,2}|NT\d{0,2}|T4|T\d{0,2}|PT\d{0,2}|B\d{1,2})\b/gi) || [];
  const requestedGroups = [...new Set(groupMatches.map(g => g.toUpperCase()))];

  // Build context string
  let context = '\n\n--- GTA RATE DATA ---\n';
  context += 'The following GTA maximum daily settlement rates are available (all rates EXCLUDE VAT).\n';
  context += rates.notes.map(n => `• ${n}`).join('\n') + '\n\n';

  // If specific date requested, find matching period
  const matchingPeriods = targetDate
    ? rates.rate_periods.filter(p => targetDate >= p.effective_from && targetDate <= p.effective_to)
    : rates.rate_periods;  // show all if no date specified

  for (const period of matchingPeriods) {
    context += `\nRATE PERIOD: ${period.effective_from} to ${period.effective_to} (${period.vehicle_type})\n`;
    const hasAgedRates = period.aged_rates && Object.keys(period.aged_rates).length > 0;
    if (hasAgedRates) {
      context += `  (Rates shown as: newer vehicle / aged vehicle)\n`;
    }
    if (requestedGroups.length > 0) {
      // Only show requested groups
      for (const g of requestedGroups) {
        if (period.rates[g] !== undefined) {
          if (hasAgedRates && period.aged_rates[g] !== undefined) {
            context += `  ${g}: £${period.rates[g].toFixed(2)} (newer) / £${period.aged_rates[g].toFixed(2)} (aged) per day\n`;
          } else {
            context += `  ${g}: £${period.rates[g].toFixed(2)} per day\n`;
          }
        }
      }
    } else {
      // Show all groups organised by category
      const categories = { S: [], P: [], SP: [], F: [], M: [], PV: [], CV: [], CP: [], CM: [], CS: [], RV: [], T: [], NT: [], T4: [], PT: [], B: [] };
      for (const [code, rate] of Object.entries(period.rates)) {
        // Match longest prefix first to avoid SP matching S, NT matching N, etc.
        if (code.startsWith('SP')) categories.SP.push([code, rate]);
        else if (code.startsWith('NT')) categories.NT.push([code, rate]);
        else if (code.startsWith('PT')) categories.PT.push([code, rate]);
        else if (code.startsWith('PV')) categories.PV.push([code, rate]);
        else if (code.startsWith('CV')) categories.CV.push([code, rate]);
        else if (code.startsWith('CP')) categories.CP.push([code, rate]);
        else if (code.startsWith('CM')) categories.CM.push([code, rate]);
        else if (code.startsWith('CS')) categories.CS.push([code, rate]);
        else if (code.startsWith('RV')) categories.RV.push([code, rate]);
        else if (code === 'T4') categories.T4.push([code, rate]);
        else if (code.startsWith('S')) categories.S.push([code, rate]);
        else if (code.startsWith('P')) categories.P.push([code, rate]);
        else if (code.startsWith('F')) categories.F.push([code, rate]);
        else if (code.startsWith('M')) categories.M.push([code, rate]);
        else if (code.startsWith('T')) categories.T.push([code, rate]);
        else if (code.startsWith('B')) categories.B.push([code, rate]);
      }
      const sortGroup = (a, b) => {
        const numA = parseInt(a[0].replace(/\D/g,'') || '0');
        const numB = parseInt(b[0].replace(/\D/g,'') || '0');
        return numA - numB;
      };
      for (const [cat, label] of [
        ['S','Standard Car'],['P','Prestige Car'],['SP','Sports Car'],['F','4x4/SUV'],['M','MPV'],
        ['PV','Panel Van'],['CV','Chassis Vehicle'],['CP','Pickup Truck'],['CM','Minibus'],['CS','Commercial 4x4'],['RV','Refrigerated Vehicle'],
        ['T','Private Hire (<3yr)'],['NT','Private Hire (<3yr)'],['T4','Private Hire (4yr+)'],['PT','Prestige Private Hire'],
        ['B','Motorcycle/Scooter']
      ]) {
        const items = categories[cat].sort(sortGroup);
        if (items.length > 0) {
          if (hasAgedRates) {
            context += `  ${label}: ` + items.map(([c,r]) => {
              const aged = period.aged_rates?.[c];
              return aged !== undefined ? `${c}=£${r.toFixed(2)}/£${aged.toFixed(2)}` : `${c}=£${r.toFixed(2)}`;
            }).join(', ') + '\n';
          } else {
            context += `  ${label}: ` + items.map(([c,r]) => `${c}=£${r.toFixed(2)}`).join(', ') + '\n';
          }
        }
      }
    }
  }

  if (matchingPeriods.length === 0 && targetDate) {
    context += `\nNo rate data available for the date ${targetDate}. The earliest available period starts ${rates.rate_periods[0].effective_from}.\n`;
  }

  context += '\n--- END GTA RATE DATA ---\n';
  return context;
}

// ── Highway Code reference (cached between warm invocations) ──
function loadHighwayCode() {
  try {
    const filePath = join(process.cwd(), 'highway_code.json');
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function getHighwayCode() {
  if (!highwayCode) highwayCode = loadHighwayCode();
  return highwayCode;
}

/**
 * Detect if query relates to negligence/liability and build Highway Code context.
 * Returns a string to inject into the AI prompt, or null.
 */
/**
 * Detect if query is about rental branch locations / nearest branch.
 * If a UK postcode is found, geocode it via postcodes.io, then query
 * Supabase car_bhr_locations to find the nearest branch per provider.
 * Returns a string to inject into the AI prompt, or null.
 */
async function buildLocationContext(question) {
  const q = question.toLowerCase();

  // Detect location-related queries
  const locationTerms = ['nearest', 'closest', 'branch', 'location', 'depot', 'where is', 'how far', 'distance', 'rental location', 'hire location'];
  const hasLocationTerm = locationTerms.some(t => q.includes(t));

  // Detect UK postcode pattern
  const postcodeMatch = question.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i);

  if (!hasLocationTerm && !postcodeMatch) return null;
  if (!postcodeMatch) return null; // need a postcode to do a lookup

  const postcode = postcodeMatch[1].replace(/\s+/g, ' ').trim().toUpperCase();

  try {
    // Geocode the postcode via postcodes.io
    const geoRes = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
    const geoData = await geoRes.json();
    if (geoData.status !== 200 || !geoData.result) return null;

    const claimantLat = geoData.result.latitude;
    const claimantLng = geoData.result.longitude;
    const area = geoData.result.admin_district || geoData.result.region || '';
    const country = geoData.result.country || '';

    // Query Supabase for all locations
    const sbUrl = process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!sbUrl || !sbKey) return null;

    const locRes = await fetch(`${sbUrl}/rest/v1/car_bhr_locations?select=provider,branch_name,city,postcode,address,latitude,longitude,phone,url&status=eq.Open`, {
      headers: {
        'apikey': sbKey,
        'Authorization': `Bearer ${sbKey}`
      }
    });
    const locations = await locRes.json();
    if (!Array.isArray(locations) || locations.length === 0) return null;

    // Haversine distance calculation
    function haversine(lat1, lon1, lat2, lon2) {
      const R = 3959; // miles
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // Detect Hertz 24/7 retail kiosk locations (B&Q, IKEA, Costco, "24/7")
    // These are self-service van-only kiosks, NOT traditional car rental branches
    function isRetailKiosk(loc) {
      if (loc.provider !== 'Hertz') return false;
      const name = (loc.branch_name || '').toLowerCase();
      return /b&q|b\+q|ikea|costco|24\/7|hertz 24|van rental at/i.test(name);
    }

    // Find nearest branch per provider (excluding retail kiosks)
    const nearestByProvider = {};
    locations.forEach(loc => {
      if (!loc.latitude || !loc.longitude) return;
      if (isRetailKiosk(loc)) return; // skip kiosks for nearest-branch calculation
      const dist = haversine(claimantLat, claimantLng, loc.latitude, loc.longitude);
      const prov = loc.provider;
      if (!nearestByProvider[prov] || dist < nearestByProvider[prov].distance) {
        nearestByProvider[prov] = { ...loc, distance: Math.round(dist * 10) / 10 };
      }
    });

    // Also find top 5 nearest overall (excluding retail kiosks)
    const allWithDist = locations
      .filter(loc => loc.latitude && loc.longitude && !isRetailKiosk(loc))
      .map(loc => ({ ...loc, distance: haversine(claimantLat, claimantLng, loc.latitude, loc.longitude) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);

    // Find nearest Hertz retail kiosk separately (for context)
    let nearestKiosk = null;
    locations.forEach(loc => {
      if (!loc.latitude || !loc.longitude || !isRetailKiosk(loc)) return;
      const dist = haversine(claimantLat, claimantLng, loc.latitude, loc.longitude);
      if (!nearestKiosk || dist < nearestKiosk.distance) {
        nearestKiosk = { ...loc, distance: Math.round(dist * 10) / 10 };
      }
    });

    // Build context string
    let ctx = `\n\nRENTAL LOCATION DATA (from credit-hire.ai database — car_bhr_locations table):\n`;
    ctx += `Claimant postcode: ${postcode} (${area}, ${country}) — Lat: ${claimantLat}, Lng: ${claimantLng}\n\n`;

    ctx += `NEAREST TRADITIONAL RENTAL BRANCH PER PROVIDER:\n`;
    Object.entries(nearestByProvider)
      .sort((a, b) => a[1].distance - b[1].distance)
      .forEach(([prov, loc]) => {
        ctx += `- ${prov}: ${loc.branch_name}`;
        if (loc.address) ctx += `, ${loc.address}`;
        else ctx += `, ${loc.city}, ${loc.postcode}`;
        ctx += ` — ${loc.distance} miles`;
        if (loc.phone) ctx += ` — Tel: ${loc.phone}`;
        ctx += `\n`;
      });

    if (nearestKiosk) {
      ctx += `\nNOTE — HERTZ 24/7 RETAIL KIOSK (NOT a traditional rental branch):\n`;
      ctx += `- Hertz 24/7: ${nearestKiosk.branch_name}, ${nearestKiosk.postcode} — ${nearestKiosk.distance} miles\n`;
      ctx += `  ⚠ Hertz 24/7 locations at B&Q, IKEA, and Costco stores are self-service van-only kiosks. They offer short-term van hire (hourly/daily) for retail customers transporting DIY or furniture purchases. They do NOT offer standard car rental, do NOT provide like-for-like replacement vehicles, and are NOT suitable comparators for BHR proximity analysis. The nearest traditional Hertz branch is shown above.\n`;
    }

    ctx += `\n5 NEAREST TRADITIONAL RENTAL BRANCHES OVERALL:\n`;
    allWithDist.forEach(loc => {
      ctx += `- ${loc.provider}: ${loc.branch_name}`;
      if (loc.address) ctx += `, ${loc.address}`;
      else ctx += `, ${loc.city}, ${loc.postcode}`;
      ctx += ` — ${Math.round(loc.distance * 10) / 10} miles`;
      if (loc.phone) ctx += ` — Tel: ${loc.phone}`;
      ctx += `\n`;
    });

    ctx += `\nNote: Distances are straight-line (as the crow flies). Actual driving distance will be longer. This data is sourced from each provider's published branch directory. Hertz 24/7 retail kiosk locations (B&Q, IKEA, Costco) have been excluded from the proximity analysis as they do not offer standard car rental.\n`;

    return ctx;
  } catch (err) {
    console.error('Location context error:', err);
    return null;
  }
}

function buildHighwayCodeContext(question) {
  const q = question.toLowerCase();

  // Detect liability/negligence queries
  const liabilityTerms = [
    'negligence', 'negligent', 'liability', 'liable', 'fault', 'at fault',
    'contributory', 'apportionment', 'blame', 'caused the accident',
    'highway code', 'road traffic', 'careless driving', 'dangerous driving',
    'without due care', 'speed limit', 'speeding', 'tailgating', 'following too close',
    'rear end', 'rear-end', 'shunt', 'ran into the back',
    'red light', 'traffic light', 'jumped the light',
    'pedestrian crossing', 'zebra crossing', 'pelican crossing',
    'mobile phone', 'phone while driving', 'using phone',
    'drink driv', 'drunk driv', 'over the limit', 'alcohol',
    'seat belt', 'seatbelt', 'not wearing',
    'overtaking', 'overtook', 'passing cyclist', 'passing horse',
    'junction', 'pulled out', 'failed to give way', 'give way', 'stop sign',
    'cyclist', 'motorcyclist', 'pedestrian', 'horse rider', 'vulnerable road user',
    'stopping distance', 'braking distance', 'too close',
    'wet road', 'icy road', 'fog', 'adverse weather', 'visibility',
    'double white line', 'road marking',
    'reversing', 'reversed into',
    'door opening', 'opened door', 'car door',
    'motorway', 'hard shoulder',
    'hierarchy of road users',
    'who was at fault', 'who is to blame', 'whose fault',
    'split liability', 'shared fault', 'contributory negligence'
  ];

  const isLiabilityQuery = liabilityTerms.some(term => q.includes(term));
  if (!isLiabilityQuery) return null;

  const hc = getHighwayCode();
  if (!hc || !hc.categories) return null;

  // Map query keywords to relevant Highway Code categories
  const categoryKeywords = {
    'Hierarchy of Road Users': ['hierarchy', 'vulnerable', 'pedestrian', 'cyclist', 'motorcyclist', 'horse rider', 'greatest harm', 'greatest responsibility'],
    'Vehicle Condition and Fitness to Drive': ['vehicle condition', 'unroadworthy', 'mot', 'eyesight', 'glasses', 'drunk', 'drink driv', 'alcohol', 'drug', 'tired', 'fatigue', 'drowsy', 'over the limit', 'fitness to drive', 'health condition'],
    'Seat Belts and Passengers': ['seat belt', 'seatbelt', 'not wearing', 'child restraint', 'child seat', 'passenger'],
    'Speed and Stopping Distances': ['speed', 'speeding', 'speed limit', 'stopping distance', 'braking distance', 'tailgating', 'following too close', 'too close', 'rear end', 'rear-end', 'shunt', 'ran into the back', '2 second', 'two second'],
    'Traffic Signals and Road Markings': ['traffic light', 'red light', 'jumped the light', 'double white line', 'road marking', 'cycle lane', 'advanced stop'],
    'Mobile Phones and Vehicle Control': ['mobile phone', 'phone while driving', 'using phone', 'hand-held', 'handheld', 'distracted', 'distraction', 'texting'],
    'Overtaking': ['overtaking', 'overtook', 'passing cyclist', 'passing horse', 'clearance', '1.5 metre', '1.5m'],
    'Junctions': ['junction', 'pulled out', 'failed to give way', 'give way', 'stop sign', 'emerging', 'roundabout', 't-junction'],
    'Pedestrian Crossings': ['pedestrian crossing', 'zebra crossing', 'pelican crossing', 'puffin crossing', 'toucan crossing', 'zig-zag', 'zigzag'],
    'Vulnerable Road Users': ['vulnerable road user', 'cyclist', 'motorcyclist', 'pedestrian', 'horse rider', 'older driver', 'learner', 'children', 'school'],
    'Driving in Adverse Weather': ['wet road', 'rain', 'icy', 'ice', 'snow', 'fog', 'foggy', 'adverse weather', 'visibility', 'wind', 'windy', 'hot weather', 'slippery'],
    'Lighting': ['headlight', 'lights', 'dazzle', 'fog light', 'no lights', 'lighting', 'dark'],
    'Dangerous/Careless Driving': ['dangerous driving', 'careless driving', 'without due care', 'without reasonable consideration', 'reckless'],
    'Reversing': ['reversing', 'reversed into', 'reverse', 'backing up'],
    'Waiting and Parking': ['parking', 'parked', 'door opening', 'opened door', 'car door', 'double yellow', 'obstruction', 'dutch reach'],
    'Motorways': ['motorway', 'hard shoulder', 'smart motorway', 'emergency area', 'closed lane', 'slip road'],
    'Incidents and Documentation': ['failed to stop', 'hit and run', 'exchange details', 'report to police', 'leaving the scene']
  };

  // Find matching categories
  const matchedCategories = [];
  for (const [catName, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => q.includes(kw))) {
      matchedCategories.push(catName);
    }
  }

  // Always include Dangerous/Careless Driving for general liability queries
  if (matchedCategories.length === 0 && (q.includes('negligence') || q.includes('liability') || q.includes('fault') || q.includes('blame'))) {
    matchedCategories.push('Dangerous/Careless Driving', 'Speed and Stopping Distances', 'Hierarchy of Road Users');
  }

  // Build context from matched categories
  let context = '\n\n--- HIGHWAY CODE REFERENCE (effective 10 April 2025) ---\n';
  context += 'LEGAL FRAMEWORK:\n';
  context += '• Rules using MUST/MUST NOT are legal requirements backed by Acts of Parliament. Breach is a criminal offence and provides strong prima facie evidence of negligence.\n';
  context += '• Rules using should/should not are advisory. Failure to follow them can be used as evidence of negligence or contributory negligence in civil proceedings.\n';
  context += '• The Hierarchy of Road Users (H1-H3): those in charge of vehicles that can cause greatest harm bear greatest responsibility.\n\n';

  let rulesIncluded = 0;
  const maxRules = 25; // Cap to avoid prompt overflow

  for (const cat of hc.categories) {
    if (!matchedCategories.includes(cat.name)) continue;
    if (rulesIncluded >= maxRules) break;

    context += `${cat.name.toUpperCase()}:\n`;
    for (const rule of cat.rules) {
      if (rulesIncluded >= maxRules) break;
      const statusTag = rule.legal_status === 'MUST' || rule.legal_status === 'MUST_NOT'
        ? `[${rule.legal_status} — legal requirement]`
        : `[${rule.legal_status}]`;
      context += `  Rule ${rule.rule_number}: ${rule.title} ${statusTag}\n`;
      context += `    ${rule.summary}\n`;
      if (rule.legislation) context += `    Law: ${rule.legislation}\n`;
      context += `    Liability relevance: ${rule.liability_relevance}\n`;
      rulesIncluded++;
    }
    context += '\n';
  }

  context += '--- END HIGHWAY CODE REFERENCE ---\n';
  return rulesIncluded > 0 ? context : null;
}

// ── Rental company T&C database (bhr_terms_db.json) ──
function loadTermsDb() {
  try {
    const filePath = join(process.cwd(), 'bhr_terms_db.json');
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function getTermsDb() {
  if (!termsDb) termsDb = loadTermsDb();
  return termsDb;
}

/**
 * Detect if query relates to rental company T&Cs and build context.
 * Matches company names and terms-related keywords, then injects
 * the relevant company's versioned T&C data into the prompt.
 */
function buildTermsContext(question) {
  const q = question.toLowerCase();
  const db = getTermsDb();
  if (!db || !db.companies) return null;

  // Map of detection keywords to company keys in the DB
  const companyAliases = {
    'avis prestige': 'avis_prestige',
    'avis_prestige': 'avis_prestige',
    'prestige collection': 'prestige_collection',
    'arnold clark': 'arnold_clark',
    'hertz uk': 'hertz_uk',
    'hertz ni': 'hertz_ni',
    'hertz northern ireland': 'hertz_ni',
    'sixt uk': 'sixt_uk',
    'sixt ni': 'sixt_ni',
    'sixt northern ireland': 'sixt_ni',
    'avis': 'avis',
    'hertz': 'hertz',
    'enterprise': 'enterprise',
    'europcar': 'europcar',
    'sixt': 'sixt',
    'budget': 'budget',
    'thrifty': 'thrifty',
    'dollar': 'thrifty',
    'dollar thrifty': 'thrifty',
    'scot group': 'thrifty',
    'national': 'national',
    'amt': 'amt',
    'evision': 'evision',
    'drivalia': 'drivalia',
    'easirent': 'drivalia',
    'pch': 'pch',
    'superbike': 'superbike_rental',
    'superbike rental': 'superbike_rental',
    'superman limited': 'superbike_rental',
    'questor': 'questor',
    'questor insurance': 'questor',
    'excess insurance': 'questor',
    'raceways': 'raceways',
    'raceways motorcycles': 'raceways',
    'prestige collection': 'prestige_collection',
  };

  // Terms-related keywords that signal a T&C query
  const termsKeywords = [
    'terms', 'conditions', 't&c', 'deposit', 'pre-authorisation', 'pre-auth',
    'preauthorisation', 'excess', 'waiver', 'cdw', 'scdw', 'additional driver',
    'mileage', 'fuel policy', 'fuel charge', 'cancellation', 'late return',
    'congestion', 'penalty', 'admin fee', 'processing fee', 'child seat',
    'baby seat', 'gps', 'satellite nav', 'roadside assistance', 'breakdown',
    'insurance', 'smoking', 'cleaning', 'damage fee', 'one-way', 'one way',
    'cross border', 'cross-border', 'foreign travel', 'overseas',
    'minimum age', 'driver age', 'licence', 'license', 'young driver',
    'surcharge', 'payment card', 'credit card', 'debit card',
    'protection package', 'zero excess', 'complete protection',
    'rental requirements', 'hire requirements', 'what does', 'how much',
    'electric vehicle', 'ev charge', 'battery charge', 'supercharging',
    'tyre waiver', 'screen waiver', 'windscreen',
    'motorcycle', 'motorbike', 'bike hire', 'helmet', 'panniers',
    'cbt', 'endorsement', 'penalty points',
  ];

  // Find which companies are mentioned
  const matchedCompanies = new Set();
  // Check multi-word aliases first (longest match first)
  const sortedAliases = Object.keys(companyAliases).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    if (q.includes(alias)) {
      const key = companyAliases[alias];
      if (db.companies[key]) matchedCompanies.add(key);
    }
  }

  // If no companies matched, check if it's a generic terms query in BHR context
  if (matchedCompanies.size === 0) return null;

  // Check if the query is actually about terms/T&Cs (not just mentioning a company name in passing)
  const hasTermsKeyword = termsKeywords.some(kw => q.includes(kw));
  // In BHR context, company mentions alone are enough (the AI needs the data)
  // For other scopes, require a terms keyword
  const isBhrContext = q.includes('bhr') || q.includes('basic hire rate') || q.includes('spot rate');
  if (!hasTermsKeyword && !isBhrContext) return null;

  // Try to detect a date from the question for version matching
  let targetDate = null;
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i,
    /(\d{4})/
  ];
  const monthNames = { january:1, february:2, march:3, april:4, may:5, june:6, july:7, august:8, september:9, october:10, november:11, december:12 };

  for (const pat of datePatterns) {
    const m = question.match(pat);
    if (m) {
      if (m[0].match(/^\d{4}$/) && parseInt(m[0]) >= 2019 && parseInt(m[0]) <= 2027) {
        targetDate = `${m[0]}-07`;
        break;
      } else if (m[0].match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
        targetDate = `${m[3]}-${m[2].padStart(2,'0')}`;
        break;
      } else if (monthNames[m[1]?.toLowerCase()]) {
        targetDate = `${m[2]}-${String(monthNames[m[1].toLowerCase()]).padStart(2,'0')}`;
        break;
      }
    }
  }

  // Build context for matched companies
  let context = '\n\n--- RENTAL COMPANY T&C DATA (from bhr_terms_db.json) ---\n';

  for (const companyKey of matchedCompanies) {
    const company = db.companies[companyKey];
    const displayName = company.trading_as || company.company_name || companyKey.replace(/_/g, ' ');
    context += `\n${displayName.toUpperCase()} (${company.company_name || displayName}):\n`;
    if (company.website) context += `Website: ${company.website}\n`;

    const versions = company.versions || [];
    if (versions.length === 0) continue;

    // Find the relevant version based on target date, or use current
    let relevantVersion = null;
    if (targetDate) {
      relevantVersion = versions.find(v => {
        const from = v.effective_from;
        const to = v.effective_to || '9999-12';
        return targetDate >= from && targetDate <= to;
      });
    }
    if (!relevantVersion) {
      relevantVersion = versions.find(v => v.current) || versions[versions.length - 1];
    }

    context += `Version: ${relevantVersion.effective_from} to ${relevantVersion.effective_to || 'present'}`;
    if (relevantVersion.current) context += ' (current)';
    context += '\n';
    if (relevantVersion.source_ref) context += `Source: ${relevantVersion.source_ref}\n`;
    if (relevantVersion.changes) context += `Changes in this version: ${relevantVersion.changes}\n`;

    // Output key sections concisely
    const v = relevantVersion;

    // Rental requirements
    const rr = v.rental_requirements;
    if (rr) {
      context += `Rental requirements: `;
      const parts = [];
      if (rr.minimum_driver_age_years) parts.push(`min age ${rr.minimum_driver_age_years}`);
      if (rr.young_driver_surcharge_gbp_per_day) parts.push(`under-${rr.young_driver_surcharge_threshold_years || 25} surcharge £${rr.young_driver_surcharge_gbp_per_day}/day`);
      if (rr.minimum_licence_held_cars_years) parts.push(`licence held ${rr.minimum_licence_held_cars_years}yr+ (cars)`);
      else if (rr.minimum_licence_held_years) parts.push(`licence held ${rr.minimum_licence_held_years}yr+`);
      if (rr.uk_driving_licence) parts.push(rr.uk_driving_licence);
      context += parts.join('; ') + '\n';
    }

    // Pre-authorisation
    const pa = v.pre_authorisation;
    if (pa) {
      context += `Pre-authorisation: `;
      if (pa.mainland_uk_gbp) context += `£${pa.mainland_uk_gbp}`;
      if (pa.mainland_uk_formula) context += ` (${pa.mainland_uk_formula})`;
      context += '\n';
    }

    // Optional extras
    const extras = v.optional_extras_daily_rates_gbp;
    if (extras) {
      context += 'Optional extras (daily rates GBP):\n';
      for (const [key, val] of Object.entries(extras)) {
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          const rate = val.mainland_uk || val.mainland_uk_per_day || val.mainland_uk_min;
          const max = val.mainland_uk_max;
          if (rate !== undefined) {
            const label = key.replace(/_/g, ' ');
            context += `  ${label}: £${rate}${max ? `-£${max}` : ''}/day`;
            if (val.notes) context += ` (${val.notes})`;
            context += '\n';
          }
        } else if (typeof val === 'number') {
          context += `  ${key.replace(/_/g, ' ')}: £${val}/day\n`;
        }
      }
    }

    // Additional charges
    const charges = v.additional_charges_gbp || v.additional_charges;
    if (charges) {
      context += 'Additional charges:\n';
      for (const [key, val] of Object.entries(charges)) {
        if (typeof val === 'number') {
          context += `  ${key.replace(/_/g, ' ')}: £${val}\n`;
        } else if (typeof val === 'string') {
          context += `  ${key.replace(/_/g, ' ')}: ${val}\n`;
        }
      }
    }

    // Fuel charges
    const fuel = v.fuel_charges || v.fuel_policy;
    if (fuel) {
      context += 'Fuel policy: ';
      const fParts = [];
      if (fuel.pay_on_return_multiplier) fParts.push(`Pay on Return ${fuel.pay_on_return_multiplier}`);
      if (fuel.ez_fuel_cars_gbp_min) fParts.push(`EZ Fuel cars £${fuel.ez_fuel_cars_gbp_min}-£${fuel.ez_fuel_cars_gbp_max}`);
      if (fuel.refuelling_charge_per_litre_gbp) fParts.push(`refuelling £${fuel.refuelling_charge_per_litre_gbp}/litre`);
      if (fuel.tesla_supercharging) fParts.push(`Tesla Supercharging: ${fuel.tesla_supercharging}`);
      context += fParts.join('; ') + '\n';
    }

    // Deposits
    const dep = v.deposits;
    if (dep) {
      context += 'Deposits: ';
      if (dep.deposit_range_gbp_min) context += `£${dep.deposit_range_gbp_min}-£${dep.deposit_range_gbp_max}`;
      if (dep.with_evision_insurance) context += `EVision insurance: £${dep.with_evision_insurance}; own insurance: £${dep.with_own_insurance}`;
      if (dep.deposit_notes) context += ` (${dep.deposit_notes})`;
      context += '\n';
    }

    // Insurance
    const ins = v.insurance;
    if (ins) {
      context += 'Insurance: ';
      const iParts = [];
      if (ins.included_in_base_rate) iParts.push('comprehensive cover included');
      if (ins.excess_range_gbp_min) iParts.push(`excess £${ins.excess_range_gbp_min}-£${ins.excess_range_gbp_max}`);
      if (ins.zero_excess_option) iParts.push('Zero Excess Option available');
      if (ins.excess_waiver_notes) iParts.push(ins.excess_waiver_notes);
      context += iParts.join('; ') + '\n';
    }

    // Mileage
    const mil = v.mileage;
    if (mil) {
      context += `Mileage: ${mil.standard || 'See terms'}`;
      if (mil.excess_mileage_per_mile_min_pence) context += `; excess ${mil.excess_mileage_per_mile_min_pence}-${mil.excess_mileage_per_mile_max_pence}p/mile`;
      if (mil.excess_mileage_charge) context += `; excess ${mil.excess_mileage_charge}`;
      context += '\n';
    }

    // Cancellation
    const canc = v.cancellation;
    if (canc) {
      context += 'Cancellation: ';
      if (canc.over_24_hours_notice) context += `>24hrs: ${canc.over_24_hours_notice}; <24hrs: ${canc.under_24_hours_notice}`;
      context += '\n';
    }

    // BHR analysis notes
    const bhr = v.bhr_analysis_notes;
    if (bhr) {
      if (Array.isArray(bhr)) {
        context += 'BHR analysis notes:\n';
        bhr.slice(0, 5).forEach(n => { context += `  • ${n}\n`; });
      } else if (typeof bhr === 'object') {
        if (bhr.rate_inflators_to_identify) {
          context += 'Rate inflators to identify:\n';
          bhr.rate_inflators_to_identify.slice(0, 4).forEach(r => { context += `  • ${r}\n`; });
        }
        if (bhr.what_defendants_argue) context += `Defendant argument: ${bhr.what_defendants_argue}\n`;
        if (bhr.what_claimants_argue) context += `Claimant argument: ${bhr.what_claimants_argue}\n`;
      }
    }

    // Version history summary (brief)
    if (versions.length > 1) {
      context += `Version history (${versions.length} versions available):\n`;
      versions.forEach(ver => {
        context += `  ${ver.effective_from} to ${ver.effective_to || 'present'}`;
        if (ver.changes) context += `: ${ver.changes.slice(0, 120)}${ver.changes.length > 120 ? '...' : ''}`;
        context += '\n';
      });
    }
  }

  context += '\n--- END RENTAL COMPANY T&C DATA ---\n';
  return context;
}

function loadDb(filename) {
  try {
    const filePath = join(process.cwd(), filename);
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : (parsed.cases || []);
    return arr.filter(c => c && c.case_name);
  } catch (e) {
    return null;
  }
}

function loadKnowledgeDb() {
  try {
    const filePath = join(process.cwd(), 'knowledge_base.json');
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed.articles || [];
  } catch (e) {
    return [];
  }
}

function getDatabase(scope = 'credit_hire') {
  if (!caseDb) caseDb = loadDb('case_database.json');
  if (!liabilityDb) liabilityDb = loadDb('liability_database.json') || [];

  if (scope === 'liability') return liabilityDb.length ? liabilityDb : null;
  if (scope === 'both') return [...(caseDb || []), ...liabilityDb];
  // Default: credit_hire
  if (!caseDb) throw new Error('Could not load case_database.json');
  return caseDb;
}

function getKnowledgeDb() {
  if (!knowledgeDb) knowledgeDb = loadKnowledgeDb();
  return knowledgeDb;
}

// ── Scoring: find top N relevant cases for a query ──
function findRelevantCases(question, db, topN = 12, bhrMode = false) {
  const q = question.toLowerCase();
  const qWords = extractQueryWords(question);

  // Credit hire topic keywords mapped to weights
  const topicKeywords = {
    impecuniosity: ['impecunious', 'impecuniosity', 'afford', 'funding', 'financial', 'means'],
    'basic hire rate': ['basic hire rate', 'bhr', 'spot hire', 'commercial rate', 'comparable rate', 'stevens', 'mcbride', 'bunting', 'diriye', 'niche market', 'survey', 'acriss', 'gta', 'comparable vehicle'],
    'credit hire rate': ['credit hire rate', 'chr', 'deferred payment', 'credit hire'],
    need: ['need', 'necessary', 'requirement', 'alternative', 'replacement'],
    storage: ['storage', 'storing', 'garage', 'compound'],
    'write-off': ['write-off', 'total loss', 'ctv', 'market value', 'pre-accident'],
    mitigation: ['mitigat', 'duty to mitigat', 'unreasonable', 'excessive hire'],
    duration: ['duration', 'period of hire', 'length of hire', 'how long'],
    'loss of use': ['loss of use', 'unable to use', 'inconvenience'],
    'like-for-like': ['like for like', 'like-for-like', 'equivalent vehicle', 'prestige'],
    sham: ['sham', 'fraudulent', 'fictitious', 'pretend'],
    'ex turpi': ['ex turpi', 'illegality', 'uninsured', 'no mot', 'no insurance'],
    'non-party costs': ['non-party costs', 'npco', 'third party costs', 'costs order'],
    betterment: ['betterment', 'improvement', 'new for old'],
    causation: ['causation', 'caused', 'but for', 'effective cause'],
    'zero excess': ['zero excess', 'excess waiver', 'cdw', 'collision damage waiver', 'insurance product', 'excess insurance', 'nil excess'],
    'fundamental dishonesty': ['fundamental dishonesty', 'qocs', 'qualified one-way costs'],
    'third party capture': ['third party capture', 'capture', 'own insurer', 'tp capture'],
    'hire period': ['hire period', 'notification', 'credit period', 'credit days'],
  };

  // In BHR mode, boost BHR-specific case names automatically
  const bhrCaseBoosts = bhrMode
    ? ['stevens', 'mcbride', 'bunting', 'diriye', 'hussain', 'pattni', 'lagden', 'dimond', 'clark', 'greenlees', 'liddle']
    : [];

  const scored = db.map(c => {
    let score = 0;
    const text = [
      c.case_name, c.citation, c.summary, c.outcome,
      (c.legal_topics || []).join(' '),
      (c.key_principles || []).join(' '),
      (c.aliases || []).join(' ')
    ].join(' ').toLowerCase();

    // Topic keyword matching (high weight)
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(kw => q.includes(kw))) {
        const topicScore = keywords.filter(kw => text.includes(kw)).length;
        score += topicScore * 4;
      }
    }

    // Legal topic field matching
    const legalTopics = (c.legal_topics || []).map(t => t.toLowerCase());
    legalTopics.forEach(t => {
      if (q.includes(t) || qWords.some(w => t.includes(w))) score += 3;
    });

    // General word matching
    qWords.forEach(w => {
      if (text.includes(w)) score += 1;
    });

    // Named-case boost: if user explicitly mentions a party name from this case, always surface it
    const nameParts = (c.case_name || '').toLowerCase().split(/\s+v\s+|\s+v\s*/)[0].split(/\s+/);
    const allPartyWords = (c.case_name || '').toLowerCase().split(/\W+/).filter(w => w.length > 3);
    // Also include party words from aliases (e.g. conjoined case names like "Burdis v Livsey")
    const aliasWords = (c.aliases || []).join(' ').toLowerCase().split(/\W+/).filter(w => w.length > 3);
    const combinedPartyWords = [...new Set([...allPartyWords, ...aliasWords])];
    if (combinedPartyWords.some(w => q.includes(w) && qWords.includes(w))) score += 25;

    // Court level bonus (authoritative cases ranked higher)
    const levelBonus = { 1: 3, 2: 2, 3: 1 };
    score += levelBonus[c.court_level] || 0;

    // BHR mode: boost known BHR cases regardless of query keywords
    if (bhrMode) {
      const caseNameLower = (c.case_name || '').toLowerCase();
      if (bhrCaseBoosts.some(name => caseNameLower.includes(name))) score += 10;
      // Also boost any case whose legal topics include BHR-related terms
      const legalTopicsText = (c.legal_topics || []).join(' ').toLowerCase();
      if (legalTopicsText.includes('basic hire rate') || legalTopicsText.includes('bhr') || legalTopicsText.includes('spot hire')) score += 6;
    }

    return { ...c, _score: score };
  });

  return scored
    .filter(c => c._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, topN);
}

// BHR-specific tags that should be heavily prioritised in BHR mode
const BHR_TAGS = ['bhr', 'basic hire rate', 'spot hire', 'stevens', 'mcbride', 'bunting', 'diriye',
  'hussain', 'niche market', 'comparable rate', 'commercial rate', 'acriss', 'gta', 'survey evidence',
  'bhr evidence', 'rate evidence', 'engineering evidence', 'burden of proof'];

// Short words (≤3 chars) that are meaningful domain terms and should NOT be filtered out
const SHORT_TERM_WHITELIST = new Set([
  'mot', 'bhr', 'gta', 'cdw', 'ldw', 'rta', 'mib', 'cru', 'nic', 'vat',
  'pco', 'tfl', 'dvla', 'abi', 'oic', 'pi', 'qc', 'kc', 'hgv', 'suv',
  'ev', 'ice', 'aca', 'cfa', 'dba', 'aia', 'cpr', 'pd', 'cpd',
]);

// Extract query words: keep words > 3 chars OR whitelisted short terms
function extractQueryWords(question) {
  const q = question.toLowerCase();
  return q.split(/\W+/).filter(w => w.length > 3 || SHORT_TERM_WHITELIST.has(w));
}

// ── Scoring: find top N relevant knowledge base articles for a query ──
function findRelevantArticles(question, articles, topN = 5, bhrMode = false) {
  const q = question.toLowerCase();
  const qWords = extractQueryWords(question);
  const effectiveTopN = bhrMode ? 8 : topN;

  const scored = articles.map(a => {
    let score = 0;

    // Tags array match — field is 'tags' (high weight — these are hand-curated)
    const tags = (a.tags || a.topics || []).map(t => t.toLowerCase());
    tags.forEach(t => {
      if (q.includes(t)) score += 5;
      else if (qWords.some(w => {
        // For short whitelisted terms (e.g. "mot"), require word-boundary match
        // to avoid "mot" matching "motorcycle" or "remote"
        if (SHORT_TERM_WHITELIST.has(w)) {
          const re = new RegExp(`\\b${w}\\b`);
          return re.test(t);
        }
        return t.includes(w) || w.includes(t);
      })) score += 2;
    });

    // BHR mode: heavily boost articles whose tags include BHR-specific terms
    if (bhrMode) {
      const bhrTagHits = tags.filter(t => BHR_TAGS.some(bt => t.includes(bt) || bt.includes(t)));
      score += bhrTagHits.length * 8;
      // Also boost by category
      const cat = (a.category || '').toLowerCase();
      if (cat.includes('bhr') || cat.includes('basic hire') || cat.includes('rate')) score += 6;
    }

    // Category match
    const category = (a.category || '').toLowerCase();
    qWords.forEach(w => { if (category.includes(w)) score += 3; });

    // Key principles text match — supports both old schema (key_principles/key_points) and new schema (principles)
    const rawKp = a.key_principles || a.key_points || a.principles || [];
    const keyPrinciplesText = (Array.isArray(rawKp) ? rawKp.join(' ') : String(rawKp)).toLowerCase();
    qWords.forEach(w => { if (keyPrinciplesText.includes(w)) score += 1; });

    // Title / summary match
    const titleSummary = `${a.title} ${a.summary || ''}`.toLowerCase();
    qWords.forEach(w => { if (titleSummary.includes(w)) score += 1; });

    // Full content match — field is 'content' (lower weight, broad signal)
    const fullText = (a.content || a.full_text || '').toLowerCase();
    qWords.forEach(w => { if (fullText.includes(w)) score += 0.5; });

    // Cases referenced match — field is 'cases_referenced'
    // Use word-boundary regex to avoid single-letter false positives (e.g. "R" from "R v Smith"
    // matching any query containing the letter r as a substring)
    const casesReferenced = (a.cases_referenced || a.cases_cited || []).map(c => c.toLowerCase());
    casesReferenced.forEach(c => {
      const firstWord = c.split(/\s+/)[0];
      if (firstWord.length > 1) {
        const re = new RegExp(`\\b${firstWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        if (re.test(q)) score += 3;
      }
    });

    // Location article boosting — when query contains a UK postcode or location terms
    const postcodePattern = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i;
    const locationTerms = ['nearest', 'closest', 'branch', 'location', 'depot', 'where', 'distance', 'postcode', 'miles'];
    const hasPostcode = postcodePattern.test(question);
    const hasLocationTerm = locationTerms.some(t => q.includes(t));
    if ((hasPostcode || hasLocationTerm) && (a.type === 'location_data' || tags.some(t => t.includes('location') || t.includes('branch')))) {
      score += 15;
    }

    // Case law articles get a boost when they match — judicial authority is more valuable than commentary
    if (a.type === 'case_law' && score > 0) {
      score += 5;
    }

    return { ...a, _score: score };
  });

  return scored
    .filter(a => a._score > 1)
    .sort((a, b) => b._score - a._score)
    .slice(0, effectiveTopN);
}

// ── Build prompt for Claude ──
function buildPrompt(question, cases, scope = 'credit_hire', articles = [], locationContext = '') {
  const caseBlock = cases.map((c, i) => {
    const parts = [
      `Case ${i + 1}: ${c.case_name}`,
      c.citation ? `Citation: ${c.citation}` : null,
      c.court ? `Court: ${c.court}` : null,
      c.year ? `Year: ${c.year}` : null,
      c.outcome ? `Outcome: ${c.outcome}` : null,
      c.summary ? `Summary: ${c.summary}` : null,
      c.key_principles && c.key_principles.length
        ? `Key principles:\n${c.key_principles.map(p => `  - ${p}`).join('\n')}` : null,
      c.key_paragraphs && c.key_paragraphs.length
        ? `Key paragraphs from judgment:\n${Array.isArray(c.key_paragraphs) ? c.key_paragraphs.map(p => `  ${p}`).join('\n') : `  ${c.key_paragraphs}`}` : null,
    ].filter(Boolean);
    return parts.join('\n');
  }).join('\n\n---\n\n');

  // Build expert commentary block if articles are available
  const articleBlock = articles.length ? articles.map((a, i) => {
    // Support both old schema (author/key_points/full_text) and new schema (source/key_principles/content)
    const authorLine = a.author
      ? `Author: ${a.author}${a.author_role ? `, ${a.author_role}` : ''}${a.date ? ` (${a.date})` : ''}`
      : (a.source ? `Source: ${a.source}` : null);
    const rawKp = a.key_principles || a.key_points || a.principles || [];
    const keyPrinciples = Array.isArray(rawKp) ? rawKp : (rawKp ? [String(rawKp)] : []);
    // Case law articles get more generous limits than commentary
    const isCaseLaw = a.type === 'case_law';
    const maxPrinciples = isCaseLaw ? 10 : 8;
    const maxPrincipleLen = isCaseLaw ? 2000 : 1500;
    const cappedPrinciples = keyPrinciples.slice(0, maxPrinciples).map(p => p.length > maxPrincipleLen ? p.slice(0, maxPrincipleLen) + '...' : p);
    // Case law articles get full content (up to 5000 chars); commentary gets summary + full_text excerpt
    const fullTextSrc = a.full_text || a.content || null;
    const summaryText = isCaseLaw
      ? (a.content ? a.content.slice(0, 5000) + (a.content.length > 5000 ? '...' : '') : a.summary || null)
      : (a.summary || (fullTextSrc ? fullTextSrc.slice(0, 3000) + (fullTextSrc.length > 3000 ? '...' : '') : null));
    const typeLabel = isCaseLaw ? `[CASE LAW — JUDICIAL AUTHORITY]` : null;
    const courtLine = isCaseLaw && a.court ? `Court: ${a.court}` : null;
    const judgeLine = isCaseLaw && a.judge ? `Judge: ${a.judge}` : null;
    const caseRefLine = isCaseLaw && a.case_ref ? `Case ref: ${a.case_ref}` : null;
    const parts = [
      typeLabel,
      `"${a.title}"`,
      authorLine,
      courtLine,
      judgeLine,
      caseRefLine,
      summaryText ? (isCaseLaw ? `Judgment content: ${summaryText}` : `Summary: ${summaryText}`) : null,
      cappedPrinciples.length
        ? `Key principles:\n${cappedPrinciples.map(p => `  - ${p}`).join('\n')}` : null,
    ].filter(Boolean);
    return parts.join('\n');
  }).join('\n\n---\n\n') : null;

  const scopeDesc = scope === 'liability'
    ? 'liability dispute case law'
    : scope === 'both'
    ? 'credit hire and liability dispute case law'
    : scope === 'bhr'
    ? 'basic hire rate (BHR) analysis in credit hire litigation'
    : 'credit hire law';

  const articleSection = articleBlock
    ? `\n\nEXPERT COMMENTARY FROM KNOWLEDGE BASE:\n${articleBlock}`
    : '';

  // Inject GTA rate data if this is a rate-related query
  const gtaRateContext = buildGtaRateContext(question) || '';

  // Inject Highway Code rules if this is a liability/negligence query
  const highwayCodeContext = buildHighwayCodeContext(question) || '';

  // Inject rental company T&C data if query mentions a specific supplier
  const termsContext = buildTermsContext(question) || '';

  // Location context is passed in from the async handler
  const locationCtx = locationContext || '';

  const termsInstruction = termsContext
    ? `\n- RENTAL COMPANY T&C DATA has been provided from the credit-hire.ai terms database. Use this data to answer questions about specific supplier terms, charges, deposits, excess amounts, optional extras, mileage policies, driver requirements, and cancellation policies. When a date is relevant, the version matching that date has been selected — note any changes between versions. This data is sourced from monthly website captures of each supplier's published terms and conditions, verified against PDF snapshots.`
    : '';

  const locationInstruction = locationCtx
    ? `\n- RENTAL LOCATION DATA has been provided from the credit-hire.ai database. When answering location queries (e.g. "nearest branch to [postcode]"), use this data to provide specific branch names, distances, and addresses. Frame the answer in terms of BHR relevance — e.g. whether the nearest branch is within reasonable distance for a claimant, whether a BHR provider is realistically accessible. Distances shown are straight-line; note that driving distance will be greater.`
    : '';

  const articleInstruction = articleBlock
    ? `\n- CRITICAL — CASE LAW vs COMMENTARY DISTINCTION: The knowledge base contains two types of article. Articles marked [CASE LAW — JUDICIAL AUTHORITY] are judicial decisions and must be treated as binding or persuasive authority depending on court level — they are NOT mere commentary. If a case law article directly decides a point raised by the question, you MUST apply that decision and NOT reason to a contrary conclusion from general principles. Articles without that marker are expert commentary — weave their practical insights into your answer but treat them as persuasive guidance, not binding authority.
- When referencing expert commentary (non-case-law articles), always attribute it generically as "Steve Evans of The Credit Hire Forum" — e.g. "As Steve Evans of The Credit Hire Forum observes..." or "Steve Evans of The Credit Hire Forum notes that...". NEVER refer to articles by number (e.g. "Article 1", "Article 3") or by their internal title. ALL commentary must be attributed to "Steve Evans of The Credit Hire Forum" regardless of the original author shown in the article metadata.
- When referencing case law articles, cite the case name, court, and judge as provided in the article metadata.`
    : '';

  const bhrSystemPrompt = `You are a specialist BHR (basic hire rate) analyst for credit hire litigation across England and Wales, Scotland, and Northern Ireland. Your role is to help legal practitioners and claims handlers understand, apply and challenge BHR evidence. You have been given a question along with relevant cases and expert commentary focused on BHR methodology and rate evidence.

QUESTION: ${question}

RELEVANT CASES FROM DATABASE:
${caseBlock}${articleSection}${gtaRateContext}${highwayCodeContext}${termsContext}${locationCtx}

INSTRUCTIONS:
- IMPORTANT — USER PERSPECTIVE: All users of credit-hire.ai act on the CLAIMANT side of credit hire disputes — they are either Credit Hire Organisations (CHOs) pursuing charges against a defendant insurer, or solicitors instructed by a CHO. Answer every question through the claimant's lens. Where a user asks how to argue, address, respond to, or rebut a particular point or stipulation, assume that point has been raised by the DEFENDANT (or its insurer/solicitor/expert) and frame your answer as the rebuttal or counter-argument the user can deploy. Do not interpret the user's question as an admission against the claimant's interest. Do not default to a mitigation lens that assumes the claimant has acted unreasonably. If a user mentions a supplier rate, a maximum hire period, a Part 36 offer, an SDP-only argument, an alternative vehicle, repair delay, or any similar evidential point being raised, the working assumption is that the defendant has raised it and the user wants help defeating it. Only depart from this assumption if the user explicitly states they are acting for the defendant or asking from a defendant's perspective.
- Focus your answer on BHR methodology, rate evidence, survey admissibility, comparator vehicle selection, and challenge strategies.
- Cite cases by name and citation (e.g. "Stevens v Equity Syndicate Management [2015] EWCA Civ 93").
- Where "Key paragraphs from judgment" are provided, cite the specific paragraph numbers so practitioners can go directly to the relevant passage.
- Structure your answer around the key BHR principles: (1) what the law requires of a BHR survey; (2) how courts assess rate evidence; (3) practical challenges available to claimant or defendant.${articleInstruction}${termsInstruction}${locationInstruction}
- IMPORTANT — STEVENS SUPPLIER HIERARCHY: Under Stevens v Equity Syndicate Management [2015] EWCA Civ 93, there is a strict two-tier hierarchy for BHR comparators. TIER 1 (MAINSTREAM NATIONAL): The first and primary comparator MUST be a recognised mainstream national supplier. The mainstream nationals are FOUR companies only: AVIS, HERTZ, ENTERPRISE and EUROPCAR. These four offer rental services across a wide range of models throughout the United Kingdom. Only if no mainstream national is available in the claimant's locality (either geographically absent OR does not offer the requisite vehicle group/category/specification) does the analysis move to Tier 2. TIER 2 (RESPECTED LOCAL): The fallback is a "respected local supplier" which must satisfy BOTH requirements: (a) LOCAL — the supplier actually operates in or near the claimant's geographical area, and (b) RESPECTED — demonstrable reputation evidenced by Trustpilot ratings, Google reviews, Companies House trading history and an established physical presence. NOT MAINSTREAM NATIONALS: the following companies are emphatically NOT Tier 1, even though some have multiple locations: THRIFTY (limited geographical coverage), SIXT (predominantly airport-based, with some major-city locations only), PCH (Performance Car Hire — niche), EVISION (electric only, niche), DRIVALIA (regional), BUDGET (part of the Avis Group but materially fewer locations than Avis itself), ARNOLD CLARK (limited geographical coverage), AMT (only a few regional locations). If cited in BHR evidence, these companies can only qualify as Tier 2 comparators — and only if they are both local to the claimant AND respected. CHALLENGE FRAMEWORK: when reviewing BHR evidence, the steps are (1) Is the cited supplier one of the four mainstream nationals? If yes, treat as a Tier 1 comparator and challenge on equivalence (vehicle group, ACRISS, period, terms). (2) If the cited supplier is NOT one of the four mainstream nationals, the FIRST question is whether a mainstream national WAS available in the claimant's locality and offered an equivalent vehicle. If yes, the rate witness has SKIPPED Tier 1 and gone straight to a non-mainstream supplier — this is usually a deceitful attempt to put forward a rate lower than the rate the claimant would actually have paid in the open market. Challenge it directly: ask the rate witness to confirm whether mainstream nationals were available in the claimant's locality at the relevant date and, if so, why their rates were not cited. (3) If no mainstream national was available, only then test whether the cited Tier 2 supplier is genuinely "respected" (Trustpilot, Google, Companies House, physical presence). A supplier with poor ratings or a thin trading record is not "respected" and the comparator falls. Always apply this hierarchy when answering questions about whether a particular supplier qualifies as a valid BHR comparator.
- IMPORTANT — MOTORCYCLE / MOTORBIKE / SCOOTER / E-BIKE BHR: When the claim involves a motorcycle, motorbike, scooter, moped, e-bike or any two-wheeled hire vehicle, the Stevens hierarchy effectively COLLAPSES. There are NO mainstream national motorcycle hire providers in the UK — Avis, Hertz, Enterprise, Europcar, Sixt and Budget do not hire motorcycles. Tier 1 of Stevens is therefore unavailable in every motorcycle BHR analysis. The defendant's only available comparator is at Tier 2 (respected local supplier) — examples include Raceways Motorcycles, Superbike Rental Ltd, Ugo Scooters, Omega Bikes, Rent a Scoot. The "respected" requirement is the dominant test: Trustpilot ratings, Google reviews, Companies House trading history, established physical presence. There is also a STRUCTURAL DIFFERENCE in insurance cover that almost always defeats the comparator on like-for-like grounds. (a) CAR BHR: mainstream and respected local car hire providers offer COMPREHENSIVE insurance with an excess that the hirer can waive by paying an additional CDW / excess waiver fee. (b) MOTORCYCLE BHR: motorcycle hire companies typically offer only THIRD-PARTY insurance — the hirer remains personally liable for theft of the bike and for any damage caused to the bike where the hirer is at fault. Comprehensive cover is unusual or unavailable from local bike hire providers, and where available is very expensive. (c) CREDIT HIRE motorcycle agreements almost always include comprehensive cover with ZERO excess. The claimant under a credit hire agreement therefore has the benefit of cover that no respected local motorcycle BHR provider offers on equivalent terms. The comparator is not like-for-like and on this ground alone the BHR rate quoted by a defendant for a motorcycle hire can usually be discounted entirely. Always raise BOTH points in any motorcycle BHR challenge: (i) the Stevens mainstream tier is unavailable so there is no Tier 1 comparator for motorcycles, and (ii) the local motorcycle BHR comparator does not provide insurance on equivalent terms to the credit hire agreement and therefore is not a valid like-for-like comparator (per the equivalence requirement in Pattni and Bent v Highways and Utilities Construction [2012] RTR 17).
- If the question involves Scotland, draw on any Scottish materials provided and note differences from the English/Welsh position (e.g. burden of BHR proof lies on the defender in Scotland).
- IMPORTANT — NORTHERN IRELAND JURISDICTION: Cases from the Northern Ireland High Court (citations containing "NIQB", "NICh", "NICA" or courts described as "High Court of Justice in Northern Ireland") are NOT binding in England and Wales. They may offer helpful and persuasive guidance, but they do not form precedent. When citing any NI case, always qualify it as a persuasive but non-binding authority. Lead with binding England and Wales authorities (UKHL, UKSC, EWCA Civ, EWHC) and use NI cases only as supplementary illustration.
- If the question relates to ACRISS codes, GTA groups, or vehicle comparability, address these directly using the expert commentary provided.
- IMPORTANT — CREDIT REPAIR vs CREDIT HIRE DISTINCTION: "Credit repair" and "credit hire" are entirely different heads of loss. Credit repair relates to the recovery of vehicle repair costs (the cost of fixing the damaged vehicle), governed primarily by Coles v Hetherton [2013] EWCA Civ 1704. Credit hire relates to the recovery of replacement vehicle hire charges (the cost of hiring a car while the damaged vehicle is off the road). If the question mentions "credit repair", "repair costs", "repair quantum", "repair estimate", "repair invoice", "bodyshop costs", "labour rates" (in a repair context), "independent engineer", or "staff engineer", the question is about REPAIR COSTS — not hire charges. Answer using Coles v Hetherton, the obligation to pay principle (Jones v Stroud), the role of independent engineers, ABP rates, and repair quantum principles. Do NOT default to credit hire law (BHR evidence, need for hire, intervention, impecuniosity) unless the question explicitly asks about hire charges as well.
- IMPORTANT — CROSS-HIRE DISCLOSURE: If the question mentions "cross hire", "cross-hire", "Vehicle Replacement Group", "VRG", or involves a situation where a credit hire vehicle was sourced by the CHO from a third-party supplier, you MUST apply the following rule established by Jones v Benger [2014] (Walsall County Court, Case No 3 YQ 53408, HHJ Gregory, Designated Civil Judge, 9 July 2014). There are TWO categories of document with DIFFERENT disclosure obligations: (A) DISCLOSABLE — the credit hire agreement between the claimant and the CHO, including all terms and conditions, and the CHO's invoice to the claimant. This is the contractual basis of the claimed loss and the defendant is entitled to see it. (B) NOT DISCLOSABLE — the cross-hire supply agreement between the CHO and its vehicle supplier (e.g. VRG), and the supplier's invoice to the CHO showing the wholesale rate. Per Jones v Benger, HHJ Gregory held that the CHO's cost of acquiring the vehicle is irrelevant to the measure of the claimant's damages. The cross-hire rate is a function of the CHO's commercial fleet buying power and volume — it is not a rate any individual claimant could have obtained. The proper comparator for testing reasonableness of hire charges is BHR/spot rates evidence, not the CHO's wholesale costs. The application for cross-hire disclosure was dismissed as having no merit. There is no contrary authority. Do NOT advise that the claimant or CHO should disclose the cross-hire agreement, the supplier's invoice, the rate paid by the CHO to its supplier, or any details of the commercial arrangements between the CHO and its vehicle supplier. If the defendant wants to challenge the hire rate, they should obtain their own BHR/spot rates evidence.
- IMPORTANT — HIGHWAY AUTHORITY LIABILITY AND SECTION 58 DEFENCE: If the question involves a pothole, road defect, highway damage, or a claim against a local authority or highway authority for vehicle damage or personal injury caused by the state of the road, you MUST address the statutory framework. Under section 41 of the Highways Act 1980, the highway authority has an absolute duty to maintain the highway. However, under section 58 of the Highways Act 1980, the authority has a statutory defence if it can prove that it had taken such care as was reasonable to secure that the part of the highway in question was not dangerous for traffic. In practice this means the authority must show: (a) it had a reasonable system of inspection in place appropriate to the character and traffic use of the highway; (b) inspections were carried out at reasonable intervals; (c) the defect was not present or not dangerous at the date of the last inspection; and (d) where a defect was identified, a reasonable system of prioritisation and repair was in place. The standard of inspection is judged by what is reasonable, not perfection. If the authority inspected the relevant stretch (say) a week before the incident and the defect was not present or was minor, and the defect then grew to a dangerous size before the next scheduled inspection, the authority will have a good s.58 defence even though the pothole existed at the date of the incident. Video or photographic evidence of the defect on the day of the incident proves only the condition at that moment — it does NOT prove the authority knew or ought to have known about it. The claimant should make a formal request for the authority's inspection records, repair logs, and defect reporting history for the relevant stretch of road. Without this evidence, the claim cannot be properly assessed. Always advise the client that the existence of a pothole does not automatically establish liability — the authority's inspection and repair regime is the critical issue.
- Be concise but thorough: aim for 3-6 paragraphs.
- Do NOT invent cases, rates, or principles not in the database provided.
- Write in clear, professional English suitable for a solicitor or claims handler.
- End with a brief "Key Points" summary as a short bulleted list.`;

  const standardSystemPrompt = `You are a specialist legal research assistant for ${scopeDesc} across England and Wales, Scotland, and Northern Ireland. You have been given a question from a legal practitioner, along with relevant cases and expert commentary from the knowledge base.

QUESTION: ${question}

RELEVANT CASES FROM DATABASE:
${caseBlock}${articleSection}${gtaRateContext}${highwayCodeContext}${termsContext}${locationCtx}

INSTRUCTIONS:
- IMPORTANT — USER PERSPECTIVE: All users of credit-hire.ai act on the CLAIMANT side of credit hire disputes — they are either Credit Hire Organisations (CHOs) pursuing charges against a defendant insurer, or solicitors instructed by a CHO. Answer every question through the claimant's lens. Where a user asks how to argue, address, respond to, or rebut a particular point or stipulation, assume that point has been raised by the DEFENDANT (or its insurer/solicitor/expert) and frame your answer as the rebuttal or counter-argument the user can deploy. Do not interpret the user's question as an admission against the claimant's interest. Do not default to a mitigation lens that assumes the claimant has acted unreasonably. If a user mentions a supplier rate, a maximum hire period, a Part 36 offer, an SDP-only argument, an alternative vehicle, repair delay, or any similar evidential point being raised, the working assumption is that the defendant has raised it and the user wants help defeating it. Only depart from this assumption if the user explicitly states they are acting for the defendant or asking from a defendant's perspective.
- If GTA RATE DATA is provided above and the question asks about a specific GTA group rate, vehicle rate, or daily hire rate, provide the exact rate from the data. State the rate period, the group code, and the daily rate (excluding VAT). Mention any applicable uplifts (automatic, estate, extras). If a specific date is mentioned, use the rate for the period covering that date. If no date is mentioned, provide the current applicable rate.
- If HIGHWAY CODE REFERENCE data is provided above and the question relates to negligence, liability, fault, or contributory negligence, cite the specific Highway Code rules provided with their rule numbers. Distinguish between mandatory rules (MUST/MUST NOT — legal requirements backed by statute, breach is a criminal offence) and advisory rules (should/should not — not an offence but can be evidence of negligence). Reference the Hierarchy of Road Users principle (H1-H3) where relevant to vulnerable road users. Explain how the rules apply to the specific accident scenario described.
- Write a clear, professional legal analysis answering the question, drawing on the cases and expert commentary provided.
- Cite cases by name and citation (e.g. "Lagden v O'Connor [2004] UKHL 36").
- Where "Key paragraphs from judgment" are provided for a case, cite the specific paragraph numbers (e.g. "at §38, Tomlinson LJ held..."). This allows practitioners to go directly to the relevant passage.
- Organise your answer logically: start with the binding authorities (Supreme Court / House of Lords / Court of Appeal), then illustrate with lower court cases.${articleInstruction}${termsInstruction}${locationInstruction}
- IMPORTANT — NORTHERN IRELAND JURISDICTION: Cases from the Northern Ireland High Court (citations containing "NIQB", "NICh", "NICA" or courts described as "High Court of Justice in Northern Ireland") are NOT binding in England and Wales. They may offer helpful and persuasive guidance, but they do not form precedent in the English and Welsh courts. When citing any NI case, you MUST qualify it — e.g. "In the Northern Ireland High Court decision of Smyth v Diamond [2010] NIQB 74, which offers helpful guidance (though not binding in England and Wales)..." or "The NI High Court in Matchett v Hamilton [2011] NIQB 131 — a persuasive but non-binding authority — held that...". Do NOT rely predominantly on NI cases when answering general credit hire questions; always lead with binding England and Wales authorities (UKHL, UKSC, EWCA Civ, EWHC) and use NI cases only as supplementary illustration.
- If the question relates to Scotland or Northern Ireland specifically, use any Scottish or NI materials in the expert commentary and cases provided, and note any differences from the English/Welsh position where relevant.
- IMPORTANT — STEVENS SUPPLIER HIERARCHY: Under Stevens v Equity Syndicate Management [2015] EWCA Civ 93, there is a strict two-tier hierarchy for BHR comparators. TIER 1 (MAINSTREAM NATIONAL): The primary comparator MUST be a recognised mainstream national supplier. The mainstream nationals are FOUR companies only: AVIS, HERTZ, ENTERPRISE and EUROPCAR. These four offer rental services across a wide range of models throughout the United Kingdom. Only if no mainstream national is available in the claimant's locality (geographically absent OR does not offer the requisite vehicle group/category/specification) does the analysis move to Tier 2. TIER 2 (RESPECTED LOCAL): The fallback is a "respected local supplier" which must be BOTH local to the claimant AND respected (evidenced by Trustpilot ratings, Google reviews, Companies House trading history, established physical presence). NOT MAINSTREAM NATIONALS: the following are emphatically NOT Tier 1, even where they have multiple locations: THRIFTY (limited coverage), SIXT (predominantly airport-based), PCH (niche), EVISION (electric, niche), DRIVALIA (regional), BUDGET (part of the Avis Group but materially fewer locations than Avis), ARNOLD CLARK (limited coverage), AMT (a few regional locations only). If cited in BHR evidence, these can only qualify as Tier 2 comparators — and only if they are both local to the claimant AND respected. CRITICAL REBUTTAL HOOK: where a defendant's rate witness cites a non-mainstream supplier and a mainstream national WAS available in the claimant's locality at the relevant date, the rate witness has skipped Tier 1. This is typically a deceitful attempt to advance a rate lower than the rate the claimant would actually have paid in the open market. Challenge it directly: invite the rate witness to confirm whether mainstream nationals were locally available and, if so, why their rates were not cited. Always apply this hierarchy when answering questions about supplier qualification.
- IMPORTANT — MOTORCYCLE / MOTORBIKE / SCOOTER / E-BIKE BHR: When the claim involves a motorcycle, motorbike, scooter, moped, e-bike or any two-wheeled hire vehicle, the Stevens hierarchy effectively COLLAPSES. There are NO mainstream national motorcycle hire providers in the UK — Avis, Hertz, Enterprise, Europcar, Sixt and Budget do not hire motorcycles. Tier 1 of Stevens is therefore unavailable in every motorcycle BHR analysis. The defendant's only available comparator is at Tier 2 (respected local supplier) — examples include Raceways Motorcycles, Superbike Rental Ltd, Ugo Scooters, Omega Bikes, Rent a Scoot. The "respected" requirement is the dominant test. There is also a STRUCTURAL DIFFERENCE in insurance cover that almost always defeats the comparator on like-for-like grounds. (a) CAR BHR: mainstream and respected local car hire providers offer COMPREHENSIVE insurance with an excess that the hirer can waive by paying an additional CDW / excess waiver fee. (b) MOTORCYCLE BHR: motorcycle hire companies typically offer only THIRD-PARTY insurance — the hirer remains personally liable for theft of the bike and for any damage caused to the bike where the hirer is at fault. Comprehensive cover is unusual or unavailable, and where available is very expensive. (c) CREDIT HIRE motorcycle agreements almost always include comprehensive cover with ZERO excess. The claimant under a credit hire agreement therefore has the benefit of cover that no respected local motorcycle BHR provider offers on equivalent terms. The comparator is not like-for-like and on this ground alone the BHR rate quoted by a defendant for a motorcycle hire can usually be discounted entirely. Always raise BOTH points: (i) the Stevens mainstream tier is unavailable for motorcycles, and (ii) the local motorcycle BHR comparator does not provide insurance on equivalent terms to the credit hire agreement and therefore fails the like-for-like equivalence test in Pattni and Bent v Highways and Utilities Construction [2012] RTR 17.
- IMPORTANT — CREDIT REPAIR vs CREDIT HIRE DISTINCTION: "Credit repair" and "credit hire" are entirely different heads of loss. Credit repair relates to the recovery of vehicle repair costs (the cost of fixing the damaged vehicle), governed primarily by Coles v Hetherton [2013] EWCA Civ 1704. Credit hire relates to the recovery of replacement vehicle hire charges (the cost of hiring a car while the damaged vehicle is off the road), governed by Dimond v Lovell, Clark v Ardington, Stevens v Equity, etc. If the question mentions "credit repair", "repair costs", "repair quantum", "repair estimate", "repair invoice", "bodyshop costs", "labour rates" (in a repair context), "independent engineer", or "staff engineer", the question is about REPAIR COSTS — not hire charges. Answer using Coles v Hetherton, the obligation to pay principle (Jones v Stroud), the role of independent engineers, ABP rates, and repair quantum principles. Do NOT default to credit hire law (BHR evidence, need for hire, intervention, impecuniosity) unless the question explicitly asks about hire charges as well.
- IMPORTANT — CROSS-HIRE DISCLOSURE: If the question mentions "cross hire", "cross-hire", "Vehicle Replacement Group", "VRG", or involves a situation where a credit hire vehicle was sourced by the CHO from a third-party supplier, you MUST apply the following rule established by Jones v Benger [2014] (Walsall County Court, Case No 3 YQ 53408, HHJ Gregory, Designated Civil Judge, 9 July 2014). There are TWO categories of document with DIFFERENT disclosure obligations: (A) DISCLOSABLE — the credit hire agreement between the claimant and the CHO, including all terms and conditions, and the CHO's invoice to the claimant. This is the contractual basis of the claimed loss and the defendant is entitled to see it. (B) NOT DISCLOSABLE — the cross-hire supply agreement between the CHO and its vehicle supplier (e.g. VRG), and the supplier's invoice to the CHO showing the wholesale rate. Per Jones v Benger, HHJ Gregory held that the CHO's cost of acquiring the vehicle is irrelevant to the measure of the claimant's damages. The cross-hire rate is a function of the CHO's commercial fleet buying power and volume — it is not a rate any individual claimant could have obtained. The proper comparator for testing reasonableness of hire charges is BHR/spot rates evidence, not the CHO's wholesale costs. The application for cross-hire disclosure was dismissed as having no merit. There is no contrary authority. Do NOT advise that the claimant or CHO should disclose the cross-hire agreement, the supplier's invoice, the rate paid by the CHO to its supplier, or any details of the commercial arrangements between the CHO and its vehicle supplier. If the defendant wants to challenge the hire rate, they should obtain their own BHR/spot rates evidence.
- IMPORTANT — HIGHWAY AUTHORITY LIABILITY AND SECTION 58 DEFENCE: If the question involves a pothole, road defect, highway damage, or a claim against a local authority or highway authority for vehicle damage or personal injury caused by the state of the road, you MUST address the statutory framework. Under section 41 of the Highways Act 1980, the highway authority has an absolute duty to maintain the highway. However, under section 58 of the Highways Act 1980, the authority has a statutory defence if it can prove that it had taken such care as was reasonable to secure that the part of the highway in question was not dangerous for traffic. In practice this means the authority must show: (a) it had a reasonable system of inspection in place appropriate to the character and traffic use of the highway; (b) inspections were carried out at reasonable intervals; (c) the defect was not present or not dangerous at the date of the last inspection; and (d) where a defect was identified, a reasonable system of prioritisation and repair was in place. The standard of inspection is judged by what is reasonable, not perfection. If the authority inspected the relevant stretch (say) a week before the incident and the defect was not present or was minor, and the defect then grew to a dangerous size before the next scheduled inspection, the authority will have a good s.58 defence even though the pothole existed at the date of the incident. Video or photographic evidence of the defect on the day of the incident proves only the condition at that moment — it does NOT prove the authority knew or ought to have known about it. The claimant should make a formal request for the authority's inspection records, repair logs, and defect reporting history for the relevant stretch of road. Without this evidence, the claim cannot be properly assessed. Always advise the client that the existence of a pothole does not automatically establish liability — the authority's inspection and repair regime is the critical issue.
- Be concise but thorough: aim for 3-6 paragraphs.
- Do NOT invent cases, paragraph numbers, or principles not in the database provided. If the database cases don't fully answer the question, say so — but first check all cases and expert commentary provided for relevant Scottish, NI or jurisdiction-specific material before saying material is absent.
- Write in clear, professional English suitable for a solicitor or claims handler.
- End with a brief "Key Points" summary as a short bulleted list.`;

  return scope === 'bhr' ? bhrSystemPrompt : standardSystemPrompt;
}

// Truncate a prior answer to keep the follow-up prompt within sensible
// token bounds. Most original answers are well under this; we cap to
// avoid runaway prompt growth across multiple follow-ups.
function _truncate(text, max = 4000) {
  if (!text) return '';
  return text.length <= max ? text : (text.slice(0, max) + '\n[... earlier answer truncated ...]');
}

// Build the prompt for a follow-up turn. The model sees the original Q&A
// (and any prior follow-ups) as context, plus a small fresh retrieval in
// case the follow-up names a case or angle that wasn't in the first pass.
// The behavioural rules are deliberately strict: be concise, draft what
// the user asks for, no Republic of Ireland authorities unless NI is
// stipulated, build on prior research rather than redoing it.
function buildFollowupPrompt(question, history, cases, scope, articles, locationContext) {
  // history[0] is the original Q&A; entries 1..N are prior follow-ups.
  const original = history[0] || {};
  const priorFollowups = history.slice(1);

  const conversationBlock = [
    `The user originally asked:\n"${(original.question || '').trim()}"`,
    `\nYou answered:\n${_truncate(original.answer || '')}`,
    ...priorFollowups.map((h, i) => (
      `\n[Follow-up ${i + 1}]\nUser: ${(h.question || '').trim()}\nYou answered: ${_truncate(h.answer || '', 2500)}`
    )),
  ].join('\n');

  // Lightly include any newly retrieved cases / articles. If the lighter
  // retrieval found nothing, we omit these blocks rather than padding the
  // prompt.
  let extraContext = '';
  if (cases && cases.length) {
    const caseBlock = cases.map((c, i) => {
      const parts = [
        `Case ${i + 1}: ${c.case_name}`,
        c.citation ? `Citation: ${c.citation}` : null,
        c.court ? `Court: ${c.court}` : null,
        c.year ? `Year: ${c.year}` : null,
        c.summary ? `Summary: ${(c.summary || '').slice(0, 800)}` : null,
      ].filter(Boolean);
      return parts.join('\n');
    }).join('\n\n---\n\n');
    extraContext += `\n\nADDITIONAL CASES THAT MAY BE RELEVANT TO THIS FOLLOW-UP:\n${caseBlock}`;
  }
  if (articles && articles.length) {
    const articleBlock = articles.map((a, i) => {
      const rawKp = a.key_principles || a.key_points || a.principles || [];
      const kps = Array.isArray(rawKp) ? rawKp.slice(0, 6).map(p => `  - ${p}`).join('\n') : null;
      const fullTextSrc = a.full_text || a.content || null;
      const summaryText = a.summary || (fullTextSrc ? fullTextSrc.slice(0, 1500) + (fullTextSrc.length > 1500 ? '...' : '') : null);
      const parts = [
        `${i + 1}. "${a.title}"`,
        a.author ? `Author: ${a.author}` : (a.source ? `Source: ${a.source}` : null),
        summaryText ? `Summary: ${summaryText}` : null,
        kps ? `Key points:\n${kps}` : null,
      ].filter(Boolean);
      return parts.join('\n');
    }).join('\n\n');
    extraContext += `\n\nADDITIONAL COMMENTARY THAT MAY BE RELEVANT:\n${articleBlock}`;
  }
  if (locationContext) {
    extraContext += `\n\nLOCATION CONTEXT:\n${locationContext}`;
  }

  return `You are assisting a credit hire practitioner who has already received a research answer from this tool. They are now asking a focused follow-up — usually a clarification, or a request to draft something (a paragraph for a reply, a response to a defendant's solicitor, a few lines for a witness statement, etc.).

Treat this as a continuation, not a fresh question.

HARD RULES:
1. Default jurisdiction is England & Wales. Do NOT cite Republic of Ireland authorities. Northern Ireland authorities may only be cited if the user has explicitly stated the matter is in Northern Ireland.
2. Do not redo the research. Build on the answer the user already has. Reference cases by name only when the point genuinely depends on them; one or two well-chosen citations beat a list.
3. Match the register the user asks for. If they want "a paragraph for my reply", produce a paragraph that reads like a paragraph for a reply — not an essay, not a research note. If they want correspondence, write in solicitor-to-solicitor tone.
4. Be concise. Aim for the shortest answer that does the job.
5. Answer from the claimant's perspective by default. Switch to the defendant's perspective only if the user explicitly asks for it.

CONVERSATION SO FAR:

${conversationBlock}
${extraContext}

USER'S FOLLOW-UP NOW:
${question}

Now answer the user's follow-up, applying the rules above.`;
}

// ── Server-Sent Events helpers ──
// We stream the AI answer to the browser as SSE so the user sees
// tokens appear within 2–3 seconds instead of waiting for the whole
// response to buffer (previously ~30s).
function sseSetup(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable proxy buffering
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  res.write(': connected\n\n'); // initial comment so the client sees the stream open
}

function sseWrite(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Send a short one-shot answer as a single-event stream. Used for
// edge cases like "no database available" or "no matches found" so
// the client has one code path for all 200 responses.
function sendSimpleStream(res, answerText, cases = [], articles = []) {
  sseSetup(res);
  sseWrite(res, 'delta', { text: answerText });
  sseWrite(res, 'meta', { cases, articles, stop_reason: 'end_turn' });
  sseWrite(res, 'done', { ok: true });
  res.end();
}

// ── Verify Supabase JWT ──
async function verifyAuth(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const resp = await fetch(`${url}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': key,
      },
    });
    if (!resp.ok) return null;
    const user = await resp.json();
    return user?.id ? user : null;
  } catch (_) {
    return null;
  }
}

// ── Main handler ──
export default async function handler(req, res) {
  // CORS headers — restrict to own domain
  const allowedOrigins = ['https://credit-hire.ai', 'https://www.credit-hire.ai'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Allow same-origin requests (no origin header) from Vercel deployment
    res.setHeader('Access-Control-Allow-Origin', 'https://credit-hire.ai');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Authenticate the request
  const user = await verifyAuth(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorised. Please sign in.' });
    return;
  }

  const { question, database, mode, history } = req.body || {};
  if (!question || typeof question !== 'string' || question.trim().length < 5) {
    res.status(400).json({ error: 'Please provide a valid question.' });
    return;
  }

  const scope = ['liability', 'both', 'credit_hire', 'bhr'].includes(database) ? database : 'credit_hire';

  // Follow-up mode: lighter retrieval, conversational prompt that builds on
  // the prior research rather than redoing it. History must be an array of
  // { question, answer } pairs ordered oldest-first; max 3 follow-ups
  // enforced server-side as a safety net (the client also enforces it).
  const isFollowup = mode === 'followup';
  if (isFollowup) {
    if (!Array.isArray(history) || history.length < 1 || history.length > 4) {
      res.status(400).json({ error: 'Invalid follow-up history.' });
      return;
    }
    // history[0] is the original Q&A; entries 1..N are prior follow-ups.
    // Cap at 3 follow-ups (so history length is at most 4 = original + 3).
    if (history.length > 4) {
      res.status(400).json({ error: 'Maximum follow-ups for this thread reached.' });
      return;
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY environment variable is not set.' });
    return;
  }

  try {
    const db = getDatabase(scope);

    if (!db) {
      return sendSimpleStream(
        res,
        'The liability database is not yet available. It will be added shortly.'
      );
    }

    const bhrMode = scope === 'bhr';
    const qTrimmed = question.trim();

    // Kick off the async location lookup FIRST so its network I/O
    // (postcodes.io + Supabase) overlaps with the synchronous retrieval
    // below. Small but real win (~50–200ms on postcode queries).
    const locationCtxPromise = buildLocationContext(qTrimmed);

    // Lighter retrieval for follow-ups: a focused query may surface a case
    // we don't yet hold, but we don't want to drown the model in 12 cases
    // when most of the answer already exists in the prior research.
    const caseTopN    = isFollowup ? 5 : 12;
    const articleTopN = isFollowup ? 3 : 5;

    const relevantCases = findRelevantCases(qTrimmed, db, caseTopN, bhrMode);

    // Also search knowledge base — BHR mode gets boosted article retrieval
    const relevantArticles = scope !== 'liability'
      ? findRelevantArticles(qTrimmed, getKnowledgeDb(), articleTopN, bhrMode)
      : [];

    const locationCtx = (await locationCtxPromise) || '';

    // For an original query, no retrieval hits is fatal. For a follow-up
    // the prior research is already on screen, so an empty retrieval is
    // fine — the model can still answer (e.g. "draft a paragraph for my
    // reply") leaning on the previous answer.
    if (!isFollowup && !relevantCases.length && !relevantArticles.length && !locationCtx) {
      return sendSimpleStream(
        res,
        'No closely matching cases were found in the database for your query. Try rephrasing with different keywords, or browse the case library directly.'
      );
    }

    const client = new Anthropic({ apiKey });
    const prompt = isFollowup
      ? buildFollowupPrompt(qTrimmed, history, relevantCases, scope, relevantArticles, locationCtx)
      : buildPrompt(qTrimmed, relevantCases, scope, relevantArticles, locationCtx);

    // Pre-build citation payloads so they're ready to send the instant
    // the stream finishes.
    const casesForClient = relevantCases.map(({ _score, ...c }) => ({
      case_name: c.case_name,
      citation: c.citation,
      court: c.court,
      year: c.year,
    }));
    const articlesForClient = relevantArticles.map(({ _score, full_text, ...a }) => ({
      title: a.title,
      author: a.author,
      date: a.date,
      pdf_url: a.pdf_url,
    }));

    // Retry up to 3 times on transient overloaded / rate-limit errors
    // when STARTING the stream. Once tokens begin flowing we can't
    // cleanly retry, so mid-stream errors are surfaced to the client.
    let stream;
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        stream = client.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4500,
          messages: [{ role: 'user', content: prompt }]
        });
        break;
      } catch (apiErr) {
        const status = apiErr?.status || apiErr?.error?.status;
        const isRetryable = status === 429 || status === 529 || status === 503;
        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = attempt * 2000; // 2s, 4s
          console.warn(`Anthropic API ${status} on attempt ${attempt}/${MAX_RETRIES} — retrying in ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw apiErr;
      }
    }

    // Headers must be set BEFORE the first write. Up to this point any
    // thrown error still falls to the JSON catch block below.
    sseSetup(res);

    let stopReason = null;
    try {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          const text = event.delta.text || '';
          if (text) sseWrite(res, 'delta', { text });
        } else if (event.type === 'message_delta' && event.delta?.stop_reason) {
          stopReason = event.delta.stop_reason;
        }
      }
    } catch (streamErr) {
      console.error('Mid-stream error:', streamErr);
      sseWrite(res, 'error', { message: streamErr.message || 'Stream interrupted' });
      res.end();
      return;
    }

    sseWrite(res, 'meta', {
      cases: casesForClient,
      articles: articlesForClient,
      stop_reason: stopReason,
    });
    sseWrite(res, 'done', { ok: true });

    // Log the query anonymously (non-blocking)
    logQuery(qTrimmed, scope, relevantCases.length, relevantArticles.length, stopReason);

    res.end();

  } catch (e) {
    console.error('API error:', e);
    // If headers aren't flushed yet we can still return a JSON error.
    // Once streaming starts we handle errors inside the inner try.
    if (!res.headersSent) {
      res.status(500).json({ error: e.message || 'An unexpected error occurred.' });
    } else {
      try { sseWrite(res, 'error', { message: e.message || 'Server error' }); } catch {}
      try { res.end(); } catch {}
    }
  }
}
