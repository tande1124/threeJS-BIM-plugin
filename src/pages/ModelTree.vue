<template>
  <div class="model-tree-node">
    <div class="tree-item" @click="toggle">
      <span v-if="node.children.length" class="expand-icon">{{ expanded ? '▼' : '▶' }}</span>
      <span v-else class="expand-placeholder"></span>
      <span class="node-name">{{ node.name }}</span>
      <el-tag size="small" type="info">{{ node.type }}</el-tag>
      <span v-if="node.children.length" class="child-count">({{ node.children.length }})</span>
    </div>
    <div v-show="expanded && node.children.length" class="tree-children">
      <ModelTree
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :bimViewer="bimViewer"
      />
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ModelTree',
  props: {
    /** 树节点数据（来自 buildTreeNode） */
    node: {
      type: Object,
      required: true,
    },
    /** InsBimViewer 组件引用，用于高亮/飞行定位 */
    bimViewer: {
      type: Object,
      default: null,
    },
  },
  data() {
    return {
      expanded: false,
    }
  },
  methods: {
    toggle() {
      // 有子节点则展开/折叠，同时高亮对应 3D 对象
      if (this.node.children.length) {
        this.expanded = !this.expanded
      }
      this.highlightObject()
    },
    highlightObject() {
      if (!this.bimViewer || !this.node.name || this.node.name === '(未命名)') return
      this.bimViewer.highlightPart(this.node.name)
    },
  },
})
</script>

<style scoped>
.model-tree-node {
  font-size: 12px;
  line-height: 1.6;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  cursor: pointer;
  border-radius: 3px;
  user-select: none;
}

.tree-item:hover {
  background-color: rgba(64, 158, 255, 0.1);
}

.expand-icon {
  font-size: 10px;
  width: 12px;
  text-align: center;
  color: #909399;
  flex-shrink: 0;
}

.expand-placeholder {
  width: 12px;
  flex-shrink: 0;
}

.node-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #303133;
}

.child-count {
  color: #909399;
  font-size: 11px;
}

.tree-children {
  padding-left: 16px;
  border-left: 1px dashed #dcdfe6;
  margin-left: 8px;
}
</style>
