<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<style>
.page-enter-active {
  transition:
    opacity 0.2s ease-out,
    transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}

.page-leave-active {
  transition: none;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.page-leave-to {
  opacity: 0;
}
</style>
