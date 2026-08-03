export interface Stock {
  symbol: string
  name: string
  nameZh: string
  price: number
  change: number
  changePercent: number
  marketCap: string
  volume: string
  pe: number
  high: number
  low: number
  open: number
  previousClose: number
  // 52-week range for risk assessment
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
}

export interface StockHistory {
  date: string
  price: number
}

export interface NewsItem {
  id: string
  title: string
  titleZh: string
  summary: string
  summaryZh: string
  source: string
  url: string
  publishedAt: string
  relatedStocks: string[]
}

export type Language = 'en' | 'zh'
