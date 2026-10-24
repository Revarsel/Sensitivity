import * as THREE from 'three';
import { resolveCircle } from '../core/Collision.js';
import { SURF } from '../world/House.js';

const STAND = 1.62, CROUCH = 1.02;
export const MOVE = {
  crouch: { speed: 1.15, stride: 0.55, noise: 0.9 },
  walk: { speed: 2.15, stride: 0.78, noise: 3.6 },
  sprint: { speed: 4.3, stride: 1.12, noise: 7.6 },
};
export const SURF_MUL = {
  [SURF.CARPET]: 0.6, [SURF.RUG]: 0.5, [SURF.WOOD]: 1.0, [SURF.TILE]: 1.3, [SURF.GLASS]: 2.2, [SURF.GRASS]: 0.7,
};

export class Player {
  constructor(camera, house) {
    this.camera = camera;
    this.house = house;
    this.pos = new THREE.Vector3(8.25, 0, 13.2);
    this.vel = new THREE.Vector2();
    this.yaw = 0;      // 0 looks toward -z
    this.pitch = 0;
    this.crouch = 0;
    this.radius = 0.28;
    this.stamina = 1;
    this.mode = 'walk';         // walk | hide | seated | locked | grabbed
    this.moveState = 'walk';
    this.stepAccum = 0;
    this.bobPhase = 0;
    this.bobAmp = 0;
    this.landKick = 0;
    this.fear = 0;
    this.breathHeld = false;
    this.breath = 1;            // breath-hold capacity
    this.onStep = null;
    this.eye = new THREE.Vector3();
    this.lookLimits = null;     // { yawMin, yawMax, pitchMin, pitchMax } for seated/hiding
    this.roll = 0;
    this.shake = 0;
    this.speedNow = 0;
    this.forcedLook = null;     // target point to look at (grabbed / cutscenes)
    this.headBob = true;
    this.fovKick = 0;
  }

