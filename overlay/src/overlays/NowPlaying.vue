<script setup lang="ts">
import type { GameView } from '../types'
import GameInfoCard from '../components/GameInfoCard.vue'

defineProps<{ game: GameView }>()
</script>

<template>
  <GameInfoCard :game="game" label="Now Playing" />
</template>
