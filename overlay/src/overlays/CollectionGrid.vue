<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { GameView } from '../types'
import GameCard from '../components/GameCard.vue'

const props = defineProps<{
  title: string
  description?: string | null
  items: GameView[]
  pageSize?: number
  pageMs?: number
}>()

const pageSize = computed(() => Math.max(1, props.pageSize ?? 18))
const pageMs = computed(() => props.pageMs ?? 10_000)

const pages = computed<GameView[][]>(() => {
  const out: GameView[][] = []
  for (let i = 0; i < props.items.length; i += pageSize.value) {
    out.push(props.items.slice(i, i + pageSize.value))
  }
  return out.length ? out : [[]]
})

const page = ref(0)
const shown = computed(() => pages.value[Math.min(page.value, pages.value.length - 1)] ?? [])

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  if (pages.value.length <= 1) return
  timer = setInterval(() => {
    if (page.value >= pages.value.length - 1) {
      // Last page reached — stop advancing; the bus hides the whole overlay shortly after.
      clearInterval(timer)
      timer = undefined
      return
    }
    page.value += 1
  }, pageMs.value)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="collection">
    <div class="header">
      <div class="eyebrow">Collection</div>
      <div class="titlerow">
        <div class="title">{{ title }}</div>
        <div v-if="pages.length > 1" class="pageno">{{ page + 1 }} / {{ pages.length }}</div>
      </div>
      <div v-if="description" class="desc">{{ description }}</div>
    </div>

    <!-- Keying on `page` re-triggers the staggered entrance each time we advance. -->
    <div :key="page" class="grid">
      <GameCard
        v-for="(g, i) in shown"
        :key="g.id"
        :game="g"
        class="cell"
        :style="{ animationDelay: `${i * 45}ms` }"
      />
    </div>
  </div>
</template>

<style scoped>
.collection {
  width: min(1280px, 92vw);
  padding: 28px 32px;
  border-radius: var(--gs-panel-radius);
  background: var(--gs-panel-bg);
  border: 1px solid var(--gs-panel-border);
  box-shadow: var(--gs-panel-shadow);
  backdrop-filter: blur(var(--gs-panel-blur));
  color: var(--gs-text);
}

.header {
  margin-bottom: 22px;
}
.eyebrow {
  font-size: 12px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--gs-eyebrow);
  font-weight: 700;
}
.titlerow {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-top: 4px;
}
.title {
  font-size: 34px;
  font-weight: 800;
  line-height: 1.1;
}
.pageno {
  font-size: 15px;
  font-weight: 700;
  color: var(--gs-accent-soft);
  white-space: nowrap;
}
.desc {
  margin-top: 6px;
  font-size: 15px;
  color: var(--gs-text-dim);
  max-width: 70ch;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 140px);
  gap: 20px 18px;
  justify-content: center;
}
.cell {
  animation: rise 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes rise {
  from {
    transform: translateY(16px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
