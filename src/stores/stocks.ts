import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import type { Stock, StockHistory, NewsItem } from '@/types'

// ── Chinese name mapping (extensible) ────────────────────────────
const chineseNames: Record<string, string> = {
  NVDA: '輝達',
  AAPL: '蘋果',
  GOOGL: '谷歌',
  MSFT: '微軟',
  AMZN: '亞馬遜',
  META: 'Meta',
  TSLA: '特斯拉',
  TSM: '台積電',
  AMD: '超微',
  INTC: '英特爾',
  NFLX: 'Netflix',
  BABA: '阿里巴巴',
  JD: '京東',
  BIDU: '百度',
  PDD: '拼多多',
  NIO: '蔚來',
  XPEV: '小鵬',
  LI: '理想',
  TCEHY: '騰訊',
  PYPL: 'PayPal',
  ADBE: 'Adobe',
  CRM: 'Salesforce',
  DIS: '迪士尼',
  UBER: 'Uber',
  SHOP: 'Shopify',
  SQ: 'Block',
  SNAP: 'Snap',
  COIN: 'Coinbase',
  PLTR: 'Palantir',
  RIVN: 'Rivian',
  LCID: 'Lucid',
  RBLX: 'Roblox',
  SPOT: 'Spotify',
  SONY: '索尼',
  TM: '豐田',
  BA: '波音',
  JPM: '摩根大通',
  GS: '高盛',
  V: 'Visa',
  MA: 'Mastercard',
  BTC: '比特幣',
  ETH: '以太幣',
}

// ── localStorage persistence ─────────────────────────────────────
interface StoredStock {
  symbol: string
  order: number
}

const STORAGE_KEY = 'tech-stock-tracker-stocks'

const DEFAULT_STOCKS: StoredStock[] = [
  { symbol: 'NVDA', order: 0 },
  { symbol: 'AAPL', order: 1 },
  { symbol: 'GOOGL', order: 2 },
  { symbol: 'MSFT', order: 3 },
  { symbol: 'AMZN', order: 4 },
]

function loadStoredStocks(): StoredStock[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch { /* ignore parse errors */ }
  return [...DEFAULT_STOCKS]
}

function saveStoredStocks(stocks: StoredStock[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stocks))
}

// ── Yahoo Finance API helpers ────────────────────────────────────
const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote'
const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart'

// ── CORS proxy (Cloudflare Worker — self-hosted, reliable) ──────
// Deploy with: cd worker && npx wrangler deploy
// Update this URL after deploying:
const CORS_PROXY = 'https://stock-proxy.pangtongsanguo.workers.dev/?url='

function corsUrl(apiUrl: string, params?: Record<string, string>): string {
  const fullUrl = params
    ? `${apiUrl}?${new URLSearchParams(params).toString()}`
    : apiUrl
  return CORS_PROXY + encodeURIComponent(fullUrl)
}

function formatMarketCap(cap: number | undefined | null): string {
  if (cap == null) return '—'
  if (cap >= 1e12) return (cap / 1e12).toFixed(2) + 'T'
  if (cap >= 1e9) return (cap / 1e9).toFixed(2) + 'B'
  if (cap >= 1e6) return (cap / 1e6).toFixed(2) + 'M'
  return cap.toLocaleString()
}

function formatVolume(vol: number | undefined | null): string {
  if (vol == null) return '—'
  if (vol >= 1e6) return (vol / 1e6).toFixed(1) + 'M'
  if (vol >= 1e3) return (vol / 1e3).toFixed(1) + 'K'
  return vol.toLocaleString()
}

interface YahooQuoteResult {
  symbol: string
  shortName?: string
  longName?: string
  regularMarketPrice?: number
  regularMarketChange?: number
  regularMarketChangePercent?: number
  marketCap?: number
  regularMarketVolume?: number
  regularMarketDayHigh?: number
  regularMarketDayLow?: number
  regularMarketOpen?: number
  regularMarketPreviousClose?: number
  trailingPE?: number
}

