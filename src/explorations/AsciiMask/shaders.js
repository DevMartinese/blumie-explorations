export const vertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec2 vScreenPos;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vScreenPos = (clipPos.xy / clipPos.w) * 0.5 + 0.5;
  gl_Position = clipPos;
}
`

export const fragmentShader = /* glsl */ `
uniform vec2 uMask0;
uniform vec2 uMask1;
uniform vec2 uMask2;
uniform float uMaskRadius;
uniform float uTime;
uniform float uAspect;
uniform vec3 uModelColor;

varying vec2 vUv;
varying vec3 vNormal;
varying vec2 vScreenPos;

// --- Noise utilities ---
float hash(vec2 p) {
  float n = sin(dot(p, vec2(127.1, 311.7))) * 43758.5453;
  return fract(n);
}

float hash3(float x, float y, float z) {
  float n = sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return fract(n);
}

float fade(float t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

float valueNoise3(float x, float y, float z) {
  float ix = floor(x); float iy = floor(y); float iz = floor(z);
  float fx = fade(x - ix); float fy = fade(y - iy); float fz = fade(z - iz);
  return mix(
    mix(
      mix(hash3(ix, iy, iz), hash3(ix + 1.0, iy, iz), fx),
      mix(hash3(ix, iy + 1.0, iz), hash3(ix + 1.0, iy + 1.0, iz), fx),
      fy
    ),
    mix(
      mix(hash3(ix, iy, iz + 1.0), hash3(ix + 1.0, iy, iz + 1.0), fx),
      mix(hash3(ix, iy + 1.0, iz + 1.0), hash3(ix + 1.0, iy + 1.0, iz + 1.0), fx),
      fy
    ),
    fz
  );
}

float fbm(float x, float y, float z, int octaves) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    v += a * valueNoise3(x, y, z);
    x *= 2.0; y *= 2.0; z *= 2.0; a *= 0.5;
  }
  return v;
}

// --- ASCII grid helpers ---
// Dense grid: CELL=14px equivalent. At ~1400px screen width, that's ~100 cells.
const float GRID_SIZE = 100.0;
const float TILE_RATIO = 0.857; // 12/14 — tile fills most of the cell

vec2 cellId(vec2 pos) {
  return floor(pos * GRID_SIZE);
}

vec2 cellUv(vec2 pos) {
  return fract(pos * GRID_SIZE);
}

