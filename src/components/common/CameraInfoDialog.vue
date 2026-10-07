<template>
  <!-- 右键上下文菜单 -->
  <div v-if="menuVisible" class="context-menu" :style="{ left: menuX + 'px', top: menuY + 'px' }">
    <div class="context-menu-item" @click="showCameraInfo">查看相机参数</div>
  </div>

  <!-- 相机参数弹窗 -->
  <div v-if="dialogVisible" class="camera-dialog-overlay" @click.self="dialogVisible = false">
    <div class="camera-dialog-box">
      <div class="camera-dialog-title">
        <span>当前相机参数</span>
      </div>
      <div class="camera-dialog-content">
        <div class="camera-dialog-json">{{ cameraInfoText }}</div>
      </div>
      <div class="camera-dialog-footer">
        <button class="camera-dialog-btn" @click="dialogVisible = false">取消</button>
        <button class="camera-dialog-btn camera-dialog-btn--primary" @click="handleCopy">复制</button>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue'

/**
 * 相机参数弹窗组件。
 *
 * 在 viewer 画布上右键时显示上下文菜单，点击"查看相机参数"后弹出弹窗，
 * 展示当前相机 position / target（格式与 biz-config.js camera 配置一致），
 * 支持一键复制粘贴到配置文件。
 */
export default defineComponent({
  name: 'CameraInfoDialog',
  props: {
    /** BimViewerController 实例 */
    controller: {
      type: Object,
      default: null,
    },
  },
  data() {
    return {
      // 右键菜单
      menuVisible: false,
      menuX: 0,
      menuY: 0,
      // 弹窗
      dialogVisible: false,
      cameraInfoText: '',
      // 内部引用
      _canvas: null,
      _onContextMenu: null,
      _onClickOutside: null,
    }
  },
  watch: {
    controller: {
      handler(val) {
        this.detachCanvas()
        if (val) this.attachCanvas()
      },
      immediate: true,
    },
  },
  beforeUnmount() {
    this.detachCanvas()
  },
  methods: {
    /** 绑定 canvas 的 contextmenu 事件 */
    attachCanvas() {
      const canvas = this.controller?.renderer?.domElement
      if (!canvas) return
      this._canvas = canvas

      this._onContextMenu = (e) => this.handleContextMenu(e)
      canvas.addEventListener('contextmenu', this._onContextMenu)

      // 点击任意位置关闭菜单
      this._onClickOutside = () => { this.menuVisible = false }
      document.addEventListener('click', this._onClickOutside)
    },

    /** 解绑 canvas 事件 */
    detachCanvas() {
      if (this._canvas && this._onContextMenu) {
        this._canvas.removeEventListener('contextmenu', this._onContextMenu)
      }
      if (this._onClickOutside) {
        document.removeEventListener('click', this._onClickOutside)
      }
      this._canvas = null
      this._onContextMenu = null
      this._onClickOutside = null
    },

    /** 右键：阻止默认菜单，在鼠标位置显示上下文菜单 */
    handleContextMenu(e) {
      e.preventDefault()
      e.stopPropagation()
      this.menuX = e.clientX
      this.menuY = e.clientY
      this.menuVisible = true
    },

    /** 点击"查看当前视角"：关闭菜单，收集相机参数，弹出弹窗 */
    showCameraInfo() {
      this.menuVisible = false

      const cm = this.controller?.getCameraManager?.()
      if (!cm) return

      const pos = cm.camera.position
      const tgt = cm.controls.target

      // 格式与 biz-config.js camera 配置保持一致，可直接粘贴
      this.cameraInfoText =
        `camera: {
    position: { x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)} },
    target: { x: ${tgt.x.toFixed(2)}, y: ${tgt.y.toFixed(2)}, z: ${tgt.z.toFixed(2)} }
}`

      this.dialogVisible = true
    },

    /** 降级复制方案（不依赖 clipboard API） */
    fallbackCopy(text) {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.top = '-9999px'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      try {
        document.execCommand('copy')
        this.showToast('已复制')
      } catch {
        this.showToast('复制失败，请手动复制')
      }
      document.body.removeChild(textarea)
    },

    /** 复制视角信息到剪贴板 */
    async handleCopy() {
      const text = this.cameraInfoText
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text)
          this.showToast('已复制')
        } else {
          this.fallbackCopy(text)
          return
        }
      } catch {
        this.fallbackCopy(text)
        return
      }
      this.dialogVisible = false
    },

    /** 简易 toast 提示（不引入额外 UI 库依赖） */
    showToast(msg) {
      const el = document.createElement('div')
      el.textContent = msg
      Object.assign(el.style, {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '6px 16px',
        background: 'rgba(32,160,255,0.8)',
        color: '#fff',
        borderRadius: '4px',
        fontSize: '14px',
        zIndex: '99999',
        pointerEvents: 'none',
        transition: 'opacity 0.3s',
      })
      document.body.appendChild(el)
      setTimeout(() => {
        el.style.opacity = '0'
        setTimeout(() => el.remove(), 300)
      }, 1200)
    },
  },
})
</script>

