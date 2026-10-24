// Grid-based sound propagation.
// Sound (and therefore sight) flows around walls and through open doorways.
// Each emitted pulse gets a geodesic distance field computed with a
// 16-neighbour Dijkstra over the walkable grid.

const SQ2 = Math.SQRT2;
const SQ5 = Math.sqrt(5);

// 16-neighbourhood: 4 straight, 4 diagonal, 8 knight moves (reduces octagonal artifacts)
const NEIGH = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQ2], [1, -1, SQ2], [-1, 1, SQ2], [-1, -1, SQ2],
  [2, 1, SQ5], [2, -1, SQ5], [-2, 1, SQ5], [-2, -1, SQ5],
  [1, 2, SQ5], [1, -2, SQ5], [-1, 2, SQ5], [-1, -2, SQ5],
];

export const FIELD_INF = 999;

class MinHeap {
  constructor(cap) {
    this.idx = new Int32Array(cap * 4);
    this.key = new Float32Array(cap * 4);
    this.size = 0;
  }
  clear() { this.size = 0; }
  push(i, k) {
    if (this.size >= this.idx.length) {
      const ni = new Int32Array(this.idx.length * 2); ni.set(this.idx); this.idx = ni;
      const nk = new Float32Array(this.key.length * 2); nk.set(this.key); this.key = nk;
    }
    let n = this.size++;
    const I = this.idx, K = this.key;
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (K[p] <= k) break;
      I[n] = I[p]; K[n] = K[p]; n = p;
    }
    I[n] = i; K[n] = k;
  }
  pop() {
    const I = this.idx, K = this.key;
    const top = I[0];
    this.topKey = K[0];
    const li = I[--this.size], lk = K[this.size];
    let n = 0;
    const half = this.size >> 1;
    while (n < half) {
      let c = 2 * n + 1;
      if (c + 1 < this.size && K[c + 1] < K[c]) c++;
      if (K[c] >= lk) break;
      I[n] = I[c]; K[n] = K[c]; n = c;
    }
    I[n] = li; K[n] = lk;
    return top;
  }
}

export class SoundField {
  constructor({ minX, minZ, sizeX, sizeZ, cell = 0.25 }) {
    this.minX = minX; this.minZ = minZ; this.cell = cell;
    this.W = Math.ceil(sizeX / cell);
    this.H = Math.ceil(sizeZ / cell);
    this.N = this.W * this.H;
    this.wall = new Uint8Array(this.N);     // static walls / windows
    this.door = new Int16Array(this.N).fill(-1); // door id occupying cell
    this.doorClosed = [];                   // per door id: bool
    this.version = 0;
    this.heap = new MinHeap(this.N);
    this.cache = new Map();
    this.cacheOrder = [];
  }

  cellOf(x, z) {
    const cx = Math.floor((x - this.minX) / this.cell);
    const cz = Math.floor((z - this.minZ) / this.cell);
    return [Math.max(0, Math.min(this.W - 1, cx)), Math.max(0, Math.min(this.H - 1, cz))];
  }
  index(x, z) { const [cx, cz] = this.cellOf(x, z); return cz * this.W + cx; }
  centerOf(i) {
    const cx = i % this.W, cz = (i / this.W) | 0;
    return [this.minX + (cx + 0.5) * this.cell, this.minZ + (cz + 0.5) * this.cell];
  }

