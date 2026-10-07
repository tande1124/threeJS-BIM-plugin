<template>
  <div class="part-label">
    <div class="part-label-dot"></div>
    <div class="part-label-card">
      <div class="part-label-name">{{ name }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PartInfoLabel',
  props: {
    /** 部件名称 */
    name: { type: String, default: '' },
    /** 部件路径 */
    path: { type: String, default: '' },
  },
}
</script>

<style lang="scss" scoped>
.part-label {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  transform: translateY(-100%);
  pointer-events: auto;
}

/* 锚点圆点 */
.part-label-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(32, 160, 255, 0.9);
  box-shadow: 0 0 6px rgba(32, 160, 255, 0.6);
  flex-shrink: 0;
}

/* 信息卡片 */
.part-label-card {
  background: rgba(30, 36, 50, 0.85);
  border: 1px solid rgba(32, 160, 255, 0.5);
  border-radius: 4px;
  padding: 6px 10px;
  min-width: 100px;
  max-width: 220px;
}

.part-label-name {
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

</style>