// RoundRect SDF: centered at 0.5,0.5 with half-size s and corner radius r
float sdRoundRect(vec2 uv, float s, float r) {
  vec2 d = abs(uv - 0.5) - s + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

float sdCircle(vec2 uv, float r) {
  return length(uv - 0.5) - r;
}

float sdDash(vec2 uv, float w, float h) {
  vec2 d = abs(uv - 0.5) - vec2(w, h);
  return max(d.x, d.y);
}

// --- Pattern: Waves (based on AsciiWaves) ---
// Dense tiles: blue roundRects in wave bands, gray dots elsewhere, white edge tiles
vec3 patternWaves(vec2 pos) {
  vec3 blueBg = vec3(0.333, 0.4, 0.8);     // #5566CC
  vec3 baseBg = vec3(0.847, 0.863, 0.91);   // #D8DCE8
  vec3 blueLight = vec3(0.44, 0.5, 0.867);  // #7080DD
  vec3 whiteBg = vec3(0.91, 0.925, 0.957);  // #E8ECF4
  vec3 grayDot = vec3(0.565, 0.596, 0.69);  // #9098B0

  // Noise for wave bands (stretched Y for horizontal bands)
  float ns = 5.0; // noise scale multiplier
  float wave = fbm(pos.x * 0.7 * ns + 10.0, pos.y * 1.8 * ns + 10.0, uTime * 0.08, 4);
  float wave2 = fbm(pos.x * 0.5 * ns + 200.0, pos.y * 1.5 * ns + 200.0, uTime * 0.056, 3);
  float combined = wave * 0.6 + wave2 * 0.4;

  float scatter = valueNoise3(pos.x * 4.0 * ns + 500.0, pos.y * 4.0 * ns + 500.0, uTime * 0.12);

  bool isBlue = combined > 0.48;
  bool isScatter = !isBlue && combined > 0.40 && scatter > 0.55;
  float edgeDist = abs(combined - 0.48);
  bool isEdgeWhite = edgeDist < 0.02 && scatter > 0.45;

  vec2 cu = cellUv(pos);
  float tileHalf = TILE_RATIO * 0.5;
  float tile = sdRoundRect(cu, tileHalf, 0.06);
  float dot_ = sdCircle(cu, 0.08);

  if (isBlue) {
    // Blue tile with light dot center
    if (tile < 0.0) {
      if (dot_ < 0.0) return blueLight;
      return blueBg;
    }
    return baseBg;
  } else if (isScatter) {
    // Scattered blue-light tiles
    if (tile < 0.0) {
      return mix(blueLight, blueBg, 0.2);
    }
    return baseBg;
  } else if (isEdgeWhite) {
    // White tiles at wave boundaries
    if (tile < 0.0) return whiteBg;
    return baseBg;
  } else {
    // Gray area: gray tiles with dots (not empty)
    if (tile < 0.0) {
      vec3 grayTile = vec3(0.753, 0.776, 0.831); // #C0C6D4
      if (dot_ < 0.0) return grayDot;
      return grayTile;
    }
    return baseBg;
  }
}

// --- Pattern: Terrain (based on AsciiTerrain) ---
// Progressive shapes by elevation: dots → dashes → squares, all in coral on peach
vec3 patternTerrain(vec2 pos) {
  vec3 coral = vec3(0.878, 0.471, 0.314);   // #E07850
  vec3 peach = vec3(0.961, 0.867, 0.816);   // #F5DDD0

  // Elevation: diagonal gradient + noise
  float gradient = pos.x * 0.5 + pos.y * 0.5;
  float ns = 5.0;
  float noise = fbm(pos.x * ns + 50.0, pos.y * ns + 50.0, uTime * 0.06, 4);
  float elev = gradient * 0.55 + noise * 0.45;

  float detail = valueNoise3(pos.x * 5.0 * ns + 333.0, pos.y * 5.0 * ns + 333.0, uTime * 0.1);

  vec2 cu = cellUv(pos);
  float alpha = 0.5 + elev * 0.5;

  // Shape selection by elevation bands (matching AsciiTerrain)
  float shape = 1.0; // >0 means outside shape
  if (elev < 0.25) {
    // Empty
    return peach;
  } else if (elev < 0.35) {
    // Sparse small dots
    if (detail > 0.5) shape = sdCircle(cu, 0.1);
    else return peach;
  } else if (elev < 0.42) {
    // Small/medium dots
    if (detail > 0.4) shape = sdCircle(cu, 0.1);
    else shape = sdCircle(cu, 0.18);
  } else if (elev < 0.50) {
    // Medium dots and dashes
    if (detail > 0.5) shape = sdCircle(cu, 0.18);
    else shape = sdDash(cu, 0.22, 0.08);
  } else if (elev < 0.58) {
    // Dashes and small squares
    if (detail > 0.6) shape = sdDash(cu, 0.22, 0.08);
    else shape = sdRoundRect(cu, 0.15, 0.03);
  } else if (elev < 0.66) {
    // Small and medium squares
    if (detail > 0.5) shape = sdRoundRect(cu, 0.15, 0.03);
    else shape = sdRoundRect(cu, 0.2, 0.04);
  } else if (elev < 0.75) {
    // Medium and large squares
    if (detail > 0.55) shape = sdRoundRect(cu, 0.2, 0.04);
    else shape = sdRoundRect(cu, 0.3, 0.05);
  } else {
    // Dense: large squares
    if (detail > 0.5) shape = sdRoundRect(cu, 0.3, 0.05);
    else if (detail > 0.3) shape = sdRoundRect(cu, 0.2, 0.04);
    else shape = sdRoundRect(cu, 0.15, 0.03);
  }

  if (shape < 0.0) {
    return mix(peach, coral, alpha);
  }
  return peach;
}

// --- Pattern: Flow (based on AsciiFlow) ---
// 100% tile coverage, 5 colored regions with curl noise advection
vec3 patternFlow(vec2 pos) {
  vec3 colors[5];
  colors[0] = vec3(0.722, 0.91, 0.627);   // #B8E8A0 green
  colors[1] = vec3(0.961, 0.902, 0.627);   // #F5E6A0 yellow
  colors[2] = vec3(0.502, 0.871, 0.69);    // #80DEB0 teal
  colors[3] = vec3(1.0, 0.722, 0.847);     // #FFB8D8 pink
  colors[4] = vec3(0.659, 0.659, 1.0);     // #A8A8FF purple

  vec3 darks[5];
  darks[0] = vec3(0.29, 0.478, 0.188);    // #4A7A30
  darks[1] = vec3(0.541, 0.478, 0.188);   // #8A7A30
  darks[2] = vec3(0.102, 0.416, 0.251);   // #1A6A40
  darks[3] = vec3(0.541, 0.125, 0.314);   // #8A2050
  darks[4] = vec3(0.188, 0.188, 0.627);   // #3030A0

  // Curl noise advection
  float ns = 4.0;
  float eps = 0.01;
  float n0 = fbm(pos.x * 3.0 * ns, pos.y * 3.0 * ns, uTime * 0.06, 4);
  float nx_ = fbm((pos.x + eps) * 3.0 * ns, pos.y * 3.0 * ns, uTime * 0.06, 4);
  float ny_ = fbm(pos.x * 3.0 * ns, (pos.y + eps) * 3.0 * ns, uTime * 0.06, 4);
  vec2 curl = vec2(ny_ - n0, -(nx_ - n0)) / eps;
  vec2 advected = pos + curl * 0.005;

  // Compete regions: highest noise wins
  float bestVal = -1.0;
  float secondBest = -1.0;
  int bestIdx = 0;
  for (int i = 0; i < 5; i++) {
    float ox = hash3(float(i) * 17.0, 0.0, 0.0) * 100.0;
    float oy = hash3(0.0, float(i) * 23.0, 0.0) * 100.0;
    float val = fbm(advected.x * ns * 2.0 + ox, advected.y * ns * 2.0 + oy, uTime * 0.06, 4);
    if (val > bestVal) {
      secondBest = bestVal;
      bestVal = val;
      bestIdx = i;
    } else if (val > secondBest) {
      secondBest = val;
    }
  }

  vec3 tileCol = colors[bestIdx];
  vec3 darkCol = darks[bestIdx];

  // Edge scaling: tiles shrink at region boundaries
  float edge = bestVal - secondBest;
  float tileScale = edge < 0.02 ? mix(0.6, 1.0, edge / 0.02) : 1.0;

  vec2 cu = cellUv(pos);
  float tileHalf = TILE_RATIO * 0.5 * tileScale;
  float tile = sdRoundRect(cu, tileHalf, 0.06 * tileScale);

  if (tile < 0.0) {
    // Symbol dot inside tile
    float dot_ = sdCircle(cu, 0.06);
    if (dot_ < 0.0) return darkCol;
    return tileCol;
  }

  // Gap between tiles: slightly darker background
  return tileCol * 0.85;
}

// --- Mask distance (aspect-corrected, Chebyshev for square) ---
float maskDist(vec2 screenPos, vec2 maskCenter) {
  vec2 d = abs(screenPos - maskCenter);
  d.x *= uAspect;
  return max(d.x, d.y);
}

void main() {
  // Distances to each mask center (Chebyshev = square shape)
  float d0 = maskDist(vScreenPos, uMask0);
  float d1 = maskDist(vScreenPos, uMask1);
  float d2 = maskDist(vScreenPos, uMask2);

  float feather = uMaskRadius * 0.03;
  float m0 = 1.0 - smoothstep(uMaskRadius - feather, uMaskRadius + feather, d0);
  float m1 = 1.0 - smoothstep(uMaskRadius - feather, uMaskRadius + feather, d1);
  float m2 = 1.0 - smoothstep(uMaskRadius - feather, uMaskRadius + feather, d2);

  // Diffuse lighting for the unmasked model
  vec3 lightDir = normalize(vec3(0.5, 0.8, 0.6));
  float diffuse = max(dot(vNormal, lightDir), 0.0) * 0.6 + 0.4;
  vec3 modelLit = uModelColor * diffuse;

  // Determine which mask is closest (wins overlap)
  vec3 masked = modelLit;
  float totalMask = 0.0;

  // Use the closest mask approach for overlaps
  if (m0 > 0.001 || m1 > 0.001 || m2 > 0.001) {
    vec3 p0 = patternWaves(vScreenPos);
    vec3 p1 = patternTerrain(vScreenPos);
    vec3 p2 = patternFlow(vScreenPos);

    // Closest mask wins
    if (d0 <= d1 && d0 <= d2 && m0 > 0.001) {
      masked = mix(modelLit, p0, m0);
    } else if (d1 <= d0 && d1 <= d2 && m1 > 0.001) {
      masked = mix(modelLit, p1, m1);
    } else if (m2 > 0.001) {
      masked = mix(modelLit, p2, m2);
    }
  }

  gl_FragColor = vec4(masked, 1.0);
}
`
