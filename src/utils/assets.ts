import type { AssetNode, FlatAsset } from '../api/types'

export function flattenAssetTree(nodes: AssetNode[]): FlatAsset[] {
  const result: FlatAsset[] = []

  function walk(node: AssetNode, depth: number, path: string[]) {
    const nextPath = [...path, node.name]
    result.push({
      id: node.id,
      name: node.name,
      codename: node.codename,
      assetlevel_id: node.assetlevel_id,
      depth,
      label: nextPath.join(' › '),
    })
    for (const child of node.children ?? []) {
      walk(child, depth + 1, nextPath)
    }
  }

  for (const node of nodes) {
    walk(node, 0, [])
  }

  return result
}

export function findDefaultAsset(assets: FlatAsset[]): FlatAsset | undefined {
  return (
    assets.find((a) => a.assetlevel_id === 40) ??
    assets.find((a) => a.assetlevel_id === 20) ??
    assets.find((a) => a.assetlevel_id === 10) ??
    assets.find((a) => a.depth > 0) ??
    assets[0]
  )
}
