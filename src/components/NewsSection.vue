<template>
  <v-card class="news-section" elevation="4">
    <v-card-title class="d-flex align-center">
      <v-icon color="primary" class="mr-2">mdi-newspaper</v-icon>
      {{ $t('news.title') }}
    </v-card-title>
    <v-card-subtitle>{{ $t('news.subtitle') }}</v-card-subtitle>
    <v-card-text>
      <!-- Empty state -->
      <div v-if="stockStore.news.length === 0" class="text-center py-8">
        <v-icon size="48" color="grey-lighten-1" class="mb-2">mdi-newspaper-variant-outline</v-icon>
        <p class="text-body-1 text-grey">{{ $t('news.empty') }}</p>
      </div>

      <template v-else>
        <v-row>
          <v-col
            v-for="item in displayedNews"
            :key="item.id"
            cols="12"
            md="6"
          >
            <v-card
              variant="outlined"
              class="news-item mb-4"
              hover
            >
              <v-card-title class="text-subtitle-1 font-weight-bold">
                {{ item.title }}
              </v-card-title>
              <v-card-text>
                <p class="text-body-2 text-grey-darken-1 mb-3">
                  {{ item.summary }}
                </p>
                <div class="d-flex align-center flex-wrap gap-2">
                  <v-chip
                    v-for="symbol in item.relatedStocks"
                    :key="symbol"
                    size="x-small"
                    color="primary"
                    variant="flat"
                  >
                    {{ symbol }}
                  </v-chip>
                  <v-spacer></v-spacer>
                  <span class="text-caption text-grey">{{ item.source }}</span>
                  <span class="text-caption text-grey">•</span>
                  <span class="text-caption text-grey">{{ formatDate(item.publishedAt) }}</span>
                </div>
              </v-card-text>
              <v-card-actions>
                <v-btn
                  variant="text"
                  color="primary"
                  size="small"
                  :href="item.url"
                  target="_blank"
                >
                  {{ $t('news.readMore') }}
                  <v-icon end size="16">mdi-open-in-new</v-icon>
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>

        <!-- Show more / show less toggle -->
        <div v-if="stockStore.news.length > COLLAPSED_COUNT" class="text-center mt-2">
          <v-btn
            variant="text"
            color="primary"
            @click="expanded = !expanded"
          >
            <v-icon start size="18">
              {{ expanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
            </v-icon>
            {{ expanded ? $t('news.showLess') : $t('news.showMore', { count: stockStore.news.length - COLLAPSED_COUNT }) }}
          </v-btn>
        </div>
      </template>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStockStore } from '@/stores/stocks'

const stockStore = useStockStore()
const { locale } = useI18n()

const COLLAPSED_COUNT = 4
const expanded = ref(false)

const displayedNews = computed(() => {
  if (expanded.value) return stockStore.news
  return stockStore.news.slice(0, COLLAPSED_COUNT)
})

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  
  if (hours < 1) {
    return locale.value === 'zh' ? '剛剛' : 'Just now'
  } else if (hours < 24) {
    return locale.value === 'zh' ? `${hours}小時前` : `${hours}h ago`
  } else {
    return date.toLocaleDateString(locale.value === 'zh' ? 'zh-CN' : 'en-US')
  }
}
</script>

<style scoped>
.news-section {
  border-radius: 16px;
}

.news-item {
  border-radius: 12px;
  transition: all 0.2s ease;
}

.news-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.gap-2 {
  gap: 8px;
}
</style>