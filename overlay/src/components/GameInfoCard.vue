<script setup lang="ts">
import type { GameView } from '../types'

defineProps<{ game: GameView; label: string }>()
</script>

<template>
  <div class="card">
    <div class="cover">
      <img v-if="game.coverImageUrl" :src="game.coverImageUrl" :alt="game.title" />
      <div v-else class="cover-fallback">{{ game.title.charAt(0) }}</div>
    </div>

    <div class="body">
      <div class="eyebrow">{{ label }}</div>
      <div class="title">{{ game.title }}</div>

      <div class="meta">
        <span class="pill platform">{{ game.platform }}</span>
        <span v-if="game.releaseYear" class="pill">{{ game.releaseYear }}</span>
        <span class="pill">{{ game.copyCount }} {{ game.copyCount === 1 ? 'copy' : 'copies' }}</span>
      </div>

      <div v-if="game.genres.length" class="genres">
        <span v-for="g in game.genres.slice(0, 4)" :key="g" class="chip">{{ g }}</span>
      </div>

      <p v-if="game.description" class="desc">{{ game.description }}</p>

      <div v-if="game.rating != null" class="rating">
        <div class="bar"><div class="fill" :style="{ width: `${game.rating}%` }" /></div>
        <span class="num">{{ Math.round(game.rating) }}<small>/100</small></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  display: flex;
  gap: 22px;
  width: 580px;
  padding: 22px;
  border-radius: var(--gs-panel-radius);
  background: var(--gs-panel-bg);
  border: 1px solid var(--gs-panel-border);
  box-shadow: var(--gs-panel-shadow);
  backdrop-filter: blur(var(--gs-panel-blur));
  color: var(--gs-text);
  animation: slideUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes slideUp {
  from {
    transform: translateY(24px) scale(0.98);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

.cover {
  flex: 0 0 132px;
  width: 132px;
  height: 176px;
  border-radius: 12px;
  overflow: hidden;
  background: var(--gs-cover-bg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cover-fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  font-size: 64px;
  font-weight: 800;
  color: var(--gs-cover-fallback);
}

.body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.eyebrow {
  font-size: 12px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--gs-eyebrow);
  font-weight: 700;
  margin-bottom: 6px;
}

.title {
  font-size: 28px;
  line-height: 1.1;
  font-weight: 800;
  margin-bottom: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}
.pill {
  font-size: 13px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--gs-pill-bg);
  border: 1px solid var(--gs-pill-border);
}
.pill.platform {
  background: var(--gs-accent-pill-bg);
  border-color: var(--gs-accent-pill-border);
  color: var(--gs-accent-soft);
}

.genres {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.chip {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--gs-text-dim);
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--gs-chip-bg);
}

.desc {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.4;
  color: var(--gs-text-muted);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.rating {
  display: flex;
  align-items: center;
  gap: 10px;
}
.bar {
  position: relative;
  height: 8px;
  flex: 1 1 auto;
  border-radius: 999px;
  background: var(--gs-rating-track);
  overflow: hidden;
}
.fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  background: var(--gs-rating-fill);
}
.num {
  font-size: 14px;
  font-weight: 700;
  color: var(--gs-text-rating);
  min-width: 40px;
  text-align: right;
}
.num small {
  font-size: 11px;
  color: var(--gs-text-dim);
  font-weight: 600;
}
</style>
