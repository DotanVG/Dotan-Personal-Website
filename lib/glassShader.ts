import { GLASS, ICON_SIZE } from "@/lib/glassToggle";

/** Original glass capsule. Pixels of the outgoing icon fly apart while the next icon settles. */
export function vertexShader(): string {
  return `attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;
}

export function fragmentShader(): string {
  const halfW = (GLASS.trackW / 2).toFixed(1);
  const halfH = (GLASS.trackH / 2).toFixed(1);
  const thumbR = (GLASS.thumb / 2).toFixed(1);
  const travel = GLASS.travel.toFixed(1);
  const cell = GLASS.cell.toFixed(2);
  const scatter = GLASS.scatter.toFixed(1);
  return `precision mediump float;
uniform vec2 u_res;
uniform vec2 u_css;
uniform float u_dpr;
uniform float u_t;
uniform sampler2D u_icons;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float iconTex(float x, float y, float row) {
  if (x < 0.0 || y < 0.0 || x >= ${ICON_SIZE}.0 || y >= ${ICON_SIZE}.0) return 0.0;
  vec2 uv = vec2(x + 0.5, y + 0.5 + row * ${ICON_SIZE}.0) / vec2(${ICON_SIZE}.0, ${ICON_SIZE}.0 * 2.0);
  return texture2D(u_icons, uv).r;
}

void main() {
  vec2 css = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) / u_dpr;
  vec2 p = css - 0.5 * u_css;
  float night = 1.0 - u_t;
  vec3 warm = vec3(1.0, 0.46, 0.10);
  vec3 cool = vec3(0.36, 0.64, 1.0);
  vec3 glowCol = mix(warm, cool, night);

  float track = sdRoundBox(p, vec2(${halfW}, ${halfH}), ${halfH});
  float thumbX = mix(-${travel}, ${travel}, u_t);
  vec2 tp = p - vec2(thumbX, 0.0);
  float thumb = sdRoundBox(tp, vec2(${thumbR}, ${thumbR}), ${thumbR});

  float trackIn = smoothstep(0.7, -0.2, track);
  float trackLine = trackIn * smoothstep(1.6, 0.2, abs(track));
  vec3 trackFill = mix(vec3(0.90, 0.90, 0.93), vec3(0.05, 0.06, 0.08), night);
  vec3 trackEdge = mix(vec3(0.55, 0.55, 0.60), vec3(0.42, 0.48, 0.60), night);

  float thumbIn = smoothstep(0.8, -0.2, thumb);
  vec3 thumbFill = mix(vec3(1.0, 0.94, 0.84), vec3(0.42, 0.56, 0.86), night);
  float sheen = thumbIn * smoothstep(6.0, -9.0, tp.y) * 0.22;
  thumbFill += sheen;

  float pix = 0.0;
  if (thumb < 12.0) {
    for (int y = 0; y < ${ICON_SIZE}; y++) {
      for (int x = 0; x < ${ICON_SIZE}; x++) {
        float fx = float(x);
        float fy = float(y);
        vec2 cell = vec2(fx, fy);
        vec2 home = (cell + 0.5 - ${ICON_SIZE}.0 * 0.5) * ${cell};
        vec2 j = vec2(hash(cell + 0.2), hash(cell.yx + 3.7)) - 0.5;
        float moonOn = step(0.5, iconTex(fx, fy, 1.0));
        float sunOn = step(0.5, iconTex(fx, fy, 0.0));
        vec2 moonAt = home + j * u_t * ${scatter};
        vec2 sunAt = home + j * night * ${scatter};
        vec2 md = abs(tp - moonAt);
        vec2 sd = abs(tp - sunAt);
        float box = ${cell} * 0.46;
        float moonHit = moonOn * night * step(md.x, box) * step(md.y, box);
        float sunHit = sunOn * u_t * step(sd.x, box) * step(sd.y, box);
        pix = max(pix, max(moonHit, sunHit));
      }
    }
  }
  pix *= thumbIn;
  vec3 pixCol = mix(vec3(1.0, 0.62, 0.08), vec3(0.97, 0.98, 1.0), night);

  vec2 nrm = tp / max(length(tp), 0.001);
  float bottom = smoothstep(-0.15, 0.85, nrm.y);
  float rim = smoothstep(2.6, 0.0, abs(thumb)) * (0.28 + 0.72 * bottom);
  float aura = exp(-max(thumb, 0.0) * 0.26) * smoothstep(16.0, 0.0, thumb) * step(0.0, thumb);

  vec3 col = trackFill;
  float a = trackIn * mix(0.9, 0.96, night);
  col = mix(col, trackEdge, trackLine);
  col = mix(col, thumbFill, thumbIn);
  a = max(a, thumbIn * 0.98);
  col = mix(col, glowCol, rim * (1.0 - pix) * 0.85);
  col = mix(col, glowCol, clamp(aura * 0.75, 0.0, 1.0));
  a = max(a, aura * 0.6);
  col = mix(col, pixCol, pix);
  float keep = max(smoothstep(20.0, 6.0, track), aura);
  a *= keep;

  gl_FragColor = vec4(col * a, a);
}`;
}
