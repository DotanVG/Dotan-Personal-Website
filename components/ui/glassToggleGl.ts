import { fragmentShader, vertexShader } from "@/lib/glassShader";
import {
  GLASS_CANVAS,
  ICON_SIZE,
  buildIconMasks,
  easeOutCubic,
  morphDuration,
} from "@/lib/glassToggle";

export type GlassController = {
  readonly thumb: number;
  setThumb: (value: number) => void;
  animateTo: (value: number) => void;
  suspend: (paused: boolean) => void;
  destroy: () => void;
};

export function mountGlassToggle(
  canvas: HTMLCanvasElement,
  initial: number,
  onLost: () => void,
): GlassController | null {
  const context = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!context) return null;
  const gl: WebGLRenderingContext = context;

  const program = link(gl, vertexShader(), fragmentShader());
  if (!program) return null;

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const texture = uploadIcons(gl);
  const uRes = gl.getUniformLocation(program, "u_res");
  const uCss = gl.getUniformLocation(program, "u_css");
  const uDpr = gl.getUniformLocation(program, "u_dpr");
  const uT = gl.getUniformLocation(program, "u_t");
  const uIcons = gl.getUniformLocation(program, "u_icons");

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(GLASS_CANVAS.w * dpr);
  canvas.height = Math.round(GLASS_CANVAS.h * dpr);
  canvas.style.width = `${GLASS_CANVAS.w}px`;
  canvas.style.height = `${GLASS_CANVAS.h}px`;

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(program);
  gl.uniform2f(uRes, canvas.width, canvas.height);
  gl.uniform2f(uCss, GLASS_CANVAS.w, GLASS_CANVAS.h);
  gl.uniform1f(uDpr, dpr);
  gl.uniform1i(uIcons, 0);

  const state = {
    thumb: initial,
    from: initial,
    target: initial,
    anim: false,
    elapsed: 0,
    duration: 0,
    last: 0,
    raf: 0,
    suspended: false,
    dead: false,
  };

  const onContextLost = (event: Event) => {
    event.preventDefault();
    state.dead = true;
    if (state.raf) cancelAnimationFrame(state.raf);
    onLost();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);

  function draw() {
    if (state.dead) return;
    gl.uniform1f(uT, state.thumb);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now: number) {
    state.raf = 0;
    if (state.suspended || state.dead) return;
    const dt = state.last ? Math.min(34, now - state.last) : 16;
    state.last = now;
    if (state.anim) {
      state.elapsed += dt;
      const p = easeOutCubic(state.elapsed / state.duration);
      state.thumb = state.from + (state.target - state.from) * p;
      if (state.elapsed >= state.duration) {
        state.thumb = state.target;
        state.anim = false;
        state.elapsed = 0;
        state.last = 0;
      }
    }
    draw();
    if (state.anim && !state.suspended) state.raf = requestAnimationFrame(frame);
  }

  function kick() {
    if (state.suspended || state.dead || state.raf) return;
    if (!state.anim) {
      draw();
      return;
    }
    state.raf = requestAnimationFrame(frame);
  }

  draw();

  return {
    get thumb() {
      return state.thumb;
    },
    setThumb(value) {
      state.anim = false;
      state.elapsed = 0;
      state.last = 0;
      state.thumb = value;
      state.target = value;
      kick();
    },
    animateTo(value) {
      if (Math.abs(state.target - value) < 0.001) {
        if (!state.anim) {
          state.thumb = value;
          kick();
        }
        return;
      }
      state.from = state.thumb;
      state.target = value;
      state.elapsed = 0;
      state.last = 0;
      state.duration = morphDuration(value - state.from);
      state.anim = true;
      if (state.raf) cancelAnimationFrame(state.raf);
      state.raf = 0;
      kick();
    },
    suspend(paused) {
      state.suspended = paused;
      if (paused) {
        if (state.raf) cancelAnimationFrame(state.raf);
        state.raf = 0;
        state.last = 0;
        return;
      }
      kick();
    },
    destroy() {
      state.dead = true;
      if (state.raf) cancelAnimationFrame(state.raf);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.deleteTexture(texture);
    },
  };
}

function link(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram | null {
  const program = gl.createProgram();
  const vert = compile(gl, gl.VERTEX_SHADER, vs);
  const frag = compile(gl, gl.FRAGMENT_SHADER, fs);
  if (!program || !vert || !frag) return null;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.bindAttribLocation(program, 0, "a_pos");
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function uploadIcons(gl: WebGLRenderingContext): WebGLTexture | null {
  const { sun, moon } = buildIconMasks();
  const data = new Uint8Array(ICON_SIZE * ICON_SIZE * 2 * 4);
  writeMask(data, sun, 0);
  writeMask(data, moon, 1);
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    ICON_SIZE,
    ICON_SIZE * 2,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    data,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  return texture;
}

function writeMask(data: Uint8Array, mask: Uint8Array, row: number) {
  for (let i = 0; i < mask.length; i++) {
    const o = (row * mask.length + i) * 4;
    const v = mask[i];
    data[o] = v;
    data[o + 1] = v;
    data[o + 2] = v;
    data[o + 3] = 255;
  }
}
