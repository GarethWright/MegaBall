// Realistic rotating Earth for the HUD view: a single full-screen WebGL2 fragment shader that ray-casts a
// sphere and samples NASA Blue Marble (day), Black Marble (city lights) and cloud textures, with a sun
// terminator, ocean glint and an atmospheric limb. Textures: NASA Earth Observatory (public domain).

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;       // canvas size in px
uniform float uScale;    // canvas px per stage unit
uniform vec2 uCenter;    // sphere centre (stage units)
uniform float uRadius;   // sphere radius (stage units)
uniform float uSpin;     // rotation (turns)
uniform float uCloud;    // cloud drift (turns)
uniform vec3 uSun;       // sun direction, view space (y up)
uniform float uTilt;     // how far the pole is tipped away from the viewer (radians)
uniform sampler2D uDay, uNight, uClouds;
out vec4 outColor;
const float PI = 3.14159265;

vec2 lonLat(vec3 o, float spin) {
  float lon = atan(o.x, o.z);
  float lat = asin(clamp(o.y, -1.0, 1.0));
  return vec2(fract(lon / (2.0 * PI) + 0.5 + spin), 0.5 - lat / PI);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uScale;
  vec2 d = (p - uCenter) / uRadius;
  float r = length(d);
  vec3 L = normalize(uSun);
  float sunSide = dot(normalize(vec2(d.x, -d.y)), normalize(L.xy)) * 0.5 + 0.5;
  vec3 atmoCol = vec3(0.30, 0.62, 1.0);

  // outer atmosphere halo
  float t = max(r - 1.0, 0.0);
  float halo = exp(-t * 55.0) * (0.25 + 0.75 * sunSide) * step(1.0, r);

  if (r > 1.0) { outColor = vec4(atmoCol * halo, halo); return; }

  float z = sqrt(1.0 - r * r);
  vec3 n = vec3(d.x, -d.y, z);                 // view-space normal, y up
  // tip the pole away so the visible limb shows mid latitudes
  float c = cos(uTilt), s = sin(uTilt);
  vec3 o = vec3(n.x, c * n.y - s * n.z, s * n.y + c * n.z);

  vec3 day = texture(uDay, lonLat(o, uSpin)).rgb;
  vec3 night = texture(uNight, lonLat(o, uSpin)).rgb;
  float cloud = texture(uClouds, lonLat(o, uSpin + uCloud)).r;

  float ndl = dot(n, L);
  float lit = smoothstep(-0.10, 0.22, ndl);
  float diffuse = max(ndl, 0.0);

  // day side: surface + clouds + ocean glint
  float ocean = smoothstep(0.02, 0.12, day.b - max(day.r, day.g) * 0.85);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, H), 0.0), 70.0) * ocean * (1.0 - cloud) * 0.9;
  vec3 dayCol = mix(day, vec3(0.95), cloud * 0.9) * (0.06 + 1.15 * diffuse) + vec3(1.0, 0.95, 0.85) * spec;

  // night side: faint base + warm city lights dimmed by clouds
  float lum = dot(night, vec3(0.3, 0.59, 0.11));
  vec3 lights = vec3(1.0, 0.72, 0.42) * smoothstep(0.14, 0.7, lum) * 2.4 * (1.0 - cloud * 0.7);
  vec3 nightCol = night * 0.16 + lights + vec3(0.02, 0.04, 0.08) * cloud;

  vec3 col = mix(nightCol, dayCol, lit);

  // atmospheric scattering at the limb, strongest on the sunlit side
  float fres = pow(1.0 - z, 2.4);
  col += atmoCol * fres * (0.18 + 0.9 * smoothstep(-0.35, 0.45, ndl));
  // warm band along the terminator
  col += vec3(1.0, 0.45, 0.2) * 0.12 * exp(-abs(ndl) * 18.0) * fres;

  float edge = smoothstep(1.0, 0.996, r);
  col = col * edge + atmoCol * halo * (1.0 - edge);
  outColor = vec4(col, max(edge, halo));
}`;

function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

export async function createPlanet(canvas, opts) {
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false, alpha: true });
  if (!gl) return null;
  const sh = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);

  const [day, night, clouds] = await Promise.all(["earth/day.jpg", "earth/night.jpg", "earth/clouds.jpg"].map(loadImage));
  [[day, "uDay"], [night, "uNight"], [clouds, "uClouds"]].forEach(([img, name], i) => {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    gl.uniform1i(U(name), i);
  });

  const sun = opts.sun ?? [-0.6, 0.45, -0.66]; // behind-left: thin lit crescent, night side facing the camera
  let spin = opts.spin ?? 0.3, cloud = 0; // 0.3 turns: a lit continent faces the camera at start
  return {
    get spin() { return spin; }, set spin(v) { spin = v; },
    // stageScale = canvas px per stage unit
    render(dt, stageScale) {
      spin += dt / (opts.periodSeconds ?? 240);
      cloud += dt / 2400;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U("uRes"), canvas.width, canvas.height);
      gl.uniform1f(U("uScale"), stageScale);
      gl.uniform2f(U("uCenter"), opts.center.x, opts.center.y);
      gl.uniform1f(U("uRadius"), opts.radius);
      gl.uniform1f(U("uSpin"), spin % 1);
      gl.uniform1f(U("uCloud"), cloud % 1);
      gl.uniform3f(U("uSun"), sun[0], sun[1], sun[2]);
      gl.uniform1f(U("uTilt"), opts.tilt ?? 1.05);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