  teleport(x, z, yaw = this.yaw, pitch = 0) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0);
    this.yaw = yaw; this.pitch = pitch;
    this.stepAccum = 0;
  }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  look(dx, dy, sens, invertY) {
    if (this.forcedLook) return;
    const k = 0.0022 * sens;
    this.yaw -= dx * k;
    this.pitch -= dy * k * (invertY ? -1 : 1);
    const lim = this.lookLimits;
    if (lim) {
      if (lim.yawMin !== undefined) {
        // clamp yaw around centre
        let rel = this.yaw - lim.yawCenter;
        rel = Math.atan2(Math.sin(rel), Math.cos(rel));
        rel = Math.max(lim.yawMin, Math.min(lim.yawMax, rel));
        this.yaw = lim.yawCenter + rel;
      }
      this.pitch = Math.max(lim.pitchMin ?? -1.45, Math.min(lim.pitchMax ?? 1.45, this.pitch));
    } else {
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    }
  }

  update(dt, input, colliders, doors) {
    const canMove = this.mode === 'walk';
    let ix = 0, iz = 0;
    if (canMove) {
      if (input.down('KeyW') || input.down('ArrowUp')) iz -= 1;
      if (input.down('KeyS') || input.down('ArrowDown')) iz += 1;
      if (input.down('KeyA') || input.down('ArrowLeft')) ix -= 1;
      if (input.down('KeyD') || input.down('ArrowRight')) ix += 1;
    }
    const wantCrouch = canMove && (input.down('ControlLeft') || input.down('KeyC') || input.down('ControlRight'));
    const moving = ix !== 0 || iz !== 0;
    let state = 'walk';
    if (wantCrouch) state = 'crouch';
    else if (moving && (input.down('ShiftLeft') || input.down('ShiftRight')) && this.stamina > 0.05 && iz < 0) state = 'sprint';
    this.moveState = state;

    // stamina
    if (state === 'sprint' && moving) this.stamina = Math.max(0, this.stamina - dt * 0.16);
    else this.stamina = Math.min(1, this.stamina + dt * (moving ? 0.1 : 0.2));

    this.crouch += ((state === 'crouch' ? 1 : 0) - this.crouch) * Math.min(1, dt * 9);

    // target velocity in world space
    const sp = MOVE[state].speed * (this.mode === 'walk' ? 1 : 0);
    const len = Math.hypot(ix, iz) || 1;
    const fx = ix / len, fz = iz / len;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const tx = (fx * c + fz * s) * sp * (moving ? 1 : 0);
    const tz = (-fx * s + fz * c) * sp * (moving ? 1 : 0);
    const accel = moving ? 9.5 : 11.5;
    const k = 1 - Math.exp(-accel * dt);
    this.vel.x += (tx - this.vel.x) * k;
    this.vel.y += (tz - this.vel.y) * k;
    if (!canMove) this.vel.multiplyScalar(Math.max(0, 1 - dt * 12));

    let nx = this.pos.x + this.vel.x * dt;
    let nz = this.pos.z + this.vel.y * dt;
    if (this.mode === 'walk') [nx, nz] = resolveCircle(nx, nz, this.radius, colliders, doors);
    const moved = Math.hypot(nx - this.pos.x, nz - this.pos.z);
    this.speedNow = dt > 0 ? moved / dt : 0;
    this.pos.x = nx; this.pos.z = nz;

    // footsteps
    if (this.mode === 'walk' && this.speedNow > 0.25) {
      this.stepAccum += moved;
      const stride = MOVE[state].stride;
      this.bobPhase += (moved / stride) * Math.PI;
      if (this.stepAccum >= stride) {
        this.stepAccum -= stride;
        if (this.onStep) this.onStep(this, state);
      }
    } else {
      this.stepAccum = Math.min(this.stepAccum, MOVE.walk.stride * 0.6);
    }
    const targetAmp = this.mode === 'walk' ? Math.min(1, this.speedNow / 2.2) : 0;
    this.bobAmp += (targetAmp - this.bobAmp) * Math.min(1, dt * 6);
    this.landKick *= Math.exp(-dt * 8);
    this.shake *= Math.exp(-dt * 4);

    this.updateCamera(dt);
  }

  updateCamera(dt) {
    let eyeY;
    if (this.mode === 'hide' || this.mode === 'seated') eyeY = this.fixedEyeY ?? 1.0;
    else eyeY = STAND + (CROUCH - STAND) * this.crouch;
    const bob = this.headBob ? this.bobAmp : this.bobAmp * 0.15;
    const sprintK = this.moveState === 'sprint' ? 1.5 : 1.0;
    const by = Math.abs(Math.sin(this.bobPhase)) * 0.045 * bob * sprintK - 0.02 * bob;
    const bx = Math.cos(this.bobPhase) * 0.028 * bob * sprintK;
    const t = performance.now() * 0.001;
    // idle breathing sway grows with fear
    const sway = 0.004 + this.fear * 0.012;
    const ix = Math.sin(t * 0.9) * sway, iy = Math.sin(t * 1.7) * sway * 0.6;
    const shx = (Math.random() - 0.5) * this.shake * 0.05, shy = (Math.random() - 0.5) * this.shake * 0.05;

    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    this.eye.set(
      this.pos.x + c * bx + shx,
      eyeY + by - this.landKick * 0.05 + shy,
      this.pos.z - s * bx,
    );
    this.camera.position.copy(this.eye);
    if (this.forcedLook) {
      const f = this.forcedLook;
      const dx = f.x - this.eye.x, dy = f.y - this.eye.y, dz = f.z - this.eye.z;
      const ty = Math.atan2(-dx, -dz);
      const tp = Math.atan2(dy, Math.hypot(dx, dz));
      const k = 1 - Math.exp(-dt * (f.speed ?? 10));
      let dyaw = Math.atan2(Math.sin(ty - this.yaw), Math.cos(ty - this.yaw));
      this.yaw += dyaw * k;
      this.pitch += (tp - this.pitch) * k;
    }
    const strafe = this.vel.x * c - this.vel.y * s;
    this.roll += ((-strafe * 0.012) + Math.cos(this.bobPhase) * 0.004 * bob - this.roll) * Math.min(1, dt * 6);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch + iy, this.yaw + ix, this.roll);
  }

  surface() { return this.house.surfaceAt(this.pos.x, this.pos.z); }
}
