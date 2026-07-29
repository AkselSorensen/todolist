<script setup lang="ts">
const { fetchMe } = useAuth()

// Initialize auth state on app mount
onMounted(async () => {
  await fetchMe()
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
