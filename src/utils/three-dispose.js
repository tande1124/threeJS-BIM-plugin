import * as THREE from 'three'

/**
 * 递归释放 Three.js Object3D 及其子树中所有 GPU 资源
 * 包括几何体（Geometry）、材质（Material）以及材质中引用的纹理（Texture）
 *
 * @param {THREE.Object3D} root - 需要递归释放的根节点
 */
export function disposeObject3D(root) {
  const disposedTextures = new Set()
  const disposedMaterials = new Set()
  const disposedGeometries = new Set()

  root.traverse((object) => {
    const geometry = object.geometry
    if (geometry && !disposedGeometries.has(geometry)) {
      disposedGeometries.add(geometry)
      geometry.dispose()
    }

    const material = object.material
    const materials = Array.isArray(material) ? material : material ? [material] : []
    for (const mat of materials) {
      if (!mat || disposedMaterials.has(mat)) continue
      disposedMaterials.add(mat)

      // 释放材质中引用的纹理（去重避免共享纹理被多次 dispose）
      for (const value of Object.values(mat)) {
        if (value && typeof value === 'object' && 'isTexture' in value && !disposedTextures.has(value)) {
          disposedTextures.add(value)
          value.dispose()
        }
      }
      mat.dispose()
    }
  })
}
