// A* navigation over the same grid as the sound field.
// Mr. Hush is ~1.25 m wide and ~1 m deep, so the grid keeps his centre well away from walls and
// furniture (WALL_CLEAR, inflate). Near doorways the wall margin drops to one cell so doors stay
// passable, and paths are routed through the middle of every doorway (centerDoorways).
const WALL_CLEAR = 0.55;  // metres from a wall cell's centre
const DOOR_ZONE = 1.2;    // within this distance of a doorway centre, only the one-cell margin applies
const DOOR_STEP = 0.6;    // waypoints this far either side of a doorway centre
const LOW_FURNITURE = 1.05, LOW_INFLATE = 0.36; // colliders lower than this get a smaller margin

export class NavGrid {
  constructor(field, colliders, inflate = 0.5) {
    this.f = field;
    this.W = field.W; this.H = field.H; this.cell = field.cell;
    this.static = new Uint8Array(field.N);
    this.colliders = colliders;
    this.inflate = inflate;
    this.extraBlock = new Uint8Array(field.N); // locked doors etc.
    this.rebuild();
  }

  rebuild() {
    const f = this.f;
    this.static.fill(0);
    this.findDoors();
    const nearDoor = (i) => {
      const [x, z] = this.center(i % f.W, (i / f.W) | 0);
      return this.doors.some((d) => Math.hypot(x - d.x, z - d.z) < DOOR_ZONE);
    };
    // walls: one cell everywhere, and out to WALL_CLEAR away from doorways
    const R = Math.ceil(WALL_CLEAR / this.cell);
    const lim = (WALL_CLEAR / this.cell) ** 2;
    for (let i = 0; i < f.N; i++) {
      if (!f.wall[i]) continue;
      const x = i % f.W, z = (i / f.W) | 0;
      for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= f.W || nz >= f.H) continue;
        const ni = nz * f.W + nx;
        if (f.door[ni] >= 0 || this.static[ni]) continue; // keep doorways open
        const near = Math.abs(dx) <= 1 && Math.abs(dz) <= 1;
        if (near || (dx * dx + dz * dz <= lim && !nearDoor(ni))) this.static[ni] = 1;
      }
    }
    // furniture: his belly (widest ~1.1 m up) clears low things, so only his legs need room there
    for (const c of this.colliders) {
      if (c.maxY < 0.3 || c.noNav) continue;
      const inf = c.maxY < LOW_FURNITURE ? LOW_INFLATE : this.inflate;
      f.rasterRect(c.minX - inf, c.minZ - inf, c.maxX + inf, c.maxZ + inf, (i) => { if (f.door[i] < 0) this.static[i] = 1; });
    }
  }

  // doorway centres and normals, from the door cells of the sound grid
  findDoors() {
    const f = this.f, acc = {};
    for (let i = 0; i < f.N; i++) {
      const id = f.door[i];
      if (id < 0) continue;
      const [x, z] = this.center(i % f.W, (i / f.W) | 0);
      const a = (acc[id] ||= { n: 0, x: 0, z: 0, minX: 1e9, maxX: -1e9, minZ: 1e9, maxZ: -1e9 });
      a.n++; a.x += x; a.z += z;
      a.minX = Math.min(a.minX, x); a.maxX = Math.max(a.maxX, x); a.minZ = Math.min(a.minZ, z); a.maxZ = Math.max(a.maxZ, z);
    }
    this.doors = Object.entries(acc).map(([id, a]) => {
      const alongX = a.maxX - a.minX >= a.maxZ - a.minZ; // the opening runs along the wall
      return { id: +id, x: a.x / a.n, z: a.z / a.n, nx: alongX ? 0 : 1, nz: alongX ? 1 : 0 };
    });
    this.doorById = Object.fromEntries(this.doors.map((d) => [d.id, d]));
  }

  // the doorway a straight segment passes through, if any
  doorOn(ax, az, bx, bz) {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / 0.1));
    for (let k = 0; k <= n; k++) {
      const t = k / n, id = this.f.door[this.f.index(ax + (bx - ax) * t, az + (bz - az) * t)];
      if (id >= 0) return this.doorById[id];
    }
    return null;
  }

  // walk through the middle of each doorway, square to the wall, instead of cutting the jamb
  centerDoorways(sx, sz, pts) {
    const out = [];
    let px = sx, pz = sz;
    for (const p of pts) {
      const d = this.doorOn(px, pz, p[0], p[1]);
      if (d) {
        const s = Math.sign((p[0] - px) * d.nx + (p[1] - pz) * d.nz) || 1;
        for (const k of [-DOOR_STEP, 0, DOOR_STEP]) {
          const q = [d.x + d.nx * k * s, d.z + d.nz * k * s];
          if (k !== 0 && this.blocked(this.f.index(q[0], q[1]))) continue;
          const prev = out.length ? out[out.length - 1] : [px, pz];
          if (Math.hypot(q[0] - prev[0], q[1] - prev[1]) < 0.15 || Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.15) continue;
          // only add points that lie between where we are and where we're going
          if (((q[0] - px) * (p[0] - px) + (q[1] - pz) * (p[1] - pz)) < 0) continue;
          out.push(q);
        }
      }
      out.push(p);
      px = p[0]; pz = p[1];
    }
    return out;
  }

  setDoorBlocked(doorId, blocked) {
    const f = this.f;
    for (let i = 0; i < f.N; i++) if (f.door[i] === doorId) this.extraBlock[i] = blocked ? 1 : 0;
  }

  blocked(i) { return this.static[i] === 1 || this.extraBlock[i] === 1; }

  nearestFree(x, z, maxR = 8) {
    const [cx, cz] = this.f.cellOf(x, z);
    if (!this.blocked(cz * this.W + cx)) return [cx, cz];
    for (let r = 1; r <= maxR; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= this.W || nz >= this.H) continue;
        if (!this.blocked(nz * this.W + nx)) return [nx, nz];
      }
    }
    return null;
  }

  center(cx, cz) { return [this.f.minX + (cx + 0.5) * this.cell, this.f.minZ + (cz + 0.5) * this.cell]; }

  // returns array of [x,z] world points or null
  find(sx, sz, tx, tz) {
    const s = this.nearestFree(sx, sz), t = this.nearestFree(tx, tz);
    if (!s || !t) return null;
    const W = this.W, N = this.f.N;
    const start = s[1] * W + s[0], goal = t[1] * W + t[0];
    if (start === goal) return [[tx, tz]];
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = [];
    const push = (i, f) => {
      heap.push([f, i]);
      let n = heap.length - 1;
      while (n > 0) { const p = (n - 1) >> 1; if (heap[p][0] <= heap[n][0]) break; [heap[p], heap[n]] = [heap[n], heap[p]]; n = p; }
    };
    const pop = () => {
      const top = heap[0]; const last = heap.pop();
      if (heap.length) {
        heap[0] = last; let n = 0;
        for (;;) {
          const l = 2 * n + 1, r = l + 1; let m = n;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === n) break; [heap[m], heap[n]] = [heap[n], heap[m]]; n = m;
        }
      }
      return top[1];
    };
    const gx = t[0], gz = t[1];
    const h = (i) => { const x = i % W, z = (i / W) | 0; const dx = Math.abs(x - gx), dz = Math.abs(z - gz); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    g[start] = 0; push(start, h(start));
    let found = false, iter = 0;
    while (heap.length && iter++ < 20000) {
      const i = pop();
      if (i === goal) { found = true; break; }
      if (closed[i]) continue;
      closed[i] = 1;
      const x = i % W, z = (i / W) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= this.H) continue;
        const ni = nz * W + nx;
        if (this.blocked(ni) || closed[ni]) continue;
        if (dx && dz && (this.blocked(z * W + nx) || this.blocked(nz * W + x))) continue;
        const ng = g[i] + (dx && dz ? Math.SQRT2 : 1);
        if (ng < g[ni]) { g[ni] = ng; came[ni] = i; push(ni, ng + h(ni)); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let i = goal; i !== -1; i = came[i]) cells.push(i);
    cells.reverse();
    // string pulling
    const pts = [];
    let anchor = 0;
    pts.push(cells[0]);
    for (let k = 2; k < cells.length; k++) {
      if (!this.los(cells[anchor], cells[k])) { pts.push(cells[k - 1]); anchor = k - 1; }
    }
    pts.push(cells[cells.length - 1]);
    const out = pts.slice(1).map((i) => this.center(i % W, (i / W) | 0));
    out[out.length - 1] = [tx, tz];
    if (this.blocked(this.f.index(tx, tz))) out[out.length - 1] = this.center(t[0], t[1]);
    return this.centerDoorways(sx, sz, out);
  }

  los(a, b) {
    const W = this.W;
    let x0 = a % W, z0 = (a / W) | 0;
    const x1 = b % W, z1 = (b / W) | 0;
    const dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0);
    const sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1;
    let err = dx - dz;
    for (;;) {
      if (this.blocked(z0 * W + x0)) return false;
      if (x0 === x1 && z0 === z1) return true;
      const e2 = 2 * err;
      if (e2 > -dz && e2 < dx) {
        // diagonal step: check both neighbours to avoid corner cutting
        if (this.blocked(z0 * W + x0 + sx) || this.blocked((z0 + sz) * W + x0)) return false;
      }
      if (e2 > -dz) { err -= dz; x0 += sx; }
      if (e2 < dx) { err += dx; z0 += sz; }
    }
  }

  // geodesic-ish walk distance, cheap estimate via path length
  pathLength(path, sx, sz) {
    let L = 0, px = sx, pz = sz;
    for (const [x, z] of path) { L += Math.hypot(x - px, z - pz); px = x; pz = z; }
    return L;
  }
}
