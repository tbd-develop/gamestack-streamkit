<script setup lang="ts">
import { computed } from 'vue'
import { useOverlaySocket } from './useOverlaySocket'
import NowPlaying from './overlays/NowPlaying.vue'
import CollectionGrid from './overlays/CollectionGrid.vue'
import SearchPopup from './overlays/SearchPopup.vue'

const { activeShow } = useOverlaySocket()

const nowPlaying = computed(() => (activeShow.value?.overlay === 'now-playing' ? activeShow.value.data : null))
const collection = computed(() => (activeShow.value?.overlay === 'collection' ? activeShow.value.data : null))
const search = computed(() => (activeShow.value?.overlay === 'search' ? activeShow.value.data : null))

// Stable key so the Transition swaps whenever the active overlay changes.
const overlayKey = computed(() => {
  const s = activeShow.value
  if (!s) return 'none'
  if (s.overlay === 'now-playing') return `np-${s.data.id}`
  if (s.overlay === 'collection') return `col-${s.data.title}`
  return `srch-${s.data.query}`
})
</script>

<template>
  <div class="stage">
    <Transition name="fade" mode="out-in">
      <div :key="overlayKey" class="layer">
        <div v-if="nowPlaying" class="anchor bottom-left">
          <NowPlaying :game="nowPlaying" />
        </div>
        <div v-else-if="collection" class="anchor center">
          <CollectionGrid v-bind="collection" />
        </div>
        <div v-else-if="search" class="anchor bottom-right">
          <SearchPopup v-bind="search" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.stage {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

.layer {
  position: fixed;
  inset: 0;
}

.anchor {
  position: absolute;
}
.anchor.bottom-left {
  left: 48px;
  bottom: 48px;
}
.anchor.center {
  inset: 0;
  display: grid;
  place-items: center;
}
.anchor.bottom-center {
  left: 0;
  right: 0;
  bottom: 48px;
  display: flex;
  justify-content: center;
}
.anchor.bottom-right {
  right: 48px;
  bottom: 48px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
