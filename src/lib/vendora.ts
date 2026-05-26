/**
 * Vendora API client — http://45.77.79.14
 * Uses /v3/businesses/search to match maintenance requests to local vendors.
 */

export const VENDORA_BASE_URL = 'http://45.77.79.14'
const VENDORA_API_KEY = 'vnd_3f287c6827bd4eab78470bce9b791dc4e9f5134099ddb3b2ac8ad29dca7f'

// ─── Public types (used by VendorPanel) ──────────────────────────────────────

export interface VendorResult {
  vendor_id: string
  canonical_name: string
  primary_category_code: string
  category_display_name: string | null
  score_tier: string | null
  vendor_score: number | null
  is_licensed: boolean | null
  is_insured: boolean | null
  is_onboarded: boolean
  primary_phone: string | null
  website_url: string | null
  city: string | null
  state: string | null
  zip: string | null
  years_in_business: number | null
  avg_rating: number | null
  total_review_count: number
  distance_miles: number | null
}

export interface BidResult {
  vendor_id: string
  vendor_name: string
  bid_id: string | null
  status: 'sent' | 'viewed' | 'quoted' | 'declined' | 'closed' | 'error'
  sent_at?: string
  error?: string
}

export interface BidStatusRow {
  bid_id: string
  vendor_id: string
  vendor_name: string
  status: string
  sent_at: string
  viewed_at: string | null
  responded_at: string | null
  completed_at: string | null
  agreed_amount: number | null
  landlord_rating: number | null
  landlord_review: string | null
  unread_messages: number
  responses: Array<{
    response_type: string
    message: string
    quote_amount: number | null
    availability: string | null
    created_at: string
  }> | null
}

// ─── Raw API shapes ───────────────────────────────────────────────────────────

/** A single business object as returned by /v3/businesses/search */
interface RawBusiness {
  // Core Yelp-style fields
  id?: string
  name?: string
  categories?: Array<{ alias?: string; title?: string }>
  rating?: number | null
  review_count?: number
  phone?: string | null
  display_phone?: string | null
  url?: string | null
  location?: {
    city?: string | null
    state?: string | null
    zip_code?: string | null
    address1?: string | null
  }
  // Vendora-specific scoring/compliance sub-object
  vendora?: {
    vendor_score?: number | null
    score_tier?: string | null
    is_licensed?: boolean | null
    is_insured?: boolean | null
    years_in_business?: number | null
    quality_score?: number | null
    compliance_score?: number | null
    reputation_score?: number | null
    bbb_accredited?: boolean | null
    bbb_rating?: string | null
  }
  // Flat fallback fields (if API returns them at top level)
  vendor_id?: string
  canonical_name?: string
  primary_category_code?: string | null
  category_display_name?: string | null
  score_tier?: string | null
  vendor_score?: number | null
  avg_rating?: number | null
  total_review_count?: number
  is_licensed?: boolean | null
  is_insured?: boolean | null
  is_onboarded?: boolean
  years_in_business?: number | null
  primary_phone?: string | null
  website_url?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  distance_miles?: number | null
}

interface BusinessSearchResponse {
  businesses: RawBusiness[]
  total: number
  matched_category?: string | null
  bid_results?: BidResult[]
  region?: { zip_code?: string; state?: string; distance_miles?: number }
}

/** Normalise the raw API shape into the VendorResult the UI expects. */
function normalizeVendor(b: RawBusiness): VendorResult {
  const v = b.vendora  // Vendora-specific sub-object
  return {
    vendor_id:             b.id              ?? b.vendor_id              ?? '',
    canonical_name:        b.name            ?? b.canonical_name          ?? '',
    primary_category_code: b.primary_category_code ?? b.categories?.[0]?.alias ?? '',
    category_display_name: b.category_display_name ?? b.categories?.[0]?.title ?? null,
    // Prefer nested vendora.* fields; fall back to flat top-level fields
    score_tier:            v?.score_tier     ?? b.score_tier             ?? null,
    vendor_score:          v?.vendor_score   ?? b.vendor_score           ?? null,
    is_licensed:           v?.is_licensed    ?? b.is_licensed            ?? null,
    is_insured:            v?.is_insured     ?? b.is_insured             ?? null,
    is_onboarded:          b.is_onboarded    ?? false,
    years_in_business:     v?.years_in_business ?? b.years_in_business   ?? null,
    // Contact / location
    primary_phone:         b.display_phone   ?? b.phone ?? b.primary_phone ?? null,
    website_url:           b.website_url     ?? b.url                    ?? null,
    city:                  b.city            ?? b.location?.city         ?? null,
    state:                 b.state           ?? b.location?.state        ?? null,
    zip:                   b.zip             ?? b.location?.zip_code     ?? null,
    // Ratings & distance
    avg_rating:            b.avg_rating      ?? b.rating                 ?? null,
    total_review_count:    b.total_review_count ?? b.review_count        ?? 0,
    distance_miles:        b.distance_miles  ?? null,
  }
}

