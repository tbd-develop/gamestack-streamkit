<script setup lang="ts">
// Compact game tile, reused by the collection/search overlays (Phase 2).
import type { GameView } from '../types'

defineProps<{ game: GameView }>()
</script>

<template>
  <div class="tile">
    <div class="cover">
      <img v-if="game.coverImageUrl" :src="game.coverImageUrl" :alt="game.title" />
      <div v-else class="fallback">{{ game.title.charAt(0) }}</div>
    </div>
    <div class="caption">
      <div class="title">{{ game.title }}</div>
      <div class="platform">{{ game.platform }}</div>
    </div>
  </div>
</template>

<style scoped>
.tile {
  width: 140px;
  color: var(--gs-text);
}
.cover {
  width: 140px;
  height: 187px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--gs-cover-bg);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45);
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  font-size: 48px;
  font-weight: 800;
  color: var(--gs-cover-fallback);
}
.caption {
  margin-top: 8px;
}
.title {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.platform {
  font-size: 12px;
  color: var(--gs-text-dim);
}
</style>
