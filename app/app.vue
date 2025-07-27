<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: all 0.1s ease-out;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
</style>
