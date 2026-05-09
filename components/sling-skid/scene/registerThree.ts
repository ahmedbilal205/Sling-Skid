import { extend } from '@react-three/fiber';
import * as THREE from 'three/webgpu';

extend({
  AmbientLight: THREE.AmbientLight,
  BoxGeometry: THREE.BoxGeometry,
  BufferGeometry: THREE.BufferGeometry,
  CircleGeometry: THREE.CircleGeometry,
  Color: THREE.Color,
  CylinderGeometry: THREE.CylinderGeometry,
  DirectionalLight: THREE.DirectionalLight,
  Float32BufferAttribute: THREE.Float32BufferAttribute,
  Fog: THREE.Fog,
  Group: THREE.Group,
  InstancedMesh: THREE.InstancedMesh,
  Line: THREE.Line,
  LineBasicMaterial: THREE.LineBasicMaterial,
  Mesh: THREE.Mesh,
  MeshBasicMaterial: THREE.MeshBasicMaterial,
  MeshStandardMaterial: THREE.MeshStandardMaterial,
  PlaneGeometry: THREE.PlaneGeometry,
  RingGeometry: THREE.RingGeometry,
});