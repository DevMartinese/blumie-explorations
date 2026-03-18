import { Link } from 'react-router-dom'
import CursorKeysPreview from '../explorations/CursorKeys/Preview'
import ScrollKeysPreview from '../explorations/ScrollKeys/Preview'
import ExplodeKeysPreview from '../explorations/ExplodeKeys/Preview'
import GridWalkersPreview from '../explorations/GridWalkers/Preview'
import TetrisKeysPreview from '../explorations/TetrisKeys/Preview'
import AsciiTexturesPreview from '../explorations/AsciiTextures/Preview'
import AsciiFlowPreview from '../explorations/AsciiFlow/Preview'
import AsciiTerrainPreview from '../explorations/AsciiTerrain/Preview'
import AsciiWavesPreview from '../explorations/AsciiWaves/Preview'
import AsciiMaskPreview from '../explorations/AsciiMask/Preview'
import GraficosMetricasPreview from '../explorations/GraficosMetricas/Preview'
import ParticleDataPreview from '../explorations/ParticleData/Preview'
import KeyCubesPreview from '../explorations/KeyCubes/Preview'
import LogoRainPreview from '../explorations/LogoRain/Preview'
import CursorKeys3DPreview from '../explorations/CursorKeys3D/Preview'
import ConwayKeysPreview from '../explorations/ConwayKeys/Preview'
import ConwayAsciiPreview from '../explorations/ConwayAscii/Preview'
import AsciiBentoPreview from '../explorations/AsciiBento/Preview'
import './Home.css'

const explorations = [
  { title: 'Cursor Keys', slug: 'cursor-keys', preview: CursorKeysPreview },
  { title: 'Scroll Keys', slug: 'scroll-keys', preview: ScrollKeysPreview },
  { title: 'Explode Keys', slug: 'explode-keys', preview: ExplodeKeysPreview },
  { title: 'Grid Walkers', slug: 'grid-walkers', preview: GridWalkersPreview },
  { title: 'Tetris Keys', slug: 'tetris-keys', preview: TetrisKeysPreview },
  { title: 'ASCII Textures', slug: 'ascii-textures', preview: AsciiTexturesPreview },
  { title: 'ASCII Flow', slug: 'ascii-flow', preview: AsciiFlowPreview },
  { title: 'ASCII Terrain', slug: 'ascii-terrain', preview: AsciiTerrainPreview },
  { title: 'ASCII Waves', slug: 'ascii-waves', preview: AsciiWavesPreview },
  { title: 'ASCII Mask', slug: 'ascii-mask', preview: AsciiMaskPreview },
  { title: 'Gráficos y Métricas', slug: 'graficos-metricas', preview: GraficosMetricasPreview },
  { title: 'Particle Data', slug: 'particle-data', preview: ParticleDataPreview },
  { title: 'Key Cubes [WIP]', slug: 'key-cubes', preview: KeyCubesPreview },
  { title: 'Logo Rain [WIP]', slug: 'logo-rain', preview: LogoRainPreview },
  { title: 'Cursor Keys 3D', slug: 'cursor-keys-3d', preview: CursorKeys3DPreview },
  { title: 'Conway Keys', slug: 'conway-keys', preview: ConwayKeysPreview },
  { title: 'Conway ASCII', slug: 'conway-ascii', preview: ConwayAsciiPreview },
  { title: 'ASCII Bento', slug: 'ascii-bento', preview: AsciiBentoPreview },
]

export default function Home() {
  return (
    <div className="home">
      <h1 className="home-title">EXPLORATIONS BLUMIE</h1>
      <div className="grid">
        {explorations.map((exp) => (
          <Link key={exp.slug} to={`/exploration/${exp.slug}`} className="card">
            <div className="card-thumbnail">
              {exp.preview && <exp.preview />}
            </div>
            <div className="card-info">
              <span className="card-title">{exp.title}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