<style lang="scss" scoped>
/* ========== 右键上下文菜单 ========== */
.context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 140px;
  background: rgba(30, 36, 50, 0.85);
  border: 1px solid rgba(32, 160, 255, 0.5);
  border-radius: 4px;
  animation: contextMenuFadeIn 0.1s ease-out;
}

@keyframes contextMenuFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

.context-menu-item {
  padding: 8px 16px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;

  &:hover {
    background: rgba(32, 160, 255, 0.2);
  }
}

/* ========== 视角信息弹窗 ========== */

/* 遮罩 */
.camera-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 弹窗本体 */
.camera-dialog-box {
  position: relative;
  min-width: 380px;
  max-width: 500px;
  background-color: transparent;
  border: 1px solid rgba(32, 160, 255, 0.6);
  border-radius: 5px;
  box-shadow: 1px 1px 50px rgba(0, 0, 0, 0.3);
  animation: cameraDialogFadeIn 0.15s ease-out;
  overflow: hidden;
}

@keyframes cameraDialogFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 标题栏 */
.camera-dialog-title {
  display: flex;
  justify-content: space-between;
  padding: 0 10px;
  height: 40px;
  line-height: 40px;
  border-bottom: 1px solid rgba(32, 160, 255, 0.3);
  background: rgba(30, 36, 50, 0.6);
  color: #fff;
  font-size: 16px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* 内容区 */
.camera-dialog-content {
  padding: 10px 20px 0;
  font-size: 14px;
  line-height: 1.8;
  color: #fff;
  background-color: rgba(30, 36, 50, 0.6);
  max-height: 300px;
  overflow-y: auto;
  word-break: break-all;
}

.camera-dialog-json {
  margin: 0;
  padding: 12px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  user-select: text;
}

/* 底部按钮区 */
.camera-dialog-footer {
  padding: 8px 5px 12px;
  background-color: rgba(30, 36, 50, 0.6);
  display: flex;
  justify-content: flex-end;
}

.camera-dialog-btn {
  display: inline-block;
  height: 32px;
  line-height: 32px;
  margin: 0 4px;
  padding: 0 18px;
  border: 1px solid rgba(32, 160, 255, 0.4);
  border-radius: 2px;
  background: transparent;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  outline: none;
  transition: background 0.2s, border-color 0.2s;

  &:hover {
    background: rgba(32, 160, 255, 0.15);
    border-color: rgba(32, 160, 255, 0.7);
  }

  &:active {
    background: rgba(32, 160, 255, 0.25);
  }
}

/* 主按钮（复制） */
.camera-dialog-btn--primary {
  background: rgba(32, 160, 255, 0.25);
  border-color: rgba(32, 160, 255, 0.6);

  &:hover {
    background: rgba(32, 160, 255, 0.4);
  }
}
</style>
