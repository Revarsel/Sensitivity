// Circle-vs-box collision in the XZ plane.

export function resolveCircle(x, z, r, colliders, doors, opts = {}) {
  const minY = opts.minY ?? 0.25;
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (c.maxY < minY || c.disabled) continue;
      if (x + r < c.minX || x - r > c.maxX || z + r < c.minZ || z - r > c.maxZ) continue;
      const cx = Math.max(c.minX, Math.min(x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      let dx = x - cx, dz = z - cz;
      let d2 = dx * dx + dz * dz;
      if (d2 > r * r) continue;
      if (d2 < 1e-10) {
        // centre inside the box: push out along the smallest axis
        const l = x - c.minX, rr = c.maxX - x, t = z - c.minZ, bb = c.maxZ - z;
        const m = Math.min(l, rr, t, bb);
        if (m === l) x = c.minX - r; else if (m === rr) x = c.maxX + r;
        else if (m === t) z = c.minZ - r; else z = c.maxZ + r;
      } else {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        x += dx * push; z += dz * push;
      }
      moved = true;
    }
    if (doors) {
      for (let i = 0; i < doors.length; i++) {
        const o = doors[i].obb;
        const cs = Math.cos(o.rot), sn = Math.sin(o.rot);
        // world -> local (local +x along panel)
        const rx = x - o.cx, rz = z - o.cz;
        const lx = rx * cs - rz * sn;
        const lz = rx * sn + rz * cs;
        if (Math.abs(lx) > o.hx + r || Math.abs(lz) > o.hz + r) continue;
        const qx = Math.max(-o.hx, Math.min(lx, o.hx));
        const qz = Math.max(-o.hz, Math.min(lz, o.hz));
        let dx = lx - qx, dz = lz - qz;
        let d2 = dx * dx + dz * dz;
        if (d2 > r * r) continue;
        let nlx, nlz;
        if (d2 < 1e-10) {
          nlx = 0; nlz = lz >= 0 ? o.hz + r : -o.hz - r;
          nlx = lx;
        } else {
          const d = Math.sqrt(d2);
          nlx = qx + (dx / d) * r;
          nlz = qz + (dz / d) * r;
        }
        // local -> world (inverse rotation)
        x = o.cx + nlx * cs + nlz * sn;
        z = o.cz - nlx * sn + nlz * cs;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return [x, z];
}

// Ray (2D) vs AABB list: returns distance to first hit or Infinity
export function rayBoxes2D(ox, oz, dx, dz, maxD, colliders, minY = 0.6) {
  let best = maxD;
  for (const c of colliders) {
    if (c.maxY < minY || c.disabled) continue;
    let t0 = 0, t1 = best;
    for (const [o, d, mn, mx] of [[ox, dx, c.minX, c.maxX], [oz, dz, c.minZ, c.maxZ]]) {
      if (Math.abs(d) < 1e-8) { if (o < mn || o > mx) { t0 = Infinity; break; } continue; }
      let a = (mn - o) / d, b = (mx - o) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) { t0 = Infinity; break; }
    }
    if (t0 < best) best = t0;
  }
  return best;
}