// ─── Keyword → Category mapping ──────────────────────────────────────────────
// Evaluated top-to-bottom; first match wins. More specific phrases come first.

const KEYWORD_MAP: Array<{ keywords: string[]; code: string }> = [
  // PLUMBING
  { keywords: ['burst pipe', 'flood', 'water emergency', 'water gushing', 'water everywhere'], code: 'PLB.EMR' },
  { keywords: ['water heater', 'hot water', 'no hot water', 'boiler', 'tankless'], code: 'PLB.WHR' },
  { keywords: ['drain', 'clog', 'clogged', 'blocked drain', 'rooter', 'slow drain'], code: 'PLB.DRN' },
  { keywords: ['plumb', 'pipe', 'toilet', 'sink', 'faucet', 'leak', 'water line', 'fixture', 'dripping', 'running water'], code: 'PLB.GEN' },

  // HVAC
  { keywords: ['air condition', 'ac not', 'ac is', 'no cooling', 'cooling system', 'compressor', 'refrigerant', 'too hot'], code: 'HVC.ACR' },
  { keywords: ['no heat', 'furnace', 'heating not', 'heat not', 'heat pump', 'gas heat', 'too cold'], code: 'HVC.HEA' },
  { keywords: ['duct cleaning', 'air duct', 'ventilation', 'mini split', 'ductless'], code: 'HVC.DCL' },
  { keywords: ['hvac', 'ac tune', 'hvac maintenance', 'filter', 'annual service'], code: 'HVC.MNT' },

  // ELECTRICAL
  { keywords: ['no power', 'power out', 'power outage', 'sparks', 'burning smell', 'electrical emergency'], code: 'ELC.EMR' },
  { keywords: ['electric', 'outlet', 'switch', 'breaker', 'wiring', 'circuit', 'light not', 'panel', 'tripping'], code: 'ELC.GEN' },

  // ROOFING
  { keywords: ['roof leak', 'roof repair', 'shingle', 'flashing', 'ceiling leak', 'leaking roof'], code: 'ROF.REP' },
  { keywords: ['gutter', 'downspout'], code: 'ROF.GUT' },

  // MOLD / WATER DAMAGE
  { keywords: ['mold', 'mildew', 'black mold', 'fungus'], code: 'MLD.REM' },
  { keywords: ['water damage', 'flood damage', 'water stain', 'wet ceiling', 'wet floor', 'water intrusion'], code: 'WDM.RST' },

  // PEST CONTROL
  { keywords: ['termite', 'wood destroying'], code: 'PST.TRM' },
  { keywords: ['bed bug', 'bedbug'], code: 'PST.BED' },
  { keywords: ['mouse', 'mice', 'rat', 'rodent', 'squirrel'], code: 'PST.ROD' },
  { keywords: ['pest', 'bug', 'cockroach', 'roach', 'ant', 'spider', 'insect', 'exterminator'], code: 'PST.GEN' },

  // LOCKSMITH
  { keywords: ['lockout', 'locked out', 'emergency lock'], code: 'LCK.EMR' },
  { keywords: ['rekey', 're-key', 'rekeying', 'change lock'], code: 'LCK.RKY' },
  { keywords: ['lock install', 'deadbolt', 'smart lock', 'lock replacement'], code: 'LCK.INS' },
  { keywords: ['lock', 'key'], code: 'LCK.RKY' },

  // APPLIANCES
  { keywords: ['fridge', 'refrigerator', 'freezer', 'ice maker'], code: 'APP.REF' },
  { keywords: ['washer', 'dryer', 'washing machine', 'laundry appliance'], code: 'APP.WDR' },
  { keywords: ['dishwasher'], code: 'APP.DWS' },
  { keywords: ['oven', 'stove', 'range', 'burner', 'cooktop', 'microwave'], code: 'APP.OVN' },
  { keywords: ['appliance'], code: 'APP.REF' },

  // CLEANING
  { keywords: ['carpet clean', 'steam clean', 'rug'], code: 'CLN.CAR' },
  { keywords: ['pressure wash', 'power wash'], code: 'CLN.PWS' },
  { keywords: ['window wash', 'window clean'], code: 'CLN.WIN' },
  { keywords: ['move out clean', 'move-out clean', 'turnover clean', 'deep clean'], code: 'CLN.MOV' },
  { keywords: ['clean'], code: 'CLN.DEP' },

  // PAINTING
  { keywords: ['paint', 'peeling', 'wall paint', 'ceiling paint'], code: 'PNT.INT' },

  // FLOORING
  { keywords: ['hardwood', 'wood floor', 'floor sand', 'refinish floor'], code: 'FLR.HRD' },
  { keywords: ['tile', 'grout', 'porcelain', 'ceramic floor'], code: 'FLR.TIL' },
  { keywords: ['vinyl floor', 'lvp', 'laminate floor'], code: 'FLR.LVP' },
  { keywords: ['carpet install', 'new carpet'], code: 'FLR.CAR' },
  { keywords: ['floor', 'flooring'], code: 'FLR.HRD' },

  // WINDOWS & DOORS
  { keywords: ['broken window', 'window glass', 'cracked glass', 'glass repair'], code: 'WND.GLS' },
  { keywords: ['door', 'sliding door', 'garage door', 'front door'], code: 'WND.DOR' },
  { keywords: ['window'], code: 'WND.REP' },

  // DRYWALL / REMODELING
  { keywords: ['drywall', 'wall hole', 'sheetrock', 'wall crack', 'plaster'], code: 'GCT.DRY' },
  { keywords: ['remodel', 'renovation', 'kitchen remodel', 'bathroom remodel'], code: 'GCT.REM' },

  // LANDSCAPING
  { keywords: ['snow', 'ice removal', 'de-icing', 'driveway snow'], code: 'LND.SNW' },
  { keywords: ['tree', 'branch', 'stump', 'arborist'], code: 'LND.TRE' },
  { keywords: ['sprinkler', 'irrigation', 'lawn water'], code: 'LND.IRR' },
  { keywords: ['lawn', 'grass', 'mow', 'yard', 'landscape'], code: 'LND.LAW' },

  // POOL
  { keywords: ['pool', 'hot tub', 'spa', 'jacuzzi'], code: 'POL.REP' },

  // JUNK
  { keywords: ['junk', 'haul', 'debris', 'trash removal', 'old furniture'], code: 'JNK.RMV' },

  // HANDYMAN — catch-all
  { keywords: ['repair', 'broken', 'fix', 'handyman', 'maintenance', 'damaged', 'not working'], code: 'HND.GEN' },
]

