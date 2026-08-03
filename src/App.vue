<template>
  <v-app>
    <!-- App Bar -->
    <v-app-bar color="primary" elevation="2">
      <v-app-bar-title class="d-flex align-center">
        <v-icon size="32" class="mr-2">mdi-chart-areaspline</v-icon>
        <span class="font-weight-bold">{{ $t('nav.title') }}</span>
      </v-app-bar-title>
      <v-spacer></v-spacer>

      <!-- Theme Toggle -->
      <v-btn
        variant="text"
        color="white"
        @click="toggleTheme"
        class="text-none mr-2"
      >
        <v-icon start>{{ theme.global.name.value === 'light' ? 'mdi-weather-night' : 'mdi-white-balance-sunny' }}</v-icon>
        {{ theme.global.name.value === 'light' ? (locale === 'zh' ? '深色' : 'Dark') : (locale === 'zh' ? '淺色' : 'Light') }}
      </v-btn>

      <!-- Language Switch -->
      <v-btn
        variant="text"
        color="white"
        @click="toggleLanguage"
        class="text-none"
      >
        <v-icon start>mdi-translate</v-icon>
        {{ locale === 'zh' ? 'English' : '中文' }}
      </v-btn>
    </v-app-bar>

    <!-- Main Content -->
    <v-main :class="theme.global.name.value === 'light' ? 'bg-grey-lighten-4' : 'bg-grey-darken-4'">
      <v-container class="py-6 px-2 px-md-6 px-lg-12">
        <!-- Page Title -->
        <v-row justify="center" class="mb-6">
          <v-col cols="12" class="text-center">
            <h1 class="text-h3 font-weight-bold text-primary mb-2">
              {{ $t('nav.title') }}
            </h1>
          </v-col>
        </v-row>

        <!-- Stock Table -->
        <v-row justify="center">
          <v-col cols="12">
            <StockTable />
          </v-col>
        </v-row>

        <!-- Stock Chart -->
        <v-row justify="center">
          <v-col cols="12">
            <StockChart />
          </v-col>
        </v-row>

        <!-- News Section -->
        <v-row justify="center">
          <v-col cols="12">
            <NewsSection />
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <!-- Footer -->
    <v-footer :class="theme.global.name.value === 'light' ? 'bg-grey-darken-3 text-white' : 'bg-black text-white'" class="py-4">
      <v-container>
        <div class="text-center">
          <p class="text-body-2 mb-1">
            Tech Stock Tracker | 科技股追蹤
          </p>
          <p class="text-caption text-grey-lighten-1">
            Data from Yahoo Finance | 數據來源 Yahoo Finance
          </p>
        </div>
      </v-container>
    </v-footer>
  </v-app>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useTheme } from 'vuetify'
import StockTable from '@/components/StockTable.vue'
import StockChart from '@/components/StockChart.vue'
import NewsSection from '@/components/NewsSection.vue'

const { locale } = useI18n()
const theme = useTheme()

const toggleLanguage = () => {
  locale.value = locale.value === 'zh' ? 'en' : 'zh'
  localStorage.setItem('preferred-language', locale.value)
}

const toggleTheme = () => {
  theme.global.name.value = theme.global.name.value === 'light' ? 'dark' : 'light'
  localStorage.setItem('preferred-theme', theme.global.name.value)
}
</script>

<style>
.bg-grey-lighten-4 {
  background-color: #f5f5f5;
}
</style>