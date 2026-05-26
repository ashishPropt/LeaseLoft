import { useEffect, useRef, useState } from "react"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Phone, Globe, MapPin, ShieldCheck, Star,
  AlertCircle, Building2, Send, RefreshCw, CheckCircle2,
  Clock, Eye, XCircle, MessageSquare, ChevronDown, ChevronUp,
  DollarSign, CalendarClock, HelpCircle, Trophy, ClipboardCheck,
} from "lucide-react"
import {
  fetchVendors, sendBidRequests, fetchBidStatus,
  fetchBidMessages, sendBidMessage, awardBid, completeJob,
  VendorResult, BidResult, BidStatusRow, BidMessage,
  VENDORA_BASE_URL,
} from "@/lib/vendora"
import { supabase } from "@/integrations/supabase/client"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MaintenanceItem {
  id: string
  title: string
  description?: string | null
  priority?: string | null
  status: string
  tenant: string
  unit: string
  lease_id: string
  landlord_id: string
  property_name?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}

interface Props {
  item: MaintenanceItem | null
  open: boolean
  onClose: () => void
  onComplete?: () => void   // called after a job is successfully marked complete
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<string, { label: string; className: string }> = {
  A: { label: "Preferred",    className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  B: { label: "Qualified",    className: "bg-blue-100 text-blue-800 border-blue-200" },
  C: { label: "Provisional",  className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  D: { label: "Unverified",   className: "bg-orange-100 text-orange-800 border-orange-200" },
  F: { label: "Disqualified", className: "bg-red-100 text-red-800 border-red-200" },
}

const BID_STATUS_CONFIG: Record<string, { label: string; icon: any; className: string }> = {
  sent:      { label: "Sent",      icon: Send,          className: "bg-blue-50 text-blue-700 border-blue-200" },
  viewed:    { label: "Viewed",    icon: Eye,           className: "bg-purple-50 text-purple-700 border-purple-200" },
  quoted:    { label: "Quoted",    icon: CheckCircle2,  className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  awarded:   { label: "Awarded",   icon: Trophy,        className: "bg-amber-50 text-amber-700 border-amber-300" },
  completed: { label: "Completed", icon: ClipboardCheck, className: "bg-green-50 text-green-700 border-green-300" },
  declined:  { label: "Declined",  icon: XCircle,       className: "bg-red-50 text-red-700 border-red-200" },
  closed:    { label: "Closed",    icon: XCircle,       className: "bg-muted text-muted-foreground border-border" },
  pending:   { label: "Pending",   icon: Clock,         className: "bg-muted text-muted-foreground border-border" },
}

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null
  const cfg = TIER_CONFIG[tier] ?? { label: tier, className: "bg-muted text-muted-foreground" }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.className}`}>
      {tier} · {cfg.label}
    </span>
  )
}

function Stars({ rating, count }: { rating: number | null; count: number }) {
  if (!rating) return null
  const full = Math.round(rating)
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <span className="flex text-amber-400">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`w-3 h-3 ${i < full ? "fill-amber-400" : "fill-muted stroke-muted-foreground/40"}`} />
        ))}
      </span>
      <span>{rating.toFixed(1)}</span>
      {count > 0 && <span className="text-muted-foreground/60">({count})</span>}
    </span>
  )
}

function BidStatusBadge({ status }: { status: string }) {
  const cfg = BID_STATUS_CONFIG[status] ?? BID_STATUS_CONFIG.pending
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.className}`}>
      <Icon className="w-2.5 h-2.5" />{cfg.label}
    </span>
  )
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          type="button"
          className="focus:outline-none"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
        >
          <Star className={`w-6 h-6 transition-colors ${
            n <= (hover || value)
              ? "fill-amber-400 text-amber-400"
              : "fill-muted text-muted-foreground/30"
          }`} />
        </button>
      ))}
    </div>
  )
}

// ─── Message Thread ───────────────────────────────────────────────────────────

