/* eslint-disable react/no-unknown-property */

import './registerThree';

import Car from '../car/Car';
import Tether from '../car/Tether';
import TireMarks from '../car/TireMarks';
import SlingParticles from '../car/SlingParticles';
import FollowCamera from '../camera/FollowCamera';
import TrackMesh from '../track/TrackMesh';
import AnchorNodes from '../track/AnchorNode';
import Environment from '../track/Environment';

export default function GameScene() {
  return (
    <>
      <color attach="background" args={['#1b6f63']} />
      <fog attach="fog" args={['#1b6f63', 60, 200]} />
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[20, 60, 20]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
      />
      <FollowCamera />
      <Environment />
      <TrackMesh />
      <AnchorNodes />
      <Car />
      <Tether />
      <TireMarks />
      <SlingParticles />
    </>
  );
}