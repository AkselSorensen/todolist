<script setup lang="ts">
// Investissement = les pistes de placement + ce qu'on possède déjà
const ideasRef = ref<any>(null)
const assetsRef = ref<any>(null)

defineExpose({ openCreate: () => ideasRef.value?.openCreate() })
</script>

<template>
  <div>
    <BusinessIdeas ref="ideasRef" domain="investment" />
    <BusinessAssets ref="assetsRef" />
  </div>
</template>
