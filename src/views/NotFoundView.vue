<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="notfound">
    <div class="notfound__card">
      <p class="notfound__code num">404</p>
      <h1 class="notfound__title">这一关不存在</h1>
      <p class="notfound__desc">
        你访问的页面可能已经下架或链接有误。回到成长中心，那里一定还有没通关的关卡。
      </p>
      <div class="notfound__actions">
        <el-button type="primary" round @click="router.push('/growth')">回到成长中心</el-button>
        <el-button round @click="router.push('/map')">去看关卡地图</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notfound {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 24px;
  background:
    radial-gradient(90% 70% at 50% 0%, rgba(30, 123, 232, 0.12), transparent 60%),
    var(--bg);
}

.notfound__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  max-width: 520px;
  padding: 46px 40px;
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  background: var(--surface);
  box-shadow: var(--sh-2);
  text-align: center;
}

.notfound__code {
  color: var(--brand-100);
  font-size: 76px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.04em;
}

.notfound__title {
  font-size: 22px;
  font-weight: 700;
}

.notfound__desc {
  color: var(--ink-2);
  font-size: 13.5px;
  line-height: 1.75;
}

.notfound__actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}
</style>
