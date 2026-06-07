<script setup lang="ts">
// Compact game tile, reused by the collection/search overlays (Phase 2).
import type { GameView } from '../types'

defineProps<{ game: GameView }>()
</script>

<template>
  <div class="tile" :class="{ 'is-completed': game.isCompleted }">
    <div class="cover">
      <img v-if="game.coverImageUrl" :src="game.coverImageUrl" :alt="game.title" />
      <div v-else class="fallback">{{ game.title.charAt(0) }}</div>
      <div v-if="game.isCompleted" class="check" aria-label="Completed" role="img">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
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
  position: relative;
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

/* ── Completed treatment: dim + desaturate the cover, overlay a large check ── */
.is-completed .cover img,
.is-completed .cover .fallback {
  filter: grayscale(0.7) brightness(0.5);
}
.check {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--gs-text);
}
.check svg {
  width: 64px;
  height: 64px;
  padding: 12px;
  border-radius: 999px;
  background: rgb(var(--gs-accent-rgb) / 0.85);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
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
.is-completed .title {
  color: var(--gs-text-dim);
}
</style>
