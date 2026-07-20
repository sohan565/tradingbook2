import type { SerializedDrawing } from 'lightweight-charts-drawing';

function shallowRecordEqual(a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined): boolean {
  const oa = a || {};
  const ob = b || {};
  const ka = Object.keys(oa);
  const kb = Object.keys(ob);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    const va = oa[k];
    const vb = ob[k];
    if (va === vb) continue;
    if (
      Array.isArray(va) &&
      Array.isArray(vb) &&
      va.length === vb.length &&
      va.every((x, i) => x === vb[i])
    ) {
      continue;
    }
    return false;
  }
  return true;
}

/**
 * Cheap structural equality for serialized drawings — compares ids, anchor
 * coordinates, and one level of options/style. Replaces JSON.stringify deep
 * compares in hot paths (drag mouseup, props sync) which stall with large
 * drawing sets.
 */
export function drawingsShallowEqual(
  a: SerializedDrawing[] | undefined,
  b: SerializedDrawing[] | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const da = a[i] as SerializedDrawing & Record<string, any>;
    const db = b[i] as SerializedDrawing & Record<string, any>;
    if (da.id !== db.id || da.type !== db.type) return false;
    const aa = da.anchors || [];
    const ab = db.anchors || [];
    if (aa.length !== ab.length) return false;
    for (let j = 0; j < aa.length; j++) {
      if (aa[j].time !== ab[j].time || aa[j].price !== ab[j].price) return false;
    }
    if (!shallowRecordEqual(da.options as Record<string, unknown> | undefined, db.options as Record<string, unknown> | undefined)) return false;
    if (!shallowRecordEqual(da.style as unknown as Record<string, unknown> | undefined, db.style as unknown as Record<string, unknown> | undefined)) return false;
  }
  return true;
}
