import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import type { Stock, StockHistory, NewsItem } from '@/types'

// ── Chinese name mapping ─────────────────────────────────────────
const chineseNames: Record<string, string> = {
  NVDA: '輝達', AAPL: '蘋果', GOOGL: '谷歌', MSFT: '微軟', AMZN: '亞馬遜',
  META: 'Meta', TSLA: '特斯拉', TSM: '台積電', AMD: '超微', INTC: '英特爾',
  NFLX: 'Netflix', BABA: '阿里巴巴', JD: '京東', BIDU: '百度', PDD: '拼多多',
  NIO: '蔚來', XPEV: '小鵬', LI: '理想', TCEHY: '騰訊', PYPL: 'PayPal',
  ADBE: 'Adobe', CRM: 'Salesforce', DIS: '迪士尼', UBER: 'Uber', SHOP: 'Shopify',
  SQ: 'Block', SNAP: 'Snap', COIN: 'Coinbase', PLTR: 'Palantir',
  RIVN: 'Rivian', LCID: 'Lucid', RBLX: 'Roblox', SPOT: 'Spotify',
  SONY: '索尼', TM: '豐田', BA: '波音', JPM: '摩根大通', GS: '高盛',
  V: 'Visa', MA: 'Mastercard', BTC: '比特幣', ETH: '以太幣',
}

// ── localStorage ─────────────────────────────────────────────────
interface StoredStock { symbol: string; order: number }

const STORAGE_KEY = 'tech-stock-tracker-stocks'
const DEFAULT_STOCKS: StoredStock[] = [
  { symbol: 'NVDA', order: 0 }, { symbol: 'AAPL', order: 1 },
  { symbol: 'GOOGL', order: 2 }, { symbol: 'MSFT', order: 3 },
  { symbol: 'AMZN', order: 4 },
]

function loadStoredStocks(): StoredStock[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s) { const p = JSON.parse(s); if (Array.isArray(p) && p.length > 0) return p }
  } catch {}
  return [...DEFAULT_STOCKS]
}
function saveStoredStocks(s: StoredStock[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }

// ── Cloudflare Worker proxy ──────────────────────────────────────
const PROXY = 'https://stock-proxy.pangtongsanguo.workers.dev/?url='
const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart'
const YAHOO_RSS = 'https://feeds.finance.yahoo.com/rss/2.0/headline'

function proxyUrl(url: string): string { return PROXY + encodeURIComponent(url) }

// ── Formatting ───────────────────────────────────────────────────
function fmtVol(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  return v.toLocaleString()
}
function fmtCap(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1e12) return (v / 1e12).toFixed(2) + 'T'
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B'
  return v.toLocaleString()
}

