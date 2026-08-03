<template>
  <v-card class="stock-chart mb-6" elevation="4">
    <v-card-title class="d-flex align-center">
      <v-icon color="primary" class="mr-2">mdi-chart-line</v-icon>
      {{ $t('chart.title') }}
      <v-spacer></v-spacer>
      <v-btn
        :color="stockStore.compareMode ? 'primary' : undefined"
        variant="outlined"
        size="small"
        @click="toggleCompare"
      >
        {{ $t('chart.compareMode') }}
      </v-btn>
    </v-card-title>
    <v-card-subtitle class="d-flex align-center">
      {{ $t('chart.subtitle') }}
      <v-spacer></v-spacer>
      <!-- Time Range Selector -->
      <v-btn-toggle
        v-model="activeRange"
        mandatory
        density="compact"
        variant="outlined"
        divided
        @update:model-value="onRangeChange"
      >
        <v-btn
          v-for="r in stockStore.chartRanges"
          :key="r.value"
          :value="r.value"
          size="x-small"
          class="text-none px-2"
        >
          {{ locale === 'zh' ? r.labelZh : r.label }}
        </v-btn>
      </v-btn-toggle>
    </v-card-subtitle>
    <v-card-text>
      <!-- Stock Selector -->
      <div class="d-flex flex-wrap gap-2 mb-4">
        <v-chip
          v-for="stock in stockStore.sortedStocks"
          :key="stock.symbol"
          :color="isSelected(stock.symbol) ? 'primary' : undefined"
          :variant="isSelected(stock.symbol) ? 'flat' : 'outlined'"
          @click="selectStock(stock.symbol)"
          class="cursor-pointer"
        >
          <v-icon start size="16">mdi-chart-line</v-icon>
          {{ stock.symbol }}
          <span
            v-if="stock.price > 0"
            class="ml-1"
            :class="stock.changePercent >= 0 ? 'text-green' : 'text-red'"
          >
            {{ stock.changePercent >= 0 ? '+' : '' }}{{ stock.changePercent.toFixed(2) }}%
          </span>
        </v-chip>
      </div>

      <!-- Chart -->
      <div class="chart-container">
        <!-- Loading -->
        <div v-if="chartLoading" class="d-flex align-center justify-center fill-height">
          <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
        </div>

        <Line
          v-else-if="chartData"
          :data="chartData"
          :options="chartOptions"
        />

        <div v-else class="d-flex align-center justify-center fill-height text-grey">
          {{ $t('chart.noData') }}
        </div>
      </div>

      <!-- Legend -->
      <div v-if="chartData" class="d-flex flex-wrap justify-center gap-4 mt-4">
        <div
          v-for="(stock, index) in selectedStocksData"
          :key="stock?.symbol ?? index"
          class="d-flex align-center"
        >
          <div
            class="legend-dot mr-2"
            :style="{ backgroundColor: colors[index % colors.length] }"
          ></div>
          <span class="text-body-2">{{ stock?.name ?? '?' }} (${{ stock?.price?.toFixed(2) ?? '—' }})</span>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { useStockStore } from '@/stores/stocks'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const stockStore = useStockStore()
const { locale } = useI18n()
const chartLoading = ref(false)
const activeRange = ref(stockStore.chartRange)

const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a']

const selectedStocksData = computed(() => {
  return stockStore.selectedStocks.map(symbol => 
    stockStore.getStockBySymbol(symbol)
  ).filter(Boolean)
})

const isSelected = (symbol: string) => {
  return stockStore.selectedStocks.includes(symbol)
}

const selectStock = (symbol: string) => {
  stockStore.selectStock(symbol)
}

const toggleCompare = () => {
  stockStore.toggleCompareMode()
}

function onRangeChange(range: string) {
  if (range === stockStore.chartRange) return
  chartLoading.value = true
  stockStore.setChartRange(range).then(() => {
    chartLoading.value = false
  })
}

// Watch for stock selection changes and ensure history is loaded
watch(
  () => [...stockStore.selectedStocks],
  async (symbols) => {
    const missing = symbols.filter(
      s => !stockStore.stockHistory[s] || stockStore.stockHistory[s].length === 0
    )
    if (missing.length === 0) return
    chartLoading.value = true
    await Promise.allSettled(
      missing.map(s => stockStore.fetchChartHistory(s, stockStore.chartRange))
    )
    chartLoading.value = false
  },
  { immediate: false }
)

const chartData = computed(() => {
  if (stockStore.selectedStocks.length === 0) return null

  // Collect all unique dates from all selected stocks (unified axis)
  const dateSet = new Set<string>()
  const histories: Record<string, Record<string, number>> = {}

  for (const symbol of stockStore.selectedStocks) {
    const h = stockStore.getHistoryBySymbol(symbol)
    histories[symbol] = {}
    for (const point of h) {
      dateSet.add(point.date)
      histories[symbol][point.date] = point.price
    }
  }

  const allDates = [...dateSet].sort()
  if (allDates.length === 0) return null

  const labels = allDates.map(d => {
    const date = new Date(d)
    return `${date.getMonth() + 1}/${date.getDate()}`
  })

  const datasets = stockStore.selectedStocks.map((symbol, index) => {
    const prices = allDates.map(d => histories[symbol][d] ?? null)
    return {
      label: symbol,
      data: prices,
      spanGaps: stockStore.selectedStocks.length > 1, // connect gaps in compare mode
      borderColor: colors[index % colors.length],
      backgroundColor: colors[index % colors.length] + '20',
      tension: 0.4,
      fill: stockStore.selectedStocks.length === 1,
      pointRadius: 0,
      pointHoverRadius: 6
    }
  })

  return { labels, datasets }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index' as const,
    intersect: false
  },
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: '#667eea',
      borderWidth: 1,
      padding: 12,
      displayColors: true,
      callbacks: {
        label: (context: any) => {
          return `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`
        }
      }
    }
  },
  scales: {
    x: {
      grid: {
        display: false
      },
      ticks: {
        maxTicksLimit: 10
      }
    },
    y: {
      grid: {
        color: 'rgba(0, 0, 0, 0.05)'
      },
      ticks: {
        callback: (value: number) => `$${value}`
      }
    }
  }
}
</script>

<style scoped>
.stock-chart {
  border-radius: 16px;
}

.chart-container {
  height: 400px;
  position: relative;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.gap-2 {
  gap: 8px;
}

.gap-4 {
  gap: 16px;
}

.cursor-pointer {
  cursor: pointer;
}

.text-green {
  color: #4caf50;
}

.text-red {
  color: #f44336;
}
</style>