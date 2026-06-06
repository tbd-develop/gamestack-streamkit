<script setup lang="ts">
import { computed } from 'vue'
import type { GameView } from '../types'
import GameInfoCard from '../components/GameInfoCard.vue'

const props = defineProps<{ query: string; items: GameView[] }>()
const game = computed<GameView | undefined>(() => props.items[0])
</script>

<template>
  <GameInfoCard v-if="game" :game="game" :label="`Searched “${query}”`" />
</template>