// ── Store ────────────────────────────────────────────────────────
export const useStockStore = defineStore('stocks', () => {
  const stocks = ref<Stock[]>([])
  const stockHistory = ref<Record<string, StockHistory[]>>({})
  const lastUpdate = ref<Date | null>(null)
  const autoUpdate = ref(true)
  const selectedStocks = ref<string[]>(['NVDA'])
  const compareMode = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const news = ref<NewsItem[]>([])
  const storedStocks = ref<StoredStock[]>(loadStoredStocks())
  const chartRange = ref('1mo')  // 5d | 1mo | 3mo | 6mo | 1y

  // Time range options
  const chartRanges = [
    { value: '5d', label: '5D', labelZh: '5天' },
    { value: '1mo', label: '1M', labelZh: '1月' },
    { value: '3mo', label: '3M', labelZh: '3月' },
    { value: '6mo', label: '6M', labelZh: '6月' },
    { value: '1y', label: '1Y', labelZh: '1年' },
  ]

  function persist() { saveStoredStocks(storedStocks.value) }

  // ── Fetch quotes + history in ONE call (v8 chart API) ──────────
  async function fetchStockData(symbol: string): Promise<Stock | null> {
    const url = `${YAHOO_CHART}/${encodeURIComponent(symbol)}?range=1mo&interval=1d&includePrePost=false`
    try {
      const { data } = await axios.get(proxyUrl(url), { timeout: 15000 })
      const r = data?.chart?.result?.[0]
      if (!r) return null

      const meta = r.meta
      const quotes = r.indicators?.quote?.[0]
      const timestamps: number[] = r.timestamp ?? []
      const closes: number[] = quotes?.close ?? []
      const opens: number[] = quotes?.open ?? []
      const highs: number[] = quotes?.high ?? []
      const lows: number[] = quotes?.low ?? []
      const volumes: number[] = quotes?.volume ?? []

      // Last candle for current data
      const lastIdx = closes.length - 1
      const price = closes[lastIdx] ?? meta.regularMarketPrice ?? 0
      const prevClose = meta.chartPreviousClose ?? closes[lastIdx - 1] ?? price
      const dayHigh = highs[lastIdx] ?? meta.regularMarketDayHigh ?? 0
      const dayLow = lows[lastIdx] ?? meta.regularMarketDayLow ?? 0
      const dayOpen = opens[lastIdx] ?? 0
      const dayVolume = volumes[lastIdx] ?? meta.regularMarketVolume ?? 0
      const change = +(price - prevClose).toFixed(2)
      const changePercent = prevClose ? +((change / prevClose) * 100).toFixed(2) : 0
      const name = meta.shortName || meta.longName || symbol
      const mktCap = meta.marketCap ?? null

      // Build history
      const history: StockHistory[] = []
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] != null) {
          history.push({
            date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
            price: closes[i],
          })
        }
      }
      stockHistory.value[symbol] = history

      return {
        symbol, name,
        nameZh: chineseNames[symbol] || name,
        price, change, changePercent,
        marketCap: fmtCap(mktCap),
        volume: fmtVol(dayVolume),
        pe: 0,
        high: dayHigh, low: dayLow,
        open: dayOpen, previousClose: prevClose,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? 0,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? 0,
      }
    } catch (e: any) {
      console.error(`Fetch error for ${symbol}:`, e?.message)
      return null
    }
  }

  async function fetchQuotes(): Promise<void> {
    if (storedStocks.value.length === 0) { stocks.value = []; return }
    loading.value = true; error.value = null

    const results = await Promise.allSettled(
      storedStocks.value.map(s => fetchStockData(s.symbol))
    )

    const newStocks: Stock[] = []
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) newStocks.push(r.value)
    }
    stocks.value = newStocks
    lastUpdate.value = new Date()
    loading.value = false
  }

  async function fetchHistory(symbol: string): Promise<void> {
    // fetchStockData already populates stockHistory, but we need standalone too
    await fetchStockData(symbol)
  }

  async function fetchChartHistory(symbol: string, range: string): Promise<void> {
    const url = `${YAHOO_CHART}/${encodeURIComponent(symbol)}?range=${range}&interval=1d&includePrePost=false`
    try {
      const { data } = await axios.get(proxyUrl(url), { timeout: 15000 })
      const r = data?.chart?.result?.[0]
      if (!r) return
      const timestamps: number[] = r.timestamp ?? []
      const closes: number[] = r.indicators?.quote?.[0]?.close ?? []
      const history: StockHistory[] = []
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] != null) {
          history.push({
            date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
            price: closes[i],
          })
        }
      }
      stockHistory.value[symbol] = history
    } catch (e: any) {
      console.error(`History fetch error for ${symbol}:`, e?.message)
    }
  }

  async function setChartRange(range: string): Promise<void> {
    chartRange.value = range
    const symbols = [...selectedStocks.value]
    await Promise.allSettled(symbols.map(s => fetchChartHistory(s, range)))
  }

  async function fetchAllHistory(): Promise<void> {
    await setChartRange(chartRange.value)
  }

  // ── Stock management ───────────────────────────────────────────
  function addStock(symbol: string): boolean {
    const upper = symbol.toUpperCase().trim()
    if (!upper || upper.length > 10) return false
    if (storedStocks.value.some(s => s.symbol === upper)) return false
    const maxOrder = storedStocks.value.reduce((max, s) => Math.max(max, s.order), -1)
    storedStocks.value.push({ symbol: upper, order: maxOrder + 1 })
    persist()
    fetchStockData(upper).then(s => {
      if (s) { stocks.value = [...stocks.value, s] }
    })
    return true
  }

  function removeStock(symbol: string): void {
    storedStocks.value = storedStocks.value.filter(s => s.symbol !== symbol)
    storedStocks.value.forEach((s, i) => { s.order = i })
    persist()
    selectedStocks.value = selectedStocks.value.filter(s => s !== symbol)
    if (selectedStocks.value.length === 0 && storedStocks.value.length > 0)
      selectedStocks.value = [storedStocks.value[0].symbol]
    stocks.value = stocks.value.filter(s => s.symbol !== symbol)
  }

  function moveStock(symbol: string, direction: 'up' | 'down'): void {
    const idx = storedStocks.value.findIndex(s => s.symbol === symbol)
    if (idx === -1) return
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= storedStocks.value.length) return
    ;[storedStocks.value[idx], storedStocks.value[newIdx]] = [storedStocks.value[newIdx], storedStocks.value[idx]]
    storedStocks.value.forEach((s, i) => { s.order = i })
    persist()
  }

  // ── Getters ──
  const sortedStocks = computed(() => {
    const m = new Map(stocks.value.map(s => [s.symbol, s]))
    return storedStocks.value.map(ss => m.get(ss.symbol)).filter((s): s is Stock => s != null)
  })

  const getStockBySymbol = (symbol: string) => stocks.value.find(s => s.symbol === symbol)
  const getHistoryBySymbol = (symbol: string) => stockHistory.value[symbol] || []

  // ── Selection ──
  function selectStock(symbol: string) {
    if (compareMode.value) {
      const i = selectedStocks.value.indexOf(symbol)
      i >= 0 ? selectedStocks.value.splice(i, 1) : selectedStocks.value.push(symbol)
    } else {
      selectedStocks.value = [symbol]
    }
  }

  function toggleCompareMode() {
    compareMode.value = !compareMode.value
    if (compareMode.value) {
      // Auto-select all stocks when compare mode is turned ON
      selectedStocks.value = storedStocks.value.map(s => s.symbol)
    } else {
      selectedStocks.value = [selectedStocks.value[0] || storedStocks.value[0]?.symbol || '']
    }
  }

  function updateStockPrices() { fetchQuotes() }
  function toggleAutoUpdate() { autoUpdate.value = !autoUpdate.value }

  async function fetchNews(): Promise<void> {
    try {
      const symbols = storedStocks.value.map(s => s.symbol).slice(0, 10).join(',')
      const rssUrl = `${YAHOO_RSS}?s=${encodeURIComponent(symbols)}&region=US&lang=en-US`
      const { data } = await axios.get(proxyUrl(rssUrl), { timeout: 10000 })

      const parser = new DOMParser()
      const xml = parser.parseFromString(data, 'text/xml')
      const items = xml.querySelectorAll('item')

      const newsItems: NewsItem[] = []
      let id = 0
      items.forEach(el => {
        const title = el.querySelector('title')?.textContent || ''
        const summary = el.querySelector('description')?.textContent || ''
        const link = el.querySelector('link')?.textContent || ''
        const pubDate = el.querySelector('pubDate')?.textContent || ''
        if (title && link) {
          newsItems.push({
            id: String(++id),
            title,
            titleZh: title,  // no auto-translation; user can read English
            summary,
            summaryZh: summary,
            source: 'Yahoo Finance',
            url: link,
            publishedAt: pubDate,
            relatedStocks: [],
          })
        }
      })
      news.value = newsItems.slice(0, 12) // max 12 items
    } catch (e: any) {
      console.error('News fetch error:', e?.message)
    }
  }

  async function init() {
    await fetchQuotes()
    fetchNews()
  }

  return {
    stocks, sortedStocks, stockHistory, lastUpdate, autoUpdate,
    selectedStocks, compareMode, loading, error, news, storedStocks,
    chartRange, chartRanges,
    init, fetchQuotes, fetchHistory, fetchAllHistory, setChartRange, fetchNews,
    addStock, removeStock, moveStock, updateStockPrices,
    toggleAutoUpdate, selectStock, toggleCompareMode,
    getStockBySymbol, getHistoryBySymbol,
  }
})