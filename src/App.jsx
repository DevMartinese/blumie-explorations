import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import CursorKeys from './explorations/CursorKeys'
import ScrollKeys from './explorations/ScrollKeys'
import ExplodeKeys from './explorations/ExplodeKeys'
import GridWalkers from './explorations/GridWalkers'
import TetrisKeys from './explorations/TetrisKeys'
import AsciiTextures from './explorations/AsciiTextures'
import AsciiFlow from './explorations/AsciiFlow'
import AsciiTerrain from './explorations/AsciiTerrain'
import AsciiWaves from './explorations/AsciiWaves'
import AsciiMask from './explorations/AsciiMask'
import GraficosMetricas from './explorations/GraficosMetricas'
import ParticleData from './explorations/ParticleData'
import KeyCubes from './explorations/KeyCubes'
import LogoRain from './explorations/LogoRain'
import CursorKeys3D from './explorations/CursorKeys3D'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/exploration/cursor-keys" element={<CursorKeys />} />
      <Route path="/exploration/scroll-keys" element={<ScrollKeys />} />
      <Route path="/exploration/explode-keys" element={<ExplodeKeys />} />
      <Route path="/exploration/grid-walkers" element={<GridWalkers />} />
      <Route path="/exploration/tetris-keys" element={<TetrisKeys />} />
      <Route path="/exploration/ascii-textures" element={<AsciiTextures />} />
      <Route path="/exploration/ascii-flow" element={<AsciiFlow />} />
      <Route path="/exploration/ascii-terrain" element={<AsciiTerrain />} />
      <Route path="/exploration/ascii-waves" element={<AsciiWaves />} />
      <Route path="/exploration/ascii-mask" element={<AsciiMask />} />
      <Route path="/exploration/graficos-metricas" element={<GraficosMetricas />} />
      <Route path="/exploration/particle-data" element={<ParticleData />} />
      <Route path="/exploration/key-cubes" element={<KeyCubes />} />
      <Route path="/exploration/logo-rain" element={<LogoRain />} />
      <Route path="/exploration/cursor-keys-3d" element={<CursorKeys3D />} />
      <Route
        path="/exploration/:slug"
        element={<div style={{ padding: 40, color: '#fff' }}>Exploration placeholder</div>}
      />
    </Routes>
  )
}

export default App