// ── Store ────────────────────────────────────────────────────────
export const useStockStore = defineStore('stocks', () => {
  // ── State ──
  const stocks = ref<Stock[]>([])
  const stockHistory = ref<Record<string, StockHistory[]>>({})
  const lastUpdate = ref<Date | null>(null)
  const autoUpdate = ref<boolean>(true)
  const selectedStocks = ref<string[]>(['NVDA'])
  const compareMode = ref<boolean>(false)
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const news = ref<NewsItem[]>([])  // Reserved for future real-news integration

  // Stored config (persisted)
  const storedStocks = ref<StoredStock[]>(loadStoredStocks())

  // ── Persist helper ──
  function persist() {
    saveStoredStocks(storedStocks.value)
  }

  // ── Fetch real quotes from Yahoo Finance ──
  async function fetchQuotes(): Promise<void> {
    if (storedStocks.value.length === 0) {
      stocks.value = []
      return
    }

    loading.value = true
    error.value = null

    const symbols = storedStocks.value.map(s => s.symbol).join(',')

    try {
      const { data } = await axios.get(corsUrl(YAHOO_QUOTE_URL, { symbols, formatted: 'true' }), {
        timeout: 15000,
      })

      const results: YahooQuoteResult[] = data?.quoteResponse?.result ?? []

      // Build a new stock list respecting stored order
      const stockMap = new Map<string, YahooQuoteResult>()
      for (const r of results) {
        stockMap.set(r.symbol, r)
      }

      const newStocks: Stock[] = []
      for (const stored of storedStocks.value) {
        const q = stockMap.get(stored.symbol)
        if (!q) continue // symbol not found in API response, skip

        const name = q.shortName || q.longName || stored.symbol
        newStocks.push({
          symbol: q.symbol,
          name,
          nameZh: chineseNames[q.symbol] || name,
          price: q.regularMarketPrice ?? 0,
          change: q.regularMarketChange ?? 0,
          changePercent: q.regularMarketChangePercent ?? 0,
          marketCap: formatMarketCap(q.marketCap),
          volume: formatVolume(q.regularMarketVolume),
          pe: q.trailingPE ?? 0,
          high: q.regularMarketDayHigh ?? 0,
          low: q.regularMarketDayLow ?? 0,
          open: q.regularMarketOpen ?? 0,
          previousClose: q.regularMarketPreviousClose ?? 0,
        })
      }

      stocks.value = newStocks
      lastUpdate.value = new Date()
    } catch (e: any) {
      error.value = e?.message || 'Failed to fetch stock data'
      console.error('Yahoo Finance API error:', e)
    } finally {
      loading.value = false
    }
  }

  // ── Fetch historical chart data ──
  async function fetchHistory(symbol: string, range = '1mo'): Promise<void> {
    try {
      const { data } = await axios.get(corsUrl(`${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}`, {
        range, interval: '1d',
      }), {
        timeout: 15000,
      })

      const result = data?.chart?.result?.[0]
      if (!result) return

      const timestamps: number[] = result.timestamp ?? []
      const quotes = result.indicators?.quote?.[0]
      const closes: number[] = quotes?.close ?? []

      const history: StockHistory[] = []
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] != null) {
          const date = new Date(timestamps[i] * 1000)
          history.push({
            date: date.toISOString().split('T')[0],
            price: closes[i],
          })
        }
      }

      stockHistory.value[symbol] = history
    } catch (e) {
      console.error(`Failed to fetch history for ${symbol}:`, e)
    }
  }

  // ── Fetch history for all selected stocks ──
  async function fetchAllHistory(): Promise<void> {
    const symbols = storedStocks.value.map(s => s.symbol)
    await Promise.allSettled(symbols.map(s => fetchHistory(s)))
  }

  // ── Stock list management ──
  function addStock(symbol: string): boolean {
    const upper = symbol.toUpperCase().trim()
    if (!upper || upper.length > 10) return false
    if (storedStocks.value.some(s => s.symbol === upper)) return false // duplicate

    const maxOrder = storedStocks.value.reduce((max, s) => Math.max(max, s.order), -1)
    storedStocks.value.push({ symbol: upper, order: maxOrder + 1 })
    persist()
    fetchQuotes()
    fetchHistory(upper)
    return true
  }

  function removeStock(symbol: string): void {
    storedStocks.value = storedStocks.value.filter(s => s.symbol !== symbol)
    // Re-index orders
    storedStocks.value.forEach((s, i) => { s.order = i })
    persist()

    // Remove from selected if needed
    selectedStocks.value = selectedStocks.value.filter(s => s !== symbol)
    if (selectedStocks.value.length === 0 && storedStocks.value.length > 0) {
      selectedStocks.value = [storedStocks.value[0].symbol]
    }

    fetchQuotes()
  }

  function moveStock(symbol: string, direction: 'up' | 'down'): void {
    const idx = storedStocks.value.findIndex(s => s.symbol === symbol)
    if (idx === -1) return

    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= storedStocks.value.length) return

    // Swap
    const temp = storedStocks.value[idx]
    storedStocks.value[idx] = storedStocks.value[newIdx]
    storedStocks.value[newIdx] = temp

    // Re-index orders
    storedStocks.value.forEach((s, i) => { s.order = i })
    persist()

    // Re-sort stocks display array
    const stockMap = new Map(stocks.value.map(s => [s.symbol, s]))
    stocks.value = storedStocks.value
      .map(ss => stockMap.get(ss.symbol))
      .filter((s): s is Stock => s != null)
  }

  // ── Getters ──
  const sortedStocks = computed(() => {
    // Already in order from storedStocks
    const stockMap = new Map(stocks.value.map(s => [s.symbol, s]))
    return storedStocks.value
      .map(ss => stockMap.get(ss.symbol))
      .filter((s): s is Stock => s != null)
  })

  const getStockBySymbol = (symbol: string) => {
    return stocks.value.find(s => s.symbol === symbol)
  }

  const getHistoryBySymbol = (symbol: string) => {
    return stockHistory.value[symbol] || []
  }

  // ── Selection / compare ──
  function selectStock(symbol: string) {
    if (compareMode.value) {
      if (selectedStocks.value.includes(symbol)) {
        selectedStocks.value = selectedStocks.value.filter(s => s !== symbol)
      } else {
        selectedStocks.value.push(symbol)
      }
    } else {
      selectedStocks.value = [symbol]
    }
  }

  function toggleCompareMode() {
    compareMode.value = !compareMode.value
    if (!compareMode.value) {
      selectedStocks.value = [selectedStocks.value[0] || storedStocks.value[0]?.symbol || '']
    }
  }

  // ── Auto-refresh simulation (only random jitter; real data comes from API poll) ──
  function updateStockPrices() {
    fetchQuotes()
  }

  function toggleAutoUpdate() {
    autoUpdate.value = !autoUpdate.value
  }

  // ── Init ──
  async function init() {
    await fetchQuotes()
    await fetchAllHistory()
  }

  return {
    // state
    stocks,
    sortedStocks,
    stockHistory,
    lastUpdate,
    autoUpdate,
    selectedStocks,
    compareMode,
    loading,
    error,
    news,
    storedStocks,
    // actions
    init,
    fetchQuotes,
    fetchHistory,
    fetchAllHistory,
    addStock,
    removeStock,
    moveStock,
    updateStockPrices,
    toggleAutoUpdate,
    selectStock,
    toggleCompareMode,
    // getters
    getStockBySymbol,
    getHistoryBySymbol,
  }
})