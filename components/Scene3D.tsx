import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ParticleConfig, SceneMode, StoredPhoto } from '../types';

interface Scene3DProps {
  particleConfig: ParticleConfig;
  mode: SceneMode;
  manualRotation: { x: number; y: number };
  gestureState: { detected: boolean; x: number; y: number };
  photos: StoredPhoto[];
  onGrabComplete: (success: boolean) => void;
  onModeChange: (mode: SceneMode) => void;
}

export interface Scene3DHandle {
  resetScene: () => void;
  triggerGrab: () => void;
}

class Particle {
  mesh: THREE.Mesh | THREE.Group;
  type: string;
  isDust: boolean;
  posTree: THREE.Vector3;
  posScatter: THREE.Vector3;
  baseScale: number;
  spinSpeed: THREE.Vector3;
  photoId?: string;

  constructor(mesh: THREE.Mesh | THREE.Group, type: string, isDust: boolean, treeHeight: number, treeRadius: number, clock: THREE.Clock) {
    this.mesh = mesh;
    this.type = type;
    this.isDust = isDust;
    this.posTree = new THREE.Vector3();
    this.posScatter = new THREE.Vector3();
    this.baseScale = mesh.scale.x;
    const s = (type === 'PHOTO') ? 0.3 : 2.0;
    this.spinSpeed = new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    this.calcPos(treeHeight, treeRadius);
  }

  calcPos(h: number, maxR: number) {
    let t = Math.pow(Math.random(), 0.8);
    const y = (t * h) - (h / 2);
    let rm = Math.max(0.5, maxR * (1.0 - t));
    const a = t * 50 * Math.PI + Math.random() * Math.PI;
    const r = rm * (0.8 + Math.random() * 0.4);
    this.posTree.set(Math.cos(a) * r, y, Math.sin(a) * r);

    let rs = this.isDust ? (12 + Math.random() * 20) : (8 + Math.random() * 12);
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    this.posScatter.set(rs * Math.sin(ph) * Math.cos(th), rs * Math.sin(ph) * Math.sin(th), rs * Math.cos(ph));
  }

  update(dt: number, mode: SceneMode, focusTarget: THREE.Object3D | null, clock: THREE.Clock, focusType: number, cameraPos: THREE.Vector3, mainGroupMatrix: THREE.Matrix4) {
    let target = this.posTree;
    
    if (mode === 'SCATTER') {
      target = this.posScatter;
    } else if (mode === 'FOCUS') {
      if (this.mesh === focusTarget) {
        let off = new THREE.Vector3(0, 1, 38);
        if (focusType === 1) off.set(-4, 2, 35);
        else if (focusType === 2) off.set(3, 0, 32);
        else if (focusType === 3) off.set(0, -2.5, 30);
        
        const im = new THREE.Matrix4().copy(mainGroupMatrix).invert();
        target = off.applyMatrix4(im);
      } else {
        target = this.posScatter;
      }
    }

    const ls = (mode === 'FOCUS' && this.mesh === focusTarget) ? 8.0 : 4.0;
    this.mesh.position.lerp(target, ls * dt);

    if (mode === 'SCATTER') {
      this.mesh.rotation.x += this.spinSpeed.x * dt;
      this.mesh.rotation.y += this.spinSpeed.y * dt;
      this.mesh.rotation.z += this.spinSpeed.z * dt;
    } else if (mode === 'TREE') {
      this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, 0, dt);
      this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, dt);
      this.mesh.rotation.y += 0.5 * dt;
    }

    if (mode === 'FOCUS' && this.mesh === focusTarget) {
        this.mesh.lookAt(cameraPos);
        if(focusType===1) this.mesh.rotateZ(0.38);
        if(focusType===2) this.mesh.rotateZ(-0.15);
        if(focusType===3) this.mesh.rotateX(-0.4);
    }

    let s = this.baseScale;
    if (this.isDust) {
      s = this.baseScale * (0.8 + 0.4 * Math.sin(clock.getElapsedTime() * 4 + this.mesh.id));
      if (mode === 'TREE') s = 0;
    } else if (mode === 'SCATTER' && this.type === 'PHOTO') {
      s = this.baseScale * 2.5;
    } else if (mode === 'FOCUS') {
      if (this.mesh === focusTarget) {
        if (focusType === 2) s = 3.5;
        else if (focusType === 3) s = 4.8;
        else s = 3.0;
      } else {
        s = this.baseScale * 0.8;
      }
    }
    
    this.mesh.scale.lerp(new THREE.Vector3(s, s, s), 6 * dt);
  }
}

