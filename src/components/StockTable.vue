<template>
  <v-card class="stock-table mb-6" elevation="4">
    <v-card-title class="d-flex align-center">
      <v-icon color="primary" class="mr-2">mdi-table</v-icon>
      {{ $t('stocks.title') }}
      <v-spacer></v-spacer>

      <!-- Auto Update toggle -->
      <v-switch
        v-model="stockStore.autoUpdate"
        :label="$t('stocks.autoUpdate')"
        hide-details
        density="compact"
        class="mr-4"
      ></v-switch>

      <!-- Add Stock button -->
      <v-btn
        variant="outlined"
        color="primary"
        size="small"
        prepend-icon="mdi-plus"
        class="mr-2"
        @click="addDialog = true"
      >
        {{ $t('stocks.addStock') }}
      </v-btn>

      <!-- Refresh -->
      <v-btn
        icon="mdi-refresh"
        variant="text"
        :loading="stockStore.loading"
        @click="manualUpdate"
      ></v-btn>
    </v-card-title>

    <v-card-subtitle>{{ $t('stocks.subtitle') }}</v-card-subtitle>

    <!-- Error banner -->
    <v-alert
      v-if="stockStore.error"
      type="error"
      variant="tonal"
      closable
      class="mx-4 mt-2"
      density="compact"
      @click:close="stockStore.error = null"
    >
      {{ stockStore.error }}
    </v-alert>

    <!-- Loading indicator -->
    <v-progress-linear
      v-if="stockStore.loading"
      indeterminate
      color="primary"
      class="mx-4 mt-2"
    ></v-progress-linear>

    <v-card-text class="pa-0">
      <v-table>
        <thead>
          <tr>
            <th class="text-center" style="width: 60px"></th>
            <th class="text-left">{{ $t('stocks.symbol') }}</th>
            <th class="text-left">{{ $t('stocks.company') }}</th>
            <th class="text-right">{{ $t('stocks.price') }}</th>
            <th class="text-right">{{ $t('stocks.change') }}</th>
            <th class="text-right">{{ $t('stocks.marketCap') }}</th>
            <th class="text-right hidden-sm-and-down">{{ $t('stocks.volume') }}</th>
            <th class="text-right hidden-md-and-down">{{ $t('stocks.pe') }}</th>
            <th class="text-center" style="width: 40px"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(stock, index) in stockStore.sortedStocks"
            :key="stock.symbol"
            :class="{ 'selected-row': stockStore.selectedStocks.includes(stock.symbol) }"
            @click="selectStock(stock.symbol)"
            class="cursor-pointer"
          >
            <!-- Reorder buttons -->
            <td class="text-center pa-1" @click.stop>
              <div class="d-flex flex-column align-center">
                <v-btn
                  icon="mdi-chevron-up"
                  variant="text"
                  size="x-small"
                  density="compact"
                  :disabled="index === 0"
                  @click="moveStock(stock.symbol, 'up')"
                ></v-btn>
                <v-btn
                  icon="mdi-chevron-down"
                  variant="text"
                  size="x-small"
                  density="compact"
                  :disabled="index === stockStore.sortedStocks.length - 1"
                  @click="moveStock(stock.symbol, 'down')"
                ></v-btn>
              </div>
            </td>

            <!-- Symbol -->
            <td>
              <div class="d-flex align-center">
                <v-avatar size="32" :color="getStockColor(stock.symbol)" class="mr-2">
                  <span class="text-white text-caption font-weight-bold">
                    {{ stock.symbol[0] }}
                  </span>
                </v-avatar>
                <span class="font-weight-bold">{{ stock.symbol }}</span>
              </div>
            </td>

            <!-- Company -->
            <td>
              <div>
                <div class="font-weight-medium">{{ stock.name }}</div>
                <div class="text-caption text-grey">{{ stock.nameZh }}</div>
              </div>
            </td>

            <!-- Price -->
            <td class="text-right">
              <span :class="stock.price > 0 ? 'text-h6 font-weight-bold' : 'text-body-2 text-grey'">
                {{ stock.price > 0 ? '$' + stock.price.toFixed(2) : $t('stocks.loading') }}
              </span>
            </td>

            <!-- Change -->
            <td class="text-right">
              <v-chip
                v-if="stock.price > 0"
                :color="stock.change >= 0 ? 'success' : 'error'"
                size="small"
                variant="flat"
              >
                <v-icon start size="14">
                  {{ stock.change >= 0 ? 'mdi-trending-up' : 'mdi-trending-down' }}
                </v-icon>
                {{ stock.change >= 0 ? '+' : '' }}{{ stock.change.toFixed(2) }}
                ({{ stock.changePercent >= 0 ? '+' : '' }}{{ stock.changePercent.toFixed(2) }}%)
              </v-chip>
              <span v-else class="text-grey">—</span>
            </td>

            <!-- Market Cap -->
            <td class="text-right">{{ stock.marketCap }}</td>

            <!-- Volume -->
            <td class="text-right hidden-sm-and-down">{{ stock.volume }}</td>

            <!-- P/E -->
            <td class="text-right hidden-md-and-down">
              {{ stock.pe > 0 ? stock.pe.toFixed(2) : '—' }}
            </td>

            <!-- Remove button -->
            <td class="text-center pa-1" @click.stop>
              <v-btn
                icon="mdi-close"
                variant="text"
                size="x-small"
                density="compact"
                color="grey"
                @click="confirmRemove(stock.symbol)"
              ></v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card-text>

    <v-divider></v-divider>
    <v-card-actions class="px-4 py-3">
      <v-icon size="small" color="grey" class="mr-2">mdi-clock-outline</v-icon>
      <span class="text-caption text-grey">
        {{ $t('stocks.lastUpdate') }}: {{ formatTime(stockStore.lastUpdate) }}
      </span>
    </v-card-actions>

    <!-- ── Add Stock Dialog ── -->
    <v-dialog v-model="addDialog" max-width="460">
      <v-card>
        <v-card-title>
          <v-icon color="primary" class="mr-2">mdi-plus-circle</v-icon>
          {{ $t('stocks.addStockTitle') }}
        </v-card-title>
        <v-card-text>
          <v-autocomplete
            v-model="selectedSearchResult"
            :items="searchResults"
            :loading="searchLoading"
            :search-input.sync="searchQuery"
            :label="$t('stocks.symbolLabel')"
            :placeholder="$t('stocks.searchPlaceholder')"
            variant="outlined"
            autofocus
            no-filter
            hide-no-data
            return-object
            item-title="title"
            item-value="symbol"
            @update:search="onSearch"
          >
            <template #item="{ props, item }">
              <v-list-item v-bind="props" @click="addFromSearch(item.raw)" :key="item.raw.symbol">
                <template #prepend>
                  <v-avatar size="28" color="grey-lighten-2" class="mr-2">
                    <span class="text-caption font-weight-bold">{{ item.raw.symbol[0] }}</span>
                  </v-avatar>
                </template>
                <template #title>
                  <span class="font-weight-bold">{{ item.raw.symbol }}</span>
                  <span class="text-caption text-grey ml-2">{{ item.raw.exchange }}</span>
                </template>
                <template #subtitle>
                  {{ item.raw.name }}
                </template>
              </v-list-item>
            </template>
          </v-autocomplete>
          <p v-if="addError" class="text-caption text-error mt-1">{{ addError }}</p>
          <p v-else class="text-caption text-grey mt-1">
            {{ $t('stocks.searchHint') }}
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeAddDialog">{{ $t('stocks.cancel') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ── Confirm Remove Dialog ── -->
    <v-dialog v-model="removeDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t('stocks.removeTitle') }}</v-card-title>
        <v-card-text>
          {{ $t('stocks.removeConfirm', { symbol: removeTarget }) }}
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="removeDialog = false">{{ $t('stocks.cancel') }}</v-btn>
          <v-btn color="error" @click="doRemoveStock">{{ $t('stocks.remove') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useStockStore } from '@/stores/stocks'
import axios from 'axios'

const stockStore = useStockStore()

let updateInterval: number | null = null

// ── Stock colors ──
const getStockColor = (symbol: string) => {
  const colors: Record<string, string> = {
    NVDA: '#76b900',
    AAPL: '#555555',
    GOOGL: '#4285f4',
    MSFT: '#00a4ef',
    AMZN: '#ff9900',
    TSLA: '#e31937',
    META: '#1877f2',
    TSM: '#0076c0',
    AMD: '#ed1c24',
    INTC: '#0071c5',
  }
  return colors[symbol] || 'primary'
}

// ── Select stock ──
const selectStock = (symbol: string) => {
  stockStore.selectStock(symbol)
}

// ── Move (reorder) ──
const moveStock = (symbol: string, direction: 'up' | 'down') => {
  stockStore.moveStock(symbol, direction)
}

// ── Manual refresh ──
const manualUpdate = () => {
  stockStore.fetchQuotes()
  stockStore.fetchAllHistory()
}

// ── Add stock dialog (autocomplete search) ──
const addDialog = ref(false)
const addError = ref('')
const searchQuery = ref('')
const searchLoading = ref(false)
const searchResults = ref<Array<{ symbol: string; name: string; exchange: string; title: string }>>([])
const selectedSearchResult = ref(null)

let searchTimer: ReturnType<typeof setTimeout> | null = null

interface YahooSearchQuote {
  symbol: string
  shortname?: string
  longname?: string
  exchange?: string
  quoteType?: string
}

const PROXY_BASE = 'https://stock-proxy.pangtongsanguo.workers.dev/?url='
const SEARCH_API = 'https://query1.finance.yahoo.com/v1/finance/search'

function closeAddDialog() {
  addDialog.value = false
  searchQuery.value = ''
  searchResults.value = []
  addError.value = ''
  selectedSearchResult.value = null
}

function onSearch(query: string | null) {
  if (searchTimer) clearTimeout(searchTimer)
  addError.value = ''

  if (!query || query.trim().length < 1) {
    searchResults.value = []
    return
  }

  searchLoading.value = true
  searchTimer = setTimeout(async () => {
    try {
      const url = SEARCH_API + '?q=' + encodeURIComponent(query.trim()) + '&quotesCount=8'
      const { data } = await axios.get(PROXY_BASE + encodeURIComponent(url), { timeout: 8000 })

      const quotes: YahooSearchQuote[] = data?.quotes ?? []
      searchResults.value = quotes
        .filter(q => q.quoteType === 'EQUITY' && q.symbol && !q.symbol.includes('.'))
        .map(q => ({
          symbol: q.symbol,
          name: q.shortname || q.longname || q.symbol,
          exchange: q.exchange || '',
          title: `${q.symbol} — ${q.shortname || q.longname || ''}`,
        }))
    } catch {
      searchResults.value = []
    } finally {
      searchLoading.value = false
    }
  }, 300)
}

function addFromSearch(item: { symbol: string; name: string }) {
  if (!item?.symbol) return
  const ok = stockStore.addStock(item.symbol)
  if (!ok) {
    addError.value = `"${item.symbol}" 已存在 / Already added`
  } else {
    closeAddDialog()
  }
}

// ── Remove stock dialog ──
const removeDialog = ref(false)
const removeTarget = ref('')

function confirmRemove(symbol: string) {
  removeTarget.value = symbol
  removeDialog.value = true
}

function doRemoveStock() {
  stockStore.removeStock(removeTarget.value)
  removeDialog.value = false
}

// ── Format time ──
const formatTime = (date: Date | null) => {
  if (!date) return '—'
  return new Date(date).toLocaleTimeString()
}

// ── Init + auto-refresh ──
onMounted(async () => {
  await stockStore.init()

  updateInterval = window.setInterval(() => {
    if (stockStore.autoUpdate) {
      stockStore.fetchQuotes()
    }
  }, 60000) // Refresh every 60 seconds with real API
})

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval)
  }
})
</script>

<style scoped>
.stock-table {
  border-radius: 16px;
}

.selected-row {
  background-color: rgba(102, 126, 234, 0.1);
}

.cursor-pointer {
  cursor: pointer;
}

tr:hover {
  background-color: rgba(0, 0, 0, 0.03);
}
</style>