/**
 * Infer the most relevant Vendora category code from a maintenance request title.
 * Returns null if no keyword matches.
 */
export function mapTitleToCategoryCode(title: string): string | null {
  const lower = title.toLowerCase()
  for (const { keywords, code } of KEYWORD_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) return code
  }
  return null
}

// ─── API calls ────────────────────────────────────────────────────────────────

const HEADERS = { Authorization: `Bearer ${VENDORA_API_KEY}` }

/** Fetch vendors matching a maintenance request. Returns vendors sorted onboarded-first. */
export async function fetchVendors(params: {
  term?: string | null
  zip_code?: string | null
  distance?: number          // miles radius, default 50
  limit?: number
  sort_by?: string
}): Promise<{ vendors: VendorResult[]; matchedCategory: string | null }> {
  const url = new URL(`${VENDORA_BASE_URL}/v3/businesses/search`)
  if (params.term)     url.searchParams.set('term',     params.term)
  if (params.zip_code) url.searchParams.set('zip_code', params.zip_code)
  url.searchParams.set('distance', String(params.distance ?? 50))
  url.searchParams.set('sort_by',  params.sort_by ?? 'best_match')
  url.searchParams.set('limit',    String(params.limit ?? 30))

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12000), headers: HEADERS })
  if (!res.ok) throw new Error(`Vendora API returned ${res.status}`)
  const json: BusinessSearchResponse = await res.json()
  return {
    vendors: (json.businesses ?? []).map(normalizeVendor),
    matchedCategory: json.matched_category ?? null,
  }
}