function MessageThread({
  bidId,
  landlordId,
  unreadCount,
}: {
  bidId: string
  landlordId: string
  unreadCount: number
}) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<BidMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function load() {
    setLoading(true)
    try {
      const msgs = await fetchBidMessages(bidId)
      setMessages(msgs)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  function toggle() {
    if (!open) load()
    setOpen(v => !v)
  }

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, open])

  async function handleSend() {
    const msg = text.trim()
    if (!msg || sending) return
    setSending(true)
    setText("")
    try {
      await sendBidMessage(bidId, msg, landlordId)
      await load()
    } catch { /* silent */ }
    finally { setSending(false) }
  }

  return (
    <div className="border-t border-border pt-2.5 mt-2.5">
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground w-full"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        Messages
        {unreadCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold w-4 h-4">
            {unreadCount}
          </span>
        )}
        <span className="ml-auto">
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {open && (
        <div className="mt-2.5 space-y-2">
          {/* Thread */}
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {loading && (
              <div className="text-xs text-muted-foreground text-center py-3">Loading…</div>
            )}
            {!loading && messages.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-3">No messages yet.</div>
            )}
            {messages.map(m => {
              const isLandlord = m.sender_type === "landlord"
              return (
                <div key={m.message_id} className={`flex ${isLandlord ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                    isLandlord
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}>
                    <div>{m.message}</div>
                    <div className={`text-[10px] mt-0.5 ${isLandlord ? "text-primary-foreground/60" : "text-muted-foreground"} text-right`}>
                      {fmtTime(m.created_at)}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Reply box */}
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Reply to vendor…"
              className="flex-1 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <Button size="sm" className="h-8 px-3" onClick={handleSend} disabled={!text.trim() || sending}>
              <Send className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Vendor Card ──────────────────────────────────────────────────────────────

function VendorCard({
  v, bidStatus, isOnboardedSection, landlordId, onAward, anyAwarded, onComplete,
}: {
  v: VendorResult
  bidStatus?: BidStatusRow | null
  isOnboardedSection?: boolean
  landlordId?: string
  onAward?: (bidId: string, vendorName: string) => void
  anyAwarded?: boolean
  onComplete?: (bidId: string, vendorName: string, agreedAmount: number | null) => void
}) {
  // Find the most recent quote and any questions
  const latestQuote = bidStatus?.responses
    ?.filter(r => r.response_type === "quote")
    .at(-1) ?? null

  const allResponses = bidStatus?.responses ?? []
  const hasQuestions = allResponses.some(r => r.response_type === "question")
  const hasDecline   = bidStatus?.status === "declined"
  const declineMsg   = allResponses.find(r => r.response_type === "decline")?.message

  const unreadMessages = bidStatus?.unread_messages ?? 0

  return (
    <div className={`rounded-lg border p-4 space-y-2.5 hover:border-primary/40 transition-colors ${
      isOnboardedSection ? "bg-card border-emerald-200/60" : "bg-card border-border"
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {isOnboardedSection && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                Partner
              </span>
            )}
            <p className="font-semibold text-sm text-foreground leading-tight truncate">{v.canonical_name}</p>
          </div>
          {v.category_display_name && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{v.category_display_name}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <TierBadge tier={v.score_tier} />
          {bidStatus && <BidStatusBadge status={bidStatus.status} />}
        </div>
      </div>

      {/* Rating */}
      <Stars rating={v.avg_rating} count={v.total_review_count} />

      {/* Location + distance */}
      {(v.city || v.state) && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3 shrink-0" />
          <span>{[v.city, v.state].filter(Boolean).join(", ")}</span>
          {v.distance_miles != null && (
            <span className="ml-auto text-[11px]">{v.distance_miles} mi away</span>
          )}
          {v.years_in_business && !v.distance_miles && (
            <span className="ml-auto text-[11px]">{v.years_in_business}y in business</span>
          )}
        </div>
      )}

      {/* Badges + phone */}
      <div className="flex items-center gap-2 flex-wrap">
        {v.is_licensed && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            <ShieldCheck className="w-3 h-3" /> Licensed
          </span>
        )}
        {v.is_insured && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-medium text-blue-700">
            <ShieldCheck className="w-3 h-3" /> Insured
          </span>
        )}
        {v.primary_phone && (
          <a href={`tel:${v.primary_phone}`}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <Phone className="w-3 h-3" />{v.primary_phone}
          </a>
        )}
      </div>

      {/* ── Quote response ── */}
      {latestQuote && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-xs space-y-1.5">
          <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Quote received</div>
          {latestQuote.quote_amount != null && (
            <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-sm">
              <DollarSign className="w-3.5 h-3.5" />
              ${Number(latestQuote.quote_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          )}
          {latestQuote.availability && (
            <div className="flex items-center gap-1.5 text-emerald-800">
              <CalendarClock className="w-3 h-3 shrink-0" />
              {latestQuote.availability}
            </div>
          )}
          <p className="text-emerald-800 leading-snug">{latestQuote.message}</p>
          <div className="text-[10px] text-emerald-600/70">{fmtTime(latestQuote.created_at)}</div>
        </div>
      )}

      {/* ── Questions from vendor ── */}
      {hasQuestions && !latestQuote && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-amber-800">
            <HelpCircle className="w-3.5 h-3.5" />
            Vendor has a question
          </div>
          {allResponses.filter(r => r.response_type === "question").map((q, i) => (
            <p key={i} className="text-amber-700 leading-snug">{q.message}</p>
          ))}
        </div>
      )}

      {/* ── Decline reason ── */}
      {hasDecline && declineMsg && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-xs space-y-1">
          <div className="font-semibold text-red-700">Declined</div>
          <p className="text-red-600 leading-snug">{declineMsg}</p>
        </div>
      )}

      {/* ── Awarded banner ── */}
      {bidStatus?.status === "awarded" && (
        <>
          <div className="rounded-md bg-amber-50 border border-amber-300 p-3 text-xs flex items-center gap-2 font-semibold text-amber-800">
            <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              Job awarded to this vendor
              {bidStatus.agreed_amount != null && (
                <span className="ml-2 font-bold text-amber-900">
                  · ${Number(bidStatus.agreed_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} in escrow
                </span>
              )}
            </div>
          </div>
          {/* Mark Complete button */}
          {onComplete && bidStatus.bid_id && (
            <button
              onClick={() => onComplete(bidStatus.bid_id, v.canonical_name, bidStatus.agreed_amount ?? null)}
              className="w-full flex items-center justify-center gap-1.5 rounded-md border-2 border-green-500 bg-green-50 hover:bg-green-100 text-green-800 font-semibold text-xs py-2 transition-colors"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              Mark Job Complete & Rate Vendor
            </button>
          )}
        </>
      )}

      {/* ── Completed banner ── */}
      {bidStatus?.status === "completed" && (
        <div className="rounded-md bg-green-50 border border-green-300 p-3 text-xs space-y-1">
          <div className="flex items-center gap-2 font-semibold text-green-800">
            <ClipboardCheck className="w-4 h-4 text-green-600 shrink-0" />
            Job completed
            {bidStatus.agreed_amount != null && (
              <span className="ml-auto text-green-700 font-bold">
                ${Number(bidStatus.agreed_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} released
              </span>
            )}
          </div>
          {bidStatus.landlord_rating != null && (
            <div className="flex items-center gap-1 text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`w-3.5 h-3.5 ${i < (bidStatus.landlord_rating ?? 0) ? "fill-amber-400" : "fill-muted/40 text-muted-foreground/30"}`} />
              ))}
              <span className="text-green-700 ml-1">{bidStatus.landlord_rating}/5</span>
            </div>
          )}
          {bidStatus.landlord_review && (
            <p className="text-green-700 italic">"{bidStatus.landlord_review}"</p>
          )}
        </div>
      )}

      {/* ── Award Job button (only on quoted bids when no one is awarded yet) ── */}
      {bidStatus?.status === "quoted" && !anyAwarded && onAward && bidStatus.bid_id && (
        <button
          onClick={() => onAward(bidStatus.bid_id, v.canonical_name)}
          className="w-full flex items-center justify-center gap-1.5 rounded-md border-2 border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs py-2 transition-colors"
        >
          <Trophy className="w-3.5 h-3.5" />
          Award Job to {v.canonical_name}
        </button>
      )}

      {/* ── Message thread (only for bids that have been sent) ── */}
      {bidStatus?.bid_id && landlordId && (
        <MessageThread bidId={bidStatus.bid_id} landlordId={landlordId} unreadCount={unreadMessages} />
      )}

      {/* Website */}
      {v.website_url && (
        <a href={v.website_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline truncate">
          <Globe className="w-3 h-3 shrink-0" />
          {v.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </a>
      )}
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function VendorPanel({ item, open, onClose, onComplete }: Props) {
  const [vendors, setVendors] = useState<VendorResult[]>([])
  const [matchedCategory, setMatchedCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Bid state
  const [bidSending, setBidSending] = useState(false)
  const [bidResults, setBidResults] = useState<BidResult[]>([])
  const [bidStatuses, setBidStatuses] = useState<BidStatusRow[]>([])
  const [bidsRequested, setBidsRequested] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Award state
  const [awarding, setAwarding] = useState(false)
  const [awardConfirm, setAwardConfirm] = useState<{ bidId: string; vendorName: string } | null>(null)
  const [awardNote, setAwardNote] = useState("")

  // Complete state
  const [completing, setCompleting] = useState(false)
  const [completeConfirm, setCompleteConfirm] = useState<{
    bidId: string; vendorName: string; agreedAmount: number | null
  } | null>(null)
  const [completeRating, setCompleteRating] = useState(0)
  const [completeReview, setCompleteReview] = useState("")


  const onboarded = vendors.filter(v => v.is_onboarded)
  const others    = vendors.filter(v => !v.is_onboarded)

  // Auto-fetch vendors + any existing bid statuses whenever panel opens
  useEffect(() => {
    if (!open || !item) return
    setVendors([])
    setMatchedCategory(null)
    setError(null)
    setBidResults([])
    setBidStatuses([])
    setBidsRequested(false)
    setLoading(true)

    const loadAll = async () => {
      try {
        // Always fetch vendors
        const { vendors: v, matchedCategory: mc } = await fetchVendors({
          term: item.title, zip_code: item.zip, distance: 50,
        })
        setVendors(v)
        setMatchedCategory(mc)

        // Also check if bids already exist for this request
        try {
          const statuses = await fetchBidStatus(item.id)
          if (statuses.length > 0) {
            setBidStatuses(statuses)
            setBidsRequested(true)
          }
        } catch { /* no bids yet — that's fine */ }
      } catch (err: any) {
        const msg = err.message.includes("Failed to fetch") || err.name === "TimeoutError"
          ? `Could not reach the Vendora API (${VENDORA_BASE_URL}). Make sure the service is running.`
          : err.message
        setError(msg)
      } finally {
        setLoading(false)
      }
    }

    loadAll()
  }, [open, item?.id])

  async function handleRequestBids() {
    if (!item) return
    setBidSending(true)
    try {
      const { vendors: refreshed, bidResults: results } = await sendBidRequests({
        term:                   item.title,
        zip_code:               item.zip,
        distance:               50,
        maintenance_request_id: item.id,
        lease_id:               item.lease_id,
        landlord_id:            item.landlord_id,
        description:            item.description,
        priority:               item.priority,
        property_name:          item.property_name,
        unit_label:             item.unit,
        address:                [item.city, item.state].filter(Boolean).join(", "),
      })
      setVendors(refreshed)
      setBidResults(results)
      setBidsRequested(true)
      const statuses = await fetchBidStatus(item.id)
      setBidStatuses(statuses)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBidSending(false)
    }
  }

  async function handleRefreshBids() {
    if (!item) return
    setRefreshing(true)
    try {
      const statuses = await fetchBidStatus(item.id)
      setBidStatuses(statuses)
    } catch { /* silent */ }
    finally { setRefreshing(false) }
  }

  function getBidStatus(vendorId: string): BidStatusRow | null {
    return bidStatuses.find(b => b.vendor_id === vendorId) ?? null
  }

  async function handleAward() {
    if (!awardConfirm || !item) return
    setAwarding(true)
    try {
      await awardBid({
        bid_id: awardConfirm.bidId,
        maintenance_request_id: item.id,
        landlord_id: item.landlord_id,
        note: awardNote.trim() || undefined,
      })
      setAwardConfirm(null)
      setAwardNote("")
      // Refresh bid statuses to show new awarded / closed states
      const statuses = await fetchBidStatus(item.id)
      setBidStatuses(statuses)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setAwarding(false)
    }
  }

  async function handleComplete() {
    if (!completeConfirm || !item) return
    setCompleting(true)
    try {
      await completeJob({
        bid_id: completeConfirm.bidId,
        maintenance_request_id: item.id,
        landlord_id: item.landlord_id,
        landlord_rating: completeRating || null,
        landlord_review: completeReview.trim() || null,
      })
      // Update Supabase maintenance request status to 'completed'
      const { error: supaErr } = await supabase
        .from("maintenance_requests")
        .update({ status: "completed" })
        .eq("id", item.id)
      if (supaErr) throw new Error(`Could not update request status: ${supaErr.message}`)
      setCompleteConfirm(null)
      setCompleteRating(0)
      setCompleteReview("")
      // Refresh bid statuses inside the panel
      const statuses = await fetchBidStatus(item.id)
      setBidStatuses(statuses)
      // Tell the parent list to reload so the row status updates immediately
      onComplete?.()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCompleting(false)
    }
  }

  const anyAwarded = bidStatuses.some(b => b.status === "awarded" || b.status === "completed")
  const locationLabel = [item?.city, item?.state].filter(Boolean).join(", ") || "your area"
  const sentCount     = bidResults.filter(r => r.status !== "error").length
  const quotedCount   = bidStatuses.filter(b => b.status === "quoted").length
  const hasActivity   = bidStatuses.length > 0

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-0 p-0">

        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Vendora · Vendor Finder
            </span>
          </div>
          <SheetTitle className="text-base font-semibold leading-snug text-foreground">
            {item?.title ?? "Maintenance Request"}
          </SheetTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {item?.unit} &middot; {item?.tenant}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {matchedCategory && !loading && (
              <>
                <span className="text-xs text-muted-foreground">Category:</span>
                <Badge variant="secondary" className="text-xs font-mono">{matchedCategory}</Badge>
                <span className="text-xs text-muted-foreground ml-auto">within 50 mi of {item?.zip ?? locationLabel}</span>
              </>
            )}
            {/* Bid summary when bids already exist */}
            {hasActivity && !loading && (
              <div className="flex items-center gap-2 w-full mt-1">
                <span className="text-xs text-muted-foreground">
                  {bidStatuses.length} bid{bidStatuses.length !== 1 ? "s" : ""} sent
                  {quotedCount > 0 && ` · ${quotedCount} quote${quotedCount !== 1 ? "s" : ""} received`}
                </span>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 ml-auto px-2" onClick={handleRefreshBids} disabled={refreshing}>
                  <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            )}
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 px-6 py-5 space-y-5">

          {/* ── Award confirmation (inline, replaces body content) ── */}
          {awardConfirm && (
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
                <h3 className="font-semibold text-foreground">Award this job?</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Awarding to <span className="font-semibold text-foreground">{awardConfirm.vendorName}</span>.
                Other quoted vendors will be notified the job was filled.
              </p>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Optional note to vendor
                </label>
                <textarea
                  rows={2}
                  value={awardNote}
                  onChange={e => setAwardNote(e.target.value)}
                  placeholder="e.g. Please call before arriving. Gate code is 1234."
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-none" onClick={() => setAwardConfirm(null)} disabled={awarding}>
                  Cancel
                </Button>
                <Button className="flex-1 gap-2 bg-amber-500 hover:bg-amber-600 text-white" onClick={handleAward} disabled={awarding}>
                  <Trophy className="w-4 h-4" />
                  {awarding ? "Awarding…" : "Confirm Award"}
                </Button>
              </div>
            </div>
          )}

          {/* ── Job completion confirmation ── */}
          {completeConfirm && (
            <div className="rounded-xl border-2 border-green-400 bg-green-50 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-green-600 shrink-0" />
                <h3 className="font-semibold text-foreground">Mark job as complete?</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Confirming completion for <span className="font-semibold text-foreground">{completeConfirm.vendorName}</span>.
                {completeConfirm.agreedAmount != null && (
                  <> The escrowed amount of <span className="font-semibold text-green-700">
                    ${Number(completeConfirm.agreedAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span> will be released to the vendor.</>
                )}
              </p>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  Rate the vendor's work
                </label>
                <StarPicker value={completeRating} onChange={setCompleteRating} />
                {completeRating > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {["", "Poor", "Fair", "Good", "Very good", "Excellent"][completeRating]}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Optional review
                </label>
                <textarea
                  rows={2}
                  value={completeReview}
                  onChange={e => setCompleteReview(e.target.value)}
                  placeholder="e.g. Fast, professional, great job fixing the pipe."
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-none" onClick={() => setCompleteConfirm(null)} disabled={completing}>
                  Cancel
                </Button>
                <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={handleComplete} disabled={completing}>
                  <ClipboardCheck className="w-4 h-4" />
                  {completing ? "Processing…" : "Confirm Completion"}
                </Button>
              </div>
            </div>
          )}

          {/* Loading skeletons */}
          {!awardConfirm && !completeConfirm && loading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {!awardConfirm && !completeConfirm && !loading && error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex gap-3">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm text-destructive">{error}</div>
            </div>
          )}

          {/* Empty state */}
          {!awardConfirm && !completeConfirm && !loading && !error && vendors.length === 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No vendors found for this request in {locationLabel}.
            </div>
          )}

          {/* ── SECTION 1: Onboarded / Partner Vendors ── */}
          {!awardConfirm && !completeConfirm && !loading && !error && onboarded.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Partner Vendors</h3>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 text-[10px]">
                    {onboarded.length} onboarded
                  </Badge>
                </div>
              </div>

              <div className="space-y-2.5">
                {onboarded.map(v => (
                  <VendorCard
                    key={v.vendor_id}
                    v={v}
                    bidStatus={getBidStatus(v.vendor_id)}
                    isOnboardedSection
                    landlordId={item?.landlord_id}
                    anyAwarded={anyAwarded}
                    onAward={(bidId, vendorName) => {
                      setAwardNote("")
                      setAwardConfirm({ bidId, vendorName })
                    }}
                    onComplete={(bidId, vendorName, agreedAmount) => {
                      setCompleteRating(0)
                      setCompleteReview("")
                      setCompleteConfirm({ bidId, vendorName, agreedAmount })
                    }}
                  />
                ))}
              </div>

              {/* Request Bids button */}
              {!bidsRequested ? (
                <Button
                  className="w-full gap-2"
                  onClick={handleRequestBids}
                  disabled={bidSending}
                >
                  <Send className="w-4 h-4" />
                  {bidSending ? "Sending bid requests…" : `Request Bids from ${onboarded.length} partner vendor${onboarded.length !== 1 ? "s" : ""}`}
                </Button>
              ) : (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {quotedCount > 0
                    ? `${quotedCount} quote${quotedCount !== 1 ? "s" : ""} received · ${sentCount} vendor${sentCount !== 1 ? "s" : ""} contacted`
                    : `Bid requests sent to ${sentCount} vendor${sentCount !== 1 ? "s" : ""}. Refresh to see responses.`
                  }
                </div>
              )}
            </div>
          )}

          {/* Divider when both sections present */}
          {!awardConfirm && !completeConfirm && !loading && !error && onboarded.length > 0 && others.length > 0 && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-xs text-muted-foreground">All vendors in area</span>
              </div>
            </div>
          )}

          {/* ── SECTION 2: All other vendors ── */}
          {!awardConfirm && !completeConfirm && !loading && !error && others.length > 0 && (
            <div className="space-y-3">
              {onboarded.length === 0 && (
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    {others.length} vendor{others.length !== 1 ? "s" : ""} found near {locationLabel}
                  </h3>
                  <span className="text-[11px] text-muted-foreground">sorted by Vendora score</span>
                </div>
              )}
              <div className="space-y-2.5">
                {others.map(v => (
                  <VendorCard key={v.vendor_id} v={v} />
                ))}
              </div>
              {onboarded.length === 0 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  None of these vendors are onboarded yet — bid requests can only be sent to partner vendors.
                </p>
              )}
            </div>
          )}
        </div>

      </SheetContent>
    </Sheet>
  )
}
