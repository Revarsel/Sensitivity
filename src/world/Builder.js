import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Collects geometry per material and merges it into a handful of static meshes.
// Supports a transform stack so props can be authored in local space.
export class Builder {
  constructor() {
    this.buckets = new Map();
    this.stack = [new THREE.Matrix4()];
    this.colliders = [];
    this._tmp = new THREE.Matrix4();
  }

  get m() { return this.stack[this.stack.length - 1]; }

  at(x, y, z, rotY, fn) {
    const t = new THREE.Matrix4().makeRotationY(rotY || 0).setPosition(x, y, z);
    this.stack.push(this.m.clone().multiply(t));
    fn();
    this.stack.pop();
  }
  // arbitrary local transform
  with(mat4, fn) {
    this.stack.push(this.m.clone().multiply(mat4));
    fn();
    this.stack.pop();
  }

  add(mat, geo, local) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (geo.index) geo.dispose();
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    }
    if (local) g.applyMatrix4(local);
    g.applyMatrix4(this.m);
    let b = this.buckets.get(mat);
    if (!b) { b = []; this.buckets.set(mat, b); }
    b.push(g);
    return g;
  }

  // axis aligned box from min/max corners in local space
  box(mat, x0, y0, z0, x1, y1, z1) {
    const sx = Math.abs(x1 - x0), sy = Math.abs(y1 - y0), sz = Math.abs(z1 - z0);
    if (sx < 1e-4 || sy < 1e-4 || sz < 1e-4) return;
    const g = new THREE.BoxGeometry(sx, sy, sz);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return this.add(mat, g);
  }
  // box from centre + size, optional local rotation (euler)
  boxC(mat, cx, cy, cz, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
    g.translate(cx, cy, cz);
    return this.add(mat, g);
  }
  rbox(mat, cx, cy, cz, sx, sy, sz, r = 0.03, seg = 2) {
    const g = new RoundedBoxGeometry(sx, sy, sz, seg, Math.min(r, sx / 2.01, sy / 2.01, sz / 2.01));
    g.translate(cx, cy, cz);
    return this.add(mat, g);
  }
  cyl(mat, cx, cy, cz, rTop, rBot, h, seg = 16, rx = 0, rz = 0, open = false) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open);
    if (rx || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz)));
    g.translate(cx, cy, cz);
    return this.add(mat, g);
  }
  sphere(mat, cx, cy, cz, r, sx = 1, sy = 1, sz = 1, seg = 16) {
    const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.6 | 0));
    g.scale(sx, sy, sz);
    g.translate(cx, cy, cz);
    return this.add(mat, g);
  }
  lathe(mat, pts, cx, cy, cz, seg = 20) {
    const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
    g.translate(cx, cy, cz);
    return this.add(mat, g);
  }
  tube(mat, points, r, seg = 24, radial = 6) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const g = new THREE.TubeGeometry(curve, seg, r, radial, false);
    return this.add(mat, g);
  }
  plane(mat, cx, cy, cz, w, h, rx = 0, ry = 0) {
    const g = new THREE.PlaneGeometry(w, h);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, 0)));
    g.translate(cx, cy, cz);
    return this.add(mat, g);
  }

  // Collider in local space (xz rectangle), transformed to world AABB.
  collider(x0, z0, x1, z1, maxY = 2.0, tag) {
    const pts = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => new THREE.Vector3(x, 0, z).applyMatrix4(this.m));
    const c = {
      minX: Math.min(...pts.map((p) => p.x)), maxX: Math.max(...pts.map((p) => p.x)),
      minZ: Math.min(...pts.map((p) => p.z)), maxZ: Math.max(...pts.map((p) => p.z)),
      maxY, tag,
    };
    this.colliders.push(c);
    return c;
  }

  build(parent) {
    const meshes = [];
    for (const [mat, geos] of this.buckets) {
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.buckets.clear();
    return meshes;
  }
}

// A builder whose output becomes a single movable group (doors, drawers, pickups)
export function buildGroup(fn) {
  const b = new Builder();
  fn(b);
  const group = new THREE.Group();
  b.build(group);
  for (const m of group.children) m.matrixAutoUpdate = true;
  return group;
}
