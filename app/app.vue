<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<style>
.page-enter-active {
  transition: all 0.2s cubic-bezier(0.68, -0.8, 0.265, 1.8);
}

.page-leave-active {
  transition: none;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(40px);
}

.page-leave-to {
  opacity: 0;
}
</style>
