// mvscene/1 の 3D を再生する。Three.js の物体は最初に一度だけ作り、コマごとに変換・表示・不透明度だけを書き換える。
// 状態はすべて useCurrentFrame() のコマ番号から決める（前のコマに頼らない）ので、順不同・並列で描いても同じ絵になる。
import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { ClipTrack, Loaded, Material, SceneObject, Shot } from "./data";

// 光の強さの換算。FORMAT.md の intensity 1 で素材の色がほぼそのまま出るように決めた値。
// three の Lambert は直射も環境光も 1/π が掛かるので π を掛けて打ち消し、上向きの面で 1 前後になるよう割り振る
const SUN_SCALE = 0.85 * Math.PI;
const AMBIENT_SCALE = 0.7 * Math.PI;
const SHADOW_MAP = 4096;

// ---------- 単位の形（FORMAT.md の表どおり。角ばらせる） ----------
const makeGeometries = (): Record<string, THREE.BufferGeometry> => {
  const torus = new THREE.TorusGeometry(1, 0.08, 8, 20);
  torus.rotateX(Math.PI / 2); // 軸を y に
  return {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
    cone: new THREE.ConeGeometry(1, 1, 20),
    sphere: new THREE.SphereGeometry(1, 16, 10),
    torus,
  };
};

const makeMaterial = (m: Material, transparent: boolean): THREE.Material => {
  const common = { color: new THREE.Color(m.color), transparent, opacity: m.opacity, depthWrite: !transparent };
  // emissive：光も影も受けず、色そのまま
  if (m.emissive > 0) return new THREE.MeshBasicMaterial({ ...common, toneMapped: false });
  return new THREE.MeshLambertMaterial({ ...common, flatShading: true });
};

const toMatrix = (src: ArrayLike<number>, at: number, out: THREE.Matrix4) => {
  const p = new THREE.Vector3(src[at], src[at + 1], src[at + 2]);
  const q = new THREE.Quaternion(src[at + 3], src[at + 4], src[at + 5], src[at + 6]);
  const s = new THREE.Vector3(src[at + 7], src[at + 8], src[at + 9]);
  return out.compose(p, q, s);
};