  // Mark every cell overlapping the rectangle
  rasterRect(x0, z0, x1, z1, fn) {
    const e = 1e-4;
    const cx0 = Math.max(0, Math.floor((Math.min(x0, x1) - this.minX) / this.cell + e));
    const cx1 = Math.min(this.W - 1, Math.ceil((Math.max(x0, x1) - this.minX) / this.cell - e) - 1);
    const cz0 = Math.max(0, Math.floor((Math.min(z0, z1) - this.minZ) / this.cell + e));
    const cz1 = Math.min(this.H - 1, Math.ceil((Math.max(z0, z1) - this.minZ) / this.cell - e) - 1);
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) fn(cz * this.W + cx);
  }
  addWall(x0, z0, x1, z1) { this.rasterRect(x0, z0, x1, z1, (i) => { this.wall[i] = 1; }); }
  clearWall(x0, z0, x1, z1) { this.rasterRect(x0, z0, x1, z1, (i) => { this.wall[i] = 0; }); }
  addDoor(id, x0, z0, x1, z1) {
    this.doorClosed[id] = true;
    this.rasterRect(x0, z0, x1, z1, (i) => { this.door[i] = id; });
  }
  setDoorClosed(id, closed) {
    if (this.doorClosed[id] === closed) return;
    this.doorClosed[id] = closed;
    this.version++;
  }

  // mode 0: visual (closed doors block), mode 1: hearing (closed doors muffle)
  compute(x, z, mode = 0) {
    const start = this.index(x, z);
    const key = start * 4 + mode + this.version * this.N * 4;
    const hit = this.cache.get(key);
    if (hit) return hit;

    const W = this.W, H = this.H, N = this.N;
    const dist = new Float32Array(N).fill(FIELD_INF);
    const wall = this.wall, door = this.door, dc = this.doorClosed;
    const cost = (i) => {
      if (wall[i]) return -1;
      const d = door[i];
      if (d >= 0 && dc[d]) return mode === 0 ? -1 : 6; // 6 = muffled through closed door
      return 0;
    };
    const heap = this.heap; heap.clear();
    let s = start;
    if (cost(s) < 0) {
      // origin inside a wall: find nearest open cell
      let best = -1, bd = 1e9;
      const sx = s % W, sz = (s / W) | 0;
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
        const nx = sx + dx, nz = sz + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
        const ni = nz * W + nx;
        if (cost(ni) >= 0 && dx * dx + dz * dz < bd) { bd = dx * dx + dz * dz; best = ni; }
      }
      if (best < 0) { this._store(key, dist); return dist; }
      s = best;
    }
    dist[s] = 0;
    heap.push(s, 0);
    const cell = this.cell;
    while (heap.size > 0) {
      const i = heap.pop();
      const di = heap.topKey;
      if (di > dist[i]) continue;
      const ix = i % W, iz = (i / W) | 0;
      for (let k = 0; k < 16; k++) {
        const nb = NEIGH[k];
        const nx = ix + nb[0], nz = iz + nb[1];
        if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
        const ni = nz * W + nx;
        const c = cost(ni);
        if (c < 0) continue;
        if (k >= 4) {
          // diagonal / knight: require the cells we cut past to be open
          const ax = ix + Math.sign(nb[0]), az = iz + Math.sign(nb[1]);
          if (cost(iz * W + ax) < 0 || cost(az * W + ix) < 0) continue;
          if (k >= 8) {
            const mx = ix + (Math.abs(nb[0]) === 2 ? Math.sign(nb[0]) : 0);
            const mz = iz + (Math.abs(nb[1]) === 2 ? Math.sign(nb[1]) : 0);
            if (cost(mz * W + mx) < 0 || cost(az * W + ax) < 0) continue;
          }
        }
        const nd = di + nb[2] * cell + c * cell;
        if (nd < dist[ni]) { dist[ni] = nd; heap.push(ni, nd); }
      }
    }
    // Dilate into blocked cells so wall faces receive the value from their own side.
    const out = new Float32Array(dist);
    for (let pass = 0; pass < 2; pass++) {
      const src = pass === 0 ? dist : new Float32Array(out);
      for (let i = 0; i < N; i++) {
        if (src[i] < FIELD_INF) continue;
        const ix = i % W, iz = (i / W) | 0;
        let m = FIELD_INF;
        if (ix > 0) m = Math.min(m, src[i - 1]);
        if (ix < W - 1) m = Math.min(m, src[i + 1]);
        if (iz > 0) m = Math.min(m, src[i - W]);
        if (iz < H - 1) m = Math.min(m, src[i + W]);
        if (m < FIELD_INF) out[i] = m + cell;
      }
    }
    this._store(key, out);
    return out;
  }

  _store(key, arr) {
    this.cache.set(key, arr);
    this.cacheOrder.push(key);
    if (this.cacheOrder.length > 600) this.cache.delete(this.cacheOrder.shift());
  }

  sample(field, x, z) {
    return field[this.index(x, z)];
  }

  // Count wall cells along a straight line (used for audio occlusion)
  wallsBetween(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(len / (this.cell * 0.7)));
    let count = 0, inWall = false;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const i = this.index(x0 + dx * t, z0 + dz * t);
      const blocked = this.wall[i] === 1 || (this.door[i] >= 0 && this.doorClosed[this.door[i]]);
      if (blocked && !inWall) count++;
      inWall = blocked;
    }
    return count;
  }
}