const Scene3D = forwardRef<Scene3DHandle, Scene3DProps>(({
  particleConfig,
  mode,
  manualRotation,
  gestureState,
  photos,
  onGrabComplete,
  onModeChange
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Three.js instances ref (to avoid re-renders)
  const threeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    composer: EffectComposer;
    mainGroup: THREE.Group;
    photoGroup: THREE.Group;
    particles: Particle[];
    snowMesh?: THREE.InstancedMesh;
    snowData: { vy: number; rx: number; ry: number; rz: number }[];
    clock: THREE.Clock;
    caneTexture?: THREE.CanvasTexture;
    focusTarget: THREE.Object3D | null;
    focusType: number;
    currentRotation: { x: number; y: number };
    animationFrameId: number;
  } | null>(null);

  // Initialize Three.js
  useEffect(() => {
    if (!containerRef.current) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.FogExp2(0x050505, 0.01);

    // Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(0, 2, 50);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 2.2;
    containerRef.current.appendChild(renderer.domElement);

    // Composer
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.7;
    bloomPass.strength = 0.45;
    bloomPass.radius = 0.4;
    composer.addPass(renderPass);
    composer.addPass(bloomPass);

    // Environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    // Groups
    const mainGroup = new THREE.Group();
    const photoGroup = new THREE.Group();
    scene.add(mainGroup);
    mainGroup.add(photoGroup);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const pointLight = new THREE.PointLight(0xffaa00, 2, 20);
    pointLight.position.set(0, 5, 0);
    mainGroup.add(pointLight);
    
    const spotLight = new THREE.SpotLight(0xffcc66, 1200);
    spotLight.position.set(30, 40, 40);
    spotLight.angle = 0.5;
    spotLight.penumbra = 0.5;
    scene.add(spotLight);

    const backLight = new THREE.SpotLight(0x6688ff, 600);
    backLight.position.set(-30, 20, -30);
    scene.add(backLight);

    // Texture Generation
    const c = document.createElement('canvas');
    c.width = 128; 
    c.height = 128; 
    const x = c.getContext('2d');
    if (x) {
        x.fillStyle = '#ffffff'; x.fillRect(0, 0, 128, 128); 
        x.fillStyle = '#880000'; x.beginPath(); 
        for (let i = -128; i < 256; i += 32) { x.moveTo(i, 0); x.lineTo(i + 32, 128); x.lineTo(i + 16, 128); x.lineTo(i - 16, 0); } 
        x.fill();
    }
    const caneTexture = new THREE.CanvasTexture(c);
    caneTexture.wrapS = caneTexture.wrapT = THREE.RepeatWrapping;
    caneTexture.repeat.set(3, 3);
    caneTexture.colorSpace = THREE.SRGBColorSpace;

    // Star/Tree Topper
    const starMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.2, 0),
        new THREE.MeshStandardMaterial({color: 0xffdd88, emissive: 0xffaa00, emissiveIntensity: 1, metalness: 1, roughness: 0})
    );
    starMesh.position.set(0, 24/2 + 1.2, 0);
    mainGroup.add(starMesh);

    threeRef.current = {
      scene, camera, renderer, composer, mainGroup, photoGroup,
      particles: [], snowData: [],
      clock: new THREE.Clock(),
      caneTexture,
      focusTarget: null, focusType: 0,
      currentRotation: { x: 0, y: 0 },
      animationFrameId: 0
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      pmremGenerator.dispose();
      if (containerRef.current) containerRef.current.innerHTML = '';
      cancelAnimationFrame(threeRef.current?.animationFrameId || 0);
    };
  }, []);

  // Update Particles (Rebuild Scene)
  useEffect(() => {
    if (!threeRef.current) return;
    const { mainGroup, photoGroup, particles, caneTexture, clock } = threeRef.current;

    // Clear existing decorative particles (not photos, not topper)
    // We filter particles that are NOT type 'PHOTO' and remove their meshes
    const partsToRemove = particles.filter(p => p.type !== 'PHOTO');
    partsToRemove.forEach(p => {
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        if (p.mesh instanceof THREE.Mesh) {
            p.mesh.geometry.dispose();
            (p.mesh.material as THREE.Material).dispose();
        }
    });

    // Keep photos in the new particle array
    const keptParticles = particles.filter(p => p.type === 'PHOTO');
    threeRef.current.particles = [...keptParticles];

    // Rebuild Particles
    const sg = new THREE.SphereGeometry(0.5, 32, 32);
    const bg = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(0.1, 0.5, 0), new THREE.Vector3(0.3, 0.4, 0)]);
    const cg = new THREE.TubeGeometry(curve, 16, 0.08, 8, false);

    const matGold = new THREE.MeshStandardMaterial({color: 0xffd966, metalness: 1, roughness: 0.1, envMapIntensity: 2, emissive: 0x443300, emissiveIntensity: 0.3});
    const matGreen = new THREE.MeshStandardMaterial({color: 0x03180a, metalness: 0.2, roughness: 0.8, emissive: 0x002200, emissiveIntensity: 0.2});
    const matRed = new THREE.MeshPhysicalMaterial({color: 0x990000, metalness: 0.3, roughness: 0.2, clearcoat: 1, emissive: 0x330000});
    const matCane = new THREE.MeshStandardMaterial({map: caneTexture, roughness: 0.4});

    for (let i = 0; i < particleConfig.treeCount; i++) {
        const r = Math.random();
        let m, t;
        if (r < 0.4) { m = new THREE.Mesh(bg, matGreen); t = 'BOX'; }
        else if (r < 0.7) { m = new THREE.Mesh(bg, matGold); t = 'GOLD_BOX'; }
        else if (r < 0.92) { m = new THREE.Mesh(sg, matGold); t = 'GOLD_SPHERE'; }
        else if (r < 0.97) { m = new THREE.Mesh(sg, matRed); t = 'RED'; }
        else { m = new THREE.Mesh(cg, matCane); t = 'CANE'; }
        
        const s = 0.4 + Math.random() * 0.5;
        m.scale.set(s, s, s);
        m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        mainGroup.add(m);
        threeRef.current.particles.push(new Particle(m, t, false, 24, 8, clock));
    }

    // Dust
    const dg = new THREE.TetrahedronGeometry(0.08, 0);
    const dm = new THREE.MeshBasicMaterial({color: 0xffeebb, transparent: true, opacity: 0.8});
    for (let i = 0; i < particleConfig.dustCount; i++) {
        const ms = new THREE.Mesh(dg, dm);
        ms.scale.setScalar(0.5 + Math.random());
        mainGroup.add(ms);
        threeRef.current.particles.push(new Particle(ms, 'DUST', true, 24, 8, clock));
    }

  }, [particleConfig.treeCount, particleConfig.dustCount]);

  // Update Snow
  useEffect(() => {
    if (!threeRef.current) return;
    const { scene } = threeRef.current;

    if (threeRef.current.snowMesh) {
        scene.remove(threeRef.current.snowMesh);
        threeRef.current.snowMesh.geometry.dispose();
        (threeRef.current.snowMesh.material as THREE.Material).dispose();
        threeRef.current.snowMesh = undefined;
    }

    if (particleConfig.snowCount > 0) {
        const g = new THREE.IcosahedronGeometry(particleConfig.snowSize, 0);
        const m = new THREE.MeshPhysicalMaterial({color: 0xffffff, metalness: 0, roughness: 0.15, transmission: 0.9, thickness: 0.5, envMapIntensity: 1.5, clearcoat: 1, clearcoatRoughness: 0.1, ior: 1.33});
        const mesh = new THREE.InstancedMesh(g, m, particleConfig.snowCount);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        
        const dummy = new THREE.Object3D();
        const data = [];
        const range = 70;

        for (let i = 0; i < particleConfig.snowCount; i++) {
            dummy.position.set((Math.random() - 0.5) * range, Math.random() * range, (Math.random() - 0.5) * range);
            dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            const s = 0.5 + Math.random() * 0.1;
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
            data.push({vy: (Math.random() * 0.5 + 0.8), rx: (Math.random() - 0.5) * 2, ry: (Math.random() - 0.5) * 2, rz: (Math.random() - 0.5) * 2});
        }
        scene.add(mesh);
        threeRef.current.snowMesh = mesh;
        threeRef.current.snowData = data;
    }

  }, [particleConfig.snowCount, particleConfig.snowSize]);

  // Handle Photos (Sync DB photos to 3D scene)
  useEffect(() => {
      if(!threeRef.current) return;
      const { photoGroup, clock, particles } = threeRef.current;
      
      // Identify existing photo IDs
      const existingIds = particles.filter(p => p.type === 'PHOTO').map(p => p.photoId);
      const newIds = photos.map(p => p.id);

      // Remove photos not in new list
      particles.forEach((p, index) => {
          if (p.type === 'PHOTO' && p.photoId && !newIds.includes(p.photoId)) {
              if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
              // Clean up geometry/material...
              delete particles[index]; // Mark for removal (basic)
          }
      });
      // Compact array
      threeRef.current.particles = particles.filter(p => !!p);

      // Add new photos
      photos.forEach(photo => {
          if (!existingIds.includes(photo.id)) {
             const img = new Image();
             img.src = photo.data;
             img.onload = () => {
                 const tex = new THREE.Texture(img);
                 tex.colorSpace = THREE.SRGBColorSpace;
                 tex.needsUpdate = true;
                 
                 const aspect = img.width / img.height;
                 let w = 1.2, h = 1.2;
                 if (aspect > 1) h = w / aspect; else w = h * aspect;

                 const frameGeo = new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.05);
                 const frameMat = new THREE.MeshStandardMaterial({color: 0xc5a059, metalness: 0.6, roughness: 0.5, envMapIntensity: 0.5});
                 const frame = new THREE.Mesh(frameGeo, frameMat);
                 
                 const planeGeo = new THREE.PlaneGeometry(w, h);
                 const planeMat = new THREE.MeshBasicMaterial({map: tex});
                 const plane = new THREE.Mesh(planeGeo, planeMat);
                 plane.position.z = 0.04;

                 const group = new THREE.Group();
                 group.add(frame);
                 group.add(plane);
                 const s = 0.8;
                 group.scale.set(s, s, s);
                 
                 photoGroup.add(group);
                 
                 const p = new Particle(group, 'PHOTO', false, 24, 8, clock);
                 p.photoId = photo.id;
                 threeRef.current?.particles.push(p);
             };
          }
      });

  }, [photos]);


  // Exposed Methods
  useImperativeHandle(ref, () => ({
    resetScene: () => {
       // Logic to reset positions if needed, or just let React props handle it
       // Currently, changing props triggers rebuilds.
    },
    triggerGrab: () => {
        if(!threeRef.current) return;
        let closest: THREE.Object3D | null = null;
        let minD = Infinity;
        threeRef.current.focusType = Math.floor(Math.random() * 4);
        
        threeRef.current.particles.filter(p => p.type === 'PHOTO').forEach(p => {
            p.mesh.updateMatrixWorld();
            const pos = new THREE.Vector3();
            p.mesh.getWorldPosition(pos);
            const sp = pos.project(threeRef.current!.camera);
            const d = Math.hypot(sp.x, sp.y);
            // Grab radius check
            if (sp.z < 1 && d < 0.25) { 
                if (d < minD) { minD = d; closest = p.mesh; }
            }
        });

        if (closest) {
            threeRef.current.focusTarget = closest;
            onGrabComplete(true);
        } else {
            onGrabComplete(false); // Trigger Scatter instead
        }
    }
  }));

  // Logic Loop
  useEffect(() => {
      if(!threeRef.current) return;
      const t = threeRef.current;
      
      const animate = () => {
        t.animationFrameId = requestAnimationFrame(animate);
        const dt = t.clock.getDelta();
        const et = t.clock.getElapsedTime();

        // Snow Animation
        if (t.snowMesh && mode === 'TREE') {
            t.snowMesh.visible = true;
            const dummy = new THREE.Object3D();
            for (let i = 0; i < particleConfig.snowCount; i++) {
                t.snowMesh.getMatrixAt(i, dummy.matrix);
                dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
                const d = t.snowData[i];
                dummy.position.y -= d.vy * particleConfig.snowSpeed * dt;
                dummy.position.x += Math.sin(et * 0.5 + i) * 2.5 * dt;
                dummy.position.z += Math.cos(et * 0.3 + i) * 1.5 * dt;

                dummy.rotation.x += d.rx * dt;
                dummy.rotation.y += d.ry * dt;
                dummy.rotation.z += d.rz * dt;

                if (dummy.position.y < -25) {
                    dummy.position.y = 40;
                    dummy.position.x = (Math.random() - 0.5) * 70;
                    dummy.position.z = (Math.random() - 0.5) * 70;
                }
                dummy.updateMatrix();
                t.snowMesh.setMatrixAt(i, dummy.matrix);
            }
            t.snowMesh.instanceMatrix.needsUpdate = true;
        } else if (t.snowMesh) {
            t.snowMesh.visible = false;
        }

        // Rotation Logic
        if (manualRotation.x !== 0 || manualRotation.y !== 0) {
            const s = 1.4 * 2.0;
            t.currentRotation.x += manualRotation.x * s * dt;
            t.currentRotation.y += manualRotation.y * s * dt;
        } else if (mode === 'SCATTER' && gestureState.detected) {
            const th = 0.3; 
            const s = 1.4;
            if (gestureState.x > th) t.currentRotation.y -= s * dt * (gestureState.x - th);
            else if (gestureState.x < -th) t.currentRotation.y -= s * dt * (gestureState.x + th);
            
            if (gestureState.y < -th) t.currentRotation.x += s * dt * (-gestureState.y - th);
            else if (gestureState.y > th) t.currentRotation.x -= s * dt * (gestureState.y - th);
        } else {
            if (mode === 'TREE') {
                t.currentRotation.y += 0.3 * dt;
                t.currentRotation.x += (0 - t.currentRotation.x) * 2.0 * dt;
            } else {
                t.currentRotation.y += 0.1 * dt;
            }
        }
        
        t.mainGroup.rotation.y = t.currentRotation.y;
        t.mainGroup.rotation.x = t.currentRotation.x;

        // Particle Updates
        const ft = mode === 'FOCUS' ? t.focusTarget : null;
        t.particles.forEach(p => p.update(dt, mode, ft, t.clock, t.focusType, t.camera.position, t.mainGroup.matrixWorld));

        t.composer.render();
      };
      animate();
  }, [mode, particleConfig.snowSpeed, manualRotation, gestureState]);

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
});

export default Scene3D;