// 3D 素材（glb）の複製を作る。光と影を受ける素材にそろえる
const instantiate = (src: THREE.Object3D) => {
  const copy = cloneSkinned(src);
  copy.traverse((n) => {
    const mesh = n as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false; // 骨で動くメッシュは外接する箱が古いままなので、画面外の判定をしない
    const fix = (m: THREE.Material) => {
      const any = m as THREE.MeshStandardMaterial & THREE.MeshBasicMaterial;
      if (any.map) {
        any.map.magFilter = THREE.NearestFilter; // 色見本の画像を使う素材は、隣の色がにじまないようにする
        any.map.minFilter = THREE.NearestFilter;
        any.map.generateMipmaps = false;
        any.map.needsUpdate = true;
      }
      // 「光を受けない」指定の素材（Kenney の家具など）は、光を受ける素材に置き換える
      if ((m as THREE.MeshBasicMaterial).isMeshBasicMaterial) return new THREE.MeshLambertMaterial({ map: any.map, color: any.color, transparent: m.transparent, opacity: m.opacity });
      if (any.isMeshStandardMaterial) {
        any.metalness = 0;
        any.roughness = 1;
      }
      return m;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(fix) : fix(mesh.material);
  });
  return copy;
};

// ---------- 再生機の組み立て（一度だけ） ----------
type InstGroup = { mesh: THREE.InstancedMesh; entries: { obj: number; local: THREE.Matrix4 }[] };
type Rig = { mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction> };
type Single = { obj: number; group: THREE.Group; meshes: { mesh: THREE.Mesh; base: Material }[]; rigs: Rig[] };

class MvPlayer {
  root = new THREE.Group();
  usesPost: boolean;
  private ambient = new THREE.AmbientLight();
  private hemi = new THREE.HemisphereLight();
  private sun = new THREE.DirectionalLight();
  private objects: SceneObject[];
  private tracks: Float32Array;
  private shots: Shot[];
  private cameraO: number;
  private inst: InstGroup[] = [];
  private singles: Single[] = [];
  private objMats: THREE.Matrix4[];
  private visible: boolean[];
  private tmp = new THREE.Matrix4();
  shot: Shot;

  constructor(data: Loaded) {
    const { scene, tracks } = data;
    this.objects = scene.objects;
    this.tracks = tracks;
    this.shots = scene.shots;
    this.shot = scene.shots[0];
    this.usesPost = scene.shots.some((s) => s.post);
    this.cameraO = scene.camera.o;
    this.objMats = scene.objects.map(() => new THREE.Matrix4());
    this.visible = scene.objects.map(() => false);
    const geos = makeGeometries();
    const mats = new Map(scene.materials.map((m) => [m.id, m]));

    // 素材（glb）を含む物体・不透明度が変わる物体・半透明の素材を含む物体は1つずつ描く。
    // それ以外は「形×素材」ごとにまとめて描く（instancing）
    const groups = new Map<string, { obj: number; local: THREE.Matrix4 }[]>();
    scene.objects.forEach((o, i) => {
      const hasModel = o.parts.some((p) => p.shape === "model");
      const seeThrough = !!o.opacity?.length || o.parts.some((p) => p.material && (mats.get(p.material)?.opacity ?? 1) < 1);
      if (hasModel || seeThrough) {
        const group = new THREE.Group();
        group.matrixAutoUpdate = false;
        const meshes: Single["meshes"] = [];
        const rigs: Rig[] = [];
        for (const p of o.parts) {
          if (p.shape === "model") {
            const gltf = data.models.get(p.src!);
            if (!gltf) throw new Error(`素材が読めていない: ${p.src}`);
            const holder = new THREE.Group();
            holder.matrixAutoUpdate = false;
            toMatrix(p.t, 0, holder.matrix);
            const copy = instantiate(gltf.scene);
            holder.add(copy);
            group.add(holder);
            if (gltf.animations.length && o.clips?.length) {
              const mixer = new THREE.AnimationMixer(copy);
              rigs.push({ mixer, actions: new Map(gltf.animations.map((c) => [c.name, mixer.clipAction(c)])) });
            }
            continue;
          }
          const base = mats.get(p.material!)!;
          const mesh = new THREE.Mesh(geos[p.shape], makeMaterial(base, base.opacity < 1));
          mesh.matrixAutoUpdate = false;
          toMatrix(p.t, 0, mesh.matrix);
          group.add(mesh);
          meshes.push({ mesh, base });
        }
        this.root.add(group);
        this.singles.push({ obj: i, group, meshes, rigs });
        return;
      }
      for (const p of o.parts) {
        const key = `${p.shape}\u0000${p.material}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push({ obj: i, local: toMatrix(p.t, 0, new THREE.Matrix4()) });
      }
    });
    for (const [key, entries] of groups) {
      const [shape, matId] = key.split("\u0000");
      const base = mats.get(matId)!;
      const mesh = new THREE.InstancedMesh(geos[shape], makeMaterial(base, false), entries.length);
      mesh.frustumCulled = false;
      mesh.castShadow = base.emissive <= 0;
      mesh.receiveShadow = base.emissive <= 0;
      this.root.add(mesh);
      this.inst.push({ mesh, entries });
    }
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
    this.sun.shadow.radius = 3; // やわらかい影
    this.root.add(this.ambient, this.hemi, this.sun, this.sun.target);
  }

  // コマ f の物体の変換。どの区間にも入らなければ null（表示しない）
  private objectMatrix(o: SceneObject, f: number, out: THREE.Matrix4) {
    for (const s of o.segments) {
      if (f < s.from || f > s.to) continue;
      if (s.t) return toMatrix(s.t, 0, out);
      return toMatrix(this.tracks, s.o! + (f - s.from) * 10, out);
    }
    return null;
  }

  private objectOpacity(o: SceneObject, f: number) {
    for (const t of o.opacity ?? []) if (f >= t.from && f <= t.to) return this.tracks[t.o + (f - t.from)];
    return 1;
  }

  // 素材に入っている動き（歩く・座るなど）を、コマ f の姿勢にする。前のコマには頼らない
  private applyClips(rigs: Rig[], clips: ClipTrack[], f: number) {
    let idx = clips.findIndex((c) => f >= c.from && f <= c.to);
    if (idx < 0) clips.forEach((c, i) => { if (c.to < f) idx = i; }); // 区間のあいだ：直前の動きの最後の姿勢で止める
    if (idx < 0) idx = 0;
    const cur = clips[idx];
    const timeOf = (c: ClipTrack, frame: number) => this.tracks[c.o + Math.min(c.to - c.from, Math.max(0, frame - c.from))];
    const prev = idx > 0 && cur.fade > 0 && f >= cur.from && f - cur.from < cur.fade && clips[idx - 1].clip !== cur.clip ? clips[idx - 1] : null;
    const w = prev ? (f - cur.from + 1) / (cur.fade + 1) : 1;
    for (const rig of rigs) {
      rig.mixer.stopAllAction();
      const play = (name: string, time: number, weight: number) => {
        const a = rig.actions.get(name);
        if (!a) return;
        a.reset().setLoop(THREE.LoopRepeat, Infinity).play();
        a.setEffectiveWeight(weight);
        const d = a.getClip().duration;
        a.time = d > 0 ? ((time % d) + d) % d : 0;
      };
      play(cur.clip, timeOf(cur, f), w);
      if (prev) play(prev.clip, timeOf(prev, prev.to), 1 - w);
      rig.mixer.update(0);
    }
  }

  update(f: number, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.objects.forEach((o, i) => {
      this.visible[i] = this.objectMatrix(o, f, this.objMats[i]) !== null;
    });
    for (const g of this.inst) {
      let n = 0;
      for (const e of g.entries) {
        if (!this.visible[e.obj]) continue;
        g.mesh.setMatrixAt(n++, this.tmp.multiplyMatrices(this.objMats[e.obj], e.local));
      }
      g.mesh.count = n;
      g.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const s of this.singles) {
      const o = this.objects[s.obj];
      const k = this.visible[s.obj] ? this.objectOpacity(o, f) : 0;
      s.group.visible = k > 0;
      if (!s.group.visible) continue;
      s.group.matrix.copy(this.objMats[s.obj]);
      s.group.matrixWorldNeedsUpdate = true;
      if (s.rigs.length && o.clips?.length) this.applyClips(s.rigs, o.clips, f);
      for (const { mesh, base } of s.meshes) {
        const op = base.opacity * k;
        const mat = mesh.material as THREE.MeshBasicMaterial | THREE.MeshLambertMaterial;
        const transparent = op < 1;
        if (mat.transparent !== transparent) {
          mat.transparent = transparent;
          mat.depthWrite = !transparent;
          mat.needsUpdate = true;
        }
        mat.opacity = op;
        // 半透明・発光は影を落とさない
        mesh.castShadow = !transparent && base.emissive <= 0;
        mesh.receiveShadow = base.emissive <= 0;
      }
    }

    // カメラ：位置3、注視点3、上方向3、縦の画角
    const c = this.tracks.subarray(this.cameraO + f * 10, this.cameraO + f * 10 + 10);
    camera.up.set(c[6], c[7], c[8]);
    camera.position.set(c[0], c[1], c[2]);
    camera.lookAt(c[3], c[4], c[5]);
    camera.fov = c[9];
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // カット：背景と光と影
    const shot = this.shots.find((s) => f >= s.from && f <= s.to) ?? this.shots[this.shots.length - 1];
    this.shot = shot;
    scene.background = new THREE.Color(shot.background);
    scene.fog = shot.fog ? new THREE.Fog(shot.fog.color, shot.fog.near, shot.fog.far) : null;
    // 環境光は「全方向から同じ」と「空からの回り込み」に分ける。下向きの面が少し暗くなり、形が読みやすくなる
    this.ambient.color.set(shot.ambient.color);
    this.ambient.intensity = shot.ambient.intensity * AMBIENT_SCALE * 0.6;
    this.hemi.color.set(shot.ambient.color);
    this.hemi.groundColor.set(shot.ambient.color).multiplyScalar(0.45);
    this.hemi.intensity = shot.ambient.intensity * AMBIENT_SCALE * 0.55;
    this.sun.color.set(shot.sun.color);
    this.sun.intensity = shot.sun.intensity * SUN_SCALE;
    const ext = shot.shadowExtent;
    const dist = Math.max(ext, 1) * 3; // shadowExtent が 0 のカット（宇宙など）でも、光の向きが決まるようにする
    const dir = new THREE.Vector3(...shot.sun.from).normalize();
    this.sun.target.position.set(c[3], c[4], c[5]);
    this.sun.position.copy(this.sun.target.position).addScaledVector(dir, dist);
    this.sun.target.updateMatrixWorld();
    this.sun.castShadow = shot.shadows;
    const sc = this.sun.shadow.camera;
    sc.left = -ext;
    sc.right = ext;
    sc.top = ext;
    sc.bottom = -ext;
    sc.near = 0.1;
    sc.far = dist + ext * 2;
    sc.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = ext / 600;
  }
}

// 後処理：継ぎ目の陰（AO）・光のにじみ（bloom）・ぼけ（被写界深度）。カットの post に値があるときだけ効かせる
class Post {
  private composer: EffectComposer;
  private ao: GTAOPass;
  private bloom: UnrealBloomPass;
  private bokeh: BokehPass;

  constructor(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, width: number, height: number) {
    const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(gl, target);
    this.composer.setPixelRatio(1);
    this.composer.setSize(width, height);
    this.composer.addPass(new RenderPass(scene, camera));
    this.ao = new GTAOPass(scene, camera, width, height);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.3, 0.6, 0.92);
    this.bokeh = new BokehPass(scene, camera, { focus: 3, aperture: 0.0001, maxblur: 0.008 });
    this.composer.addPass(this.ao);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.bokeh);
    this.composer.addPass(new OutputPass());
  }

  render(shot: Shot) {
    const p = shot.post ?? {};
    this.ao.enabled = (p.ao ?? 0) > 0;
    this.ao.blendIntensity = p.ao ?? 0;
    this.bloom.enabled = (p.bloom ?? 0) > 0;
    this.bloom.strength = p.bloom ?? 0;
    this.bokeh.enabled = p.focus !== undefined;
    if (p.focus !== undefined) {
      const u = this.bokeh.uniforms as Record<string, { value: number }>;
      u.focus.value = p.focus;
      u.aperture.value = p.aperture ?? 0.0001;
    }
    this.composer.render();
  }
}

const Stage: React.FC<{ data: Loaded }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { scene, camera, gl, size } = useThree();
  const player = useMemo(() => new MvPlayer(data), [data]);
  const post = useMemo(
    () => (player.usesPost ? new Post(gl, scene, camera as THREE.PerspectiveCamera, size.width, size.height) : null),
    [player, gl, scene, camera, size.width, size.height],
  );
  // ThreeCanvas は描画を useEffect（コミットの後）で行うので、描画の前にここで状態を書き換えておけば間に合う
  player.update(frame, scene, camera as THREE.PerspectiveCamera);
  gl.shadowMap.enabled = true;
  // 後処理を使う場面データでは、描画をこちらで引き受ける（順番 1 の useFrame があると、既定の描画は行われない）
  useFrame(() => post?.render(player.shot), post ? 1 : 0);
  return <primitive object={player.root} />;
};

export const Player: React.FC<{ data: Loaded }> = ({ data }) => {
  const { width, height } = useVideoConfig();
  // 後処理は奥行きの値を読むので、対数の奥行きバッファが使えない。そのぶん、描ける距離の幅を狭くする
  const post = data.scene.shots.some((s) => s.post);
  return (
    <ThreeCanvas
      width={width}
      height={height}
      flat
      shadows={{ type: THREE.PCFShadowMap }}
      camera={post ? { near: 0.05, far: 3000 } : { near: 0.02, far: 1e7 }}
      gl={{ antialias: true, logarithmicDepthBuffer: !post }}
    >
      <Stage data={data} />
    </ThreeCanvas>
  );
};
