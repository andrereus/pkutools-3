<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<style>
.page-enter-active {
  transition: all 0.1s ease-out;
}

.page-leave-active {
  transition: none;
}

.page-enter-from {
  opacity: 0;
  transform: scale(0.97);
}

.page-leave-to {
  opacity: 0;
}
</style>