/** Send bid requests to all onboarded vendors for a maintenance request. */
export async function sendBidRequests(params: {
  zip_code?: string | null
  term: string
  distance?: number
  // LeaseLoft context
  maintenance_request_id: string
  lease_id: string
  landlord_id: string
  description?: string | null
  priority?: string | null
  property_name?: string | null
  unit_label?: string | null
  address?: string | null
}): Promise<{ vendors: VendorResult[]; bidResults: BidResult[] }> {
  const url = new URL(`${VENDORA_BASE_URL}/v3/businesses/search`)
  url.searchParams.set('term',                    params.term)
  url.searchParams.set('bid_request',             'true')
  url.searchParams.set('maintenance_request_id',  params.maintenance_request_id)
  url.searchParams.set('lease_id',                params.lease_id)
  url.searchParams.set('landlord_id',             params.landlord_id)
  if (params.zip_code)      url.searchParams.set('zip_code',      params.zip_code)
  if (params.distance)      url.searchParams.set('distance',      String(params.distance))
  if (params.description)   url.searchParams.set('description',   params.description)
  if (params.priority)      url.searchParams.set('priority',      params.priority)
  if (params.property_name) url.searchParams.set('property_name', params.property_name)
  if (params.unit_label)    url.searchParams.set('unit_label',    params.unit_label)
  if (params.address)       url.searchParams.set('address',       params.address)
  url.searchParams.set('limit', '50')

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000), headers: HEADERS })
  if (!res.ok) throw new Error(`Vendora API returned ${res.status}`)
  const json: BusinessSearchResponse = await res.json()
  return {
    vendors: (json.businesses ?? []).map(normalizeVendor),
    bidResults: json.bid_results ?? [],
  }
}

/** Poll the current status of all bids for a maintenance request. */
export async function fetchBidStatus(maintenanceRequestId: string): Promise<BidStatusRow[]> {
  const url = new URL(`${VENDORA_BASE_URL}/v3/bid-status`)
  url.searchParams.set('maintenance_request_id', maintenanceRequestId)
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000), headers: HEADERS })
  if (!res.ok) throw new Error(`Vendora API returned ${res.status}`)
  const json = await res.json()
  return json.bids ?? []
}

// ─── Bid messages ─────────────────────────────────────────────────────────────

export interface BidMessage {
  message_id: string
  bid_id: string
  sender_type: 'landlord' | 'vendor'
  sender_id: string
  message: string
  is_read: boolean
  created_at: string
}

/** Fetch the message thread for a specific bid. */
export async function fetchBidMessages(bidId: string): Promise<BidMessage[]> {
  const url = new URL(`${VENDORA_BASE_URL}/v3/bid-messages`)
  url.searchParams.set('bid_id', bidId)
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000), headers: HEADERS })
  if (!res.ok) throw new Error(`Vendora API returned ${res.status}`)
  const json = await res.json()
  return json.messages ?? []
}

/** Award the job to one vendor; closes all other bids for the same request. */
export async function awardBid(params: {
  bid_id: string
  maintenance_request_id: string
  landlord_id: string
  note?: string
}): Promise<{ awarded_bid_id: string; awarded_vendor: string; closed_bid_count: number }> {
  const url = new URL(`${VENDORA_BASE_URL}/v3/award-bid`)
  const res = await fetch(url.toString(), {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(`Vendora API returned ${res.status}`)
  return res.json()
}

/** Complete a job: mark done, rate vendor, release escrow. Also returns info for updating Supabase. */
export async function completeJob(params: {
  bid_id: string
  maintenance_request_id: string
  landlord_id: string
  landlord_rating?: number | null
  landlord_review?: string | null
}): Promise<{
  completed_bid_id: string
  vendor_name: string
  agreed_amount: number | null
  landlord_rating: number | null
  escrow_released: boolean
}> {
  const url = new URL(`${VENDORA_BASE_URL}/v3/complete-job`)
  const res = await fetch(url.toString(), {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(`Vendora API returned ${res.status}`)
  return res.json()
}

/** Send a message from the landlord to a vendor on a specific bid. */
export async function sendBidMessage(
  bidId: string,
  message: string,
  landlordId: string,
): Promise<BidMessage> {
  const url = new URL(`${VENDORA_BASE_URL}/v3/bid-messages`)
  const res = await fetch(url.toString(), {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bid_id: bidId, message, sender_type: 'landlord', sender_id: landlordId }),
  })
  if (!res.ok) throw new Error(`Vendora API returned ${res.status}`)
  return res.json()
}
