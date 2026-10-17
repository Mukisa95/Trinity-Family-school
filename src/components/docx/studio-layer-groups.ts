import { makeStudioId, type CustomPhotoLayer, type CustomPhotoPage } from './custom-photo-types';

export function studioGroupBounds(layers: CustomPhotoLayer[]) {
  if (!layers.length) return { x: 0, y: 0, width: 0, height: 0 };
  const x = Math.min(...layers.map(layer => layer.x)), y = Math.min(...layers.map(layer => layer.y));
  return { x, y, width: Math.max(...layers.map(layer => layer.x + layer.width)) - x, height: Math.max(...layers.map(layer => layer.y + layer.height)) - y };
}

export function groupStudioLayers(page: CustomPhotoPage, ids: string[], name = 'Group', id = makeStudioId('group')): CustomPhotoPage {
  const selected = page.layers.filter(layer => ids.includes(layer.id));
  if (selected.length < 2) throw new Error('Select at least two layers.');
  if (selected.some(layer => layer.groupId || layer.locked)) throw new Error('Ungroup or unlock the selected layers first.');
  const members = selected.map(layer => ({ ...layer, groupId: id }));
  const last = Math.max(...selected.map(layer => page.layers.indexOf(layer)));
  // Group PDF overlays logically without moving any object across protected artwork.
  const layers = page.pdfArtwork ? page.layers.map(layer => ids.includes(layer.id) ? { ...layer, groupId: id } : layer)
    : page.layers.flatMap((layer, index) => index === last ? members : ids.includes(layer.id) ? [] : [layer]);
  return { ...page, groups: [...(page.groups || []), { id, name }], layers };
}

/** Group children stay together in the list; painting retains each child's PDF plane. */
export function studioLayerTree(page: CustomPhotoPage) {
  const ordered = [...page.layers].sort((a, b) => page.pdfArtwork ? Number(a.pdfPlacement !== 'below') - Number(b.pdfPlacement !== 'below') : 0).reverse();
  const seen = new Set<string>();
  return ordered.flatMap(layer => {
    if (!layer.groupId || !page.groups?.some(group => group.id === layer.groupId)) return [layer];
    if (seen.has(layer.groupId)) return [];
    seen.add(layer.groupId); return ordered.filter(member => member.groupId === layer.groupId);
  });
}

export function moveStudioLayers(page: CustomPhotoPage, ids: string[], dx: number, dy: number): CustomPhotoPage {
  const members = page.layers.filter(layer => ids.includes(layer.id));
  if (!members.length || members.some(layer => layer.locked)) return page;
  const clampDelta = (delta: number, axis: 'x' | 'y', size: 'width' | 'height') => {
    const low = Math.max(...members.map(layer => (layer.constrainToPage ? 0 : -.5) - layer[axis]));
    const high = Math.min(...members.map(layer => (layer.constrainToPage ? 1 - layer[size] : 1.5) - layer[axis]));
    return Math.max(low, Math.min(high, delta));
  };
  const x = clampDelta(dx, 'x', 'width'), y = clampDelta(dy, 'y', 'height');
  return { ...page, layers: page.layers.map(layer => ids.includes(layer.id) ? { ...layer, x: layer.x + x, y: layer.y + y } : layer) };
}

export function ungroupStudioLayers(page: CustomPhotoPage, id: string): CustomPhotoPage {
  return { ...page, groups: page.groups?.filter(group => group.id !== id), layers: page.layers.map(layer => layer.groupId === id ? { ...layer, groupId: undefined } : layer) };
}

export function removeStudioGroup(page: CustomPhotoPage, id: string): CustomPhotoPage {
  return { ...page, groups: page.groups?.filter(group => group.id !== id), layers: page.layers.filter(layer => layer.groupId !== id) };
}

export function duplicateStudioGroup(page: CustomPhotoPage, id: string): { page: CustomPhotoPage; groupId: string } {
  const group = page.groups?.find(item => item.id === id);
  if (!group) throw new Error('This layer group is unavailable.');
  const groupId = makeStudioId('group');
  const members = page.layers.filter(layer => layer.groupId === id);
  const copies = members.map(layer => ({ ...structuredClone(layer), id: makeStudioId(layer.kind), groupId }));
  // Clamp a shared offset rather than moving members independently near a page edge.
  const moved = moveStudioLayers({ ...page, layers: copies.map(layer => ({ ...layer, locked: false })) }, copies.map(layer => layer.id), .03, .03);
  return { groupId, page: { ...page, groups: [...(page.groups || []), { id: groupId, name: `${group.name} copy` }], layers: [...page.layers, ...moved.layers.map((layer, index) => ({ ...layer, locked: copies[index].locked }))] } };
}

export function duplicateStudioPageGroups(page: CustomPhotoPage): CustomPhotoPage {
  const ids = new Map(page.groups?.map(group => [group.id, makeStudioId('group')]) || []);
  return { ...page, groups: page.groups?.map(group => ({ ...group, id: ids.get(group.id)! })), layers: page.layers.map(layer => ({ ...layer, id: makeStudioId(layer.kind), groupId: layer.groupId ? ids.get(layer.groupId) : undefined })) };
}
