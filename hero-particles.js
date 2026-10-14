(() => {
  'use strict';

  const hero = document.querySelector('.hero');
  const logoCanvas = document.querySelector('#xuenlab-particle-logo');
  const waveCanvas = document.querySelector('#hero-particle-wave');
  const errorElement = document.querySelector('#particle-logo-error');
  if (!hero || !logoCanvas || !waveCanvas) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /*
    XuenLab V3 source integration.
    The settings, 18,000-point random mask, logo paths, palette, shaders, density,
    and motion model below are taken directly from xuenlab-particle-v3.html.
  */
  const SETTINGS = {
    count: 18000,
    logoHeight: 510,
    brightness: 1.30,
    pointSize: 4.0,
    motion: 2.4,
    motionSpeed: 0.46,
    sparkle: 0.50,
    mousePush: 13
  };

  const symbolPaths = [
    'M24 42h60c15 0 24 7 34 21l114 151h-57c-15 0-24-7-34-20L24 42Z',
    'm148 82 23-30c6-7 13-10 24-10h37l-53 70c-5 7-11 8-17 2l-14-17c-4-5-4-10 0-15Z',
    'M24 214h44c13 0 21-5 29-15l16-21c5-7 5-12 0-18l-6-8c-5-7-12-7-18 1l-65 61Z'
  ];

  function createLogoRenderer(canvas) {
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      premultipliedAlpha: false
    }) || canvas.getContext('experimental-webgl');

    if (!gl) throw new Error('WebGL is not available. Enable hardware acceleration to view the particle sculpture.');

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = 512;
    maskCanvas.height = 512;
    const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
    maskContext.scale(2, 2);
    maskContext.fillStyle = 'white';
    symbolPaths.forEach((path) => maskContext.fill(new Path2D(path)));
    const bitmap = maskContext.getImageData(0, 0, 512, 512).data;

    const particleCount = SETTINGS.count;
    const stride = 7;
    const data = new Float32Array(particleCount * stride);
    let made = 0;
    let attempts = 0;
    while (made < particleCount && attempts < particleCount * 35) {
      attempts += 1;
      let x = 20 + Math.random() * 216;
      let y = 38 + Math.random() * 180;
      const xi = Math.floor(x * 2);
      const yi = Math.floor(y * 2);
      if (bitmap[(yi * 512 + xi) * 4 + 3] < 145) continue;
      if (Math.random() < .15) {
        x += (Math.random() - .5) * 3.8;
        y += (Math.random() - .5) * 3.8;
      }
      const index = made * stride;
      data[index] = x - 128;
      data[index + 1] = 128 - y;
      data[index + 2] = (Math.random() - .5) * 20 + Math.sin(x * .030) * 4;
      data[index + 3] = Math.pow(Math.random(), .7);
      data[index + 4] = Math.random() * 6.2831853;
      data[index + 5] = .55 + Math.random() * .9;
      data[index + 6] = .65 + Math.random() * .8;
      made += 1;
    }

    const compileShader = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };

    const vertexSource = `
      precision highp float;
      attribute vec3 aPosition;
      attribute vec4 aMeta;
      uniform vec2 uViewport;
      uniform float uScale;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uPointSize;
      uniform float uMotion;
      uniform float uMotionSpeed;
      uniform vec2 uPointer;
      uniform float uMousePush;
      varying vec3 vColor;
      varying float vLight;
      void main(){
        float time = uTime * uMotionSpeed;
        vec3 p = aPosition;
        float phase = aMeta.y;
        float waveX = sin(time*1.13 + p.y*.045) * .68 + sin(time*.81 + p.x*.036 + phase)*.32;
        float waveY = cos(time*.97 + p.x*.041) * .70 + cos(time*.76 + p.y*.039 + phase)*.30;
        p.xy += vec2(waveX,waveY)*uMotion / max(uScale,.1);
        float yaw = -.12 + sin(time*.17)*.032;
        float tx = p.x*cos(yaw) + p.z*sin(yaw);
        float tz = -p.x*sin(yaw) + p.z*cos(yaw);
        vec2 pixel = vec2(tx,p.y)*uScale;
        vec2 d = pixel-uPointer;
        float dist = length(d);
        float influence = pow(max(0.0,1.0-dist/125.0),2.0);
        if (dist > .01) pixel += normalize(d) * influence * uMousePush;
        gl_Position = vec4(pixel*2.0/uViewport, 0.0, 1.0);
        float depthFactor = clamp((tz+60.0)/120.0,0.5,1.0);
        gl_PointSize = uPointSize*uPixelRatio*aMeta.w*(.92+depthFactor*.18);
        float cool = smoothstep(.74, .99, aMeta.x);
        vColor = mix(vec3(.10,.62,1.0),vec3(.66,.88,1.0),cool*.9);
        vLight = (.72 + aMeta.x*.43) * (.93+depthFactor*.12);
        float fast = .7 + aMeta.z*.75;
        float pulse = pow(max(0.0,sin(uTime*fast+phase*3.7)),18.0);
        vLight += pulse * .55;
      }
    `;

    const fragmentSource = `
      precision mediump float;
      uniform float uBrightness;
      uniform float uSparkle;
      varying vec3 vColor;
      varying float vLight;
      void main(){
        vec2 xy=(gl_PointCoord-.5)*2.0;
        float r=length(xy);
        if(r>1.0)discard;
        float core=1.0-smoothstep(.20,.52,r);
        float halo=(1.0-smoothstep(.28,1.0,r))*.22;
        float light = min(1.8, vLight * uBrightness);
        float alpha=(core*.82 + halo*.50) * light;
        vec3 c=mix(vColor,vec3(.92,.97,1.0),clamp((light-1.1)*uSparkle*.38,0.0,.55));
        gl_FragColor=vec4(c,min(.96,alpha));
      }
    `;

    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const bindAttribute = (name, length, offset) => {
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, length, gl.FLOAT, false, stride * 4, offset * 4);
    };
    bindAttribute('aPosition', 3, 0);
    bindAttribute('aMeta', 4, 3);

    const uniforms = {};
    [
      'uViewport', 'uScale', 'uTime', 'uPixelRatio', 'uPointSize', 'uMotion',
      'uMotionSpeed', 'uPointer', 'uMousePush', 'uBrightness', 'uSparkle'
    ].forEach((name) => { uniforms[name] = gl.getUniformLocation(program, name); });

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0, 0, 0, 0);

    let width = 0;
    let height = 0;
    let scale = 1;
    const pointer = { x: 10000, y: 10000, targetX: 10000, targetY: 10000 };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const nextWidth = Math.round(width * pixelRatio);
      const nextHeight = Math.round(height * pixelRatio);
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        gl.viewport(0, 0, nextWidth, nextHeight);
      }
      scale = Math.min(SETTINGS.logoHeight, height * .72, width * .68) / 192;
      gl.uniform2f(uniforms.uViewport, width, height);
      gl.uniform1f(uniforms.uScale, scale);
      gl.uniform1f(uniforms.uPixelRatio, pixelRatio);
      gl.uniform1f(uniforms.uPointSize, SETTINGS.pointSize);
      gl.uniform1f(uniforms.uMotion, SETTINGS.motion);
      gl.uniform1f(uniforms.uMotionSpeed, SETTINGS.motionSpeed);
      gl.uniform1f(uniforms.uMousePush, SETTINGS.mousePush);
      gl.uniform1f(uniforms.uBrightness, SETTINGS.brightness);
      gl.uniform1f(uniforms.uSparkle, SETTINGS.sparkle);
    };

    canvas.addEventListener('pointermove', (event) => {
      const bounds = canvas.getBoundingClientRect();
      pointer.targetX = event.clientX - bounds.left - width / 2;
      pointer.targetY = height / 2 - (event.clientY - bounds.top);
    }, { passive: true });
    canvas.addEventListener('pointerleave', () => {
      pointer.targetX = 10000;
      pointer.targetY = 10000;
    });

    const draw = (time) => {
      pointer.x += (pointer.targetX - pointer.x) * .15;
      pointer.y += (pointer.targetY - pointer.y) * .15;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uniforms.uTime, time);
      gl.uniform2f(uniforms.uPointer, pointer.x, pointer.y);
      gl.drawArrays(gl.POINTS, 0, made);
    };

    resize();
    return { resize, draw };
  }

  function createWaveRenderer(canvas) {
    const context = canvas.getContext('2d', { alpha: true });
    let width = 0;
    let height = 0;
    let pixelRatio = 1;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
      const nextWidth = Math.round(width * pixelRatio);
      const nextHeight = Math.round(height * pixelRatio);
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const random = (column, row) => {
      const value = Math.sin(column * 127.1 + row * 311.7) * 43758.5453;
      return value - Math.floor(value);
    };

    const draw = (time) => {
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';
      const columns = Math.max(52, Math.min(104, Math.round(width / 18)));
      const rows = width < 720 ? 31 : 42;
      const horizon = height * .045;

      for (let row = 0; row < rows; row += 1) {
        // Overscan the near field so the surface continues beyond the Hero edge.
        const travelDepth = row / Math.max(1, rows - 1) * 1.22;
        const depth = Math.min(travelDepth, 1);
        const perspective = Math.pow(travelDepth, 1.42);
        const spread = width * (1.02 + Math.min(perspective, 1.3) * .40);
        const centerX = width * .5;
        const baseY = horizon + perspective * height * .77;
        const terrainScale = height * (.018 + depth * .075);

        for (let column = 0; column < columns; column += 1) {
          const xRatio = column / Math.max(1, columns - 1) - .5;
          const seed = random(column, row);
          const x = centerX + xRatio * spread + (seed - .5) * (3 + depth * 7);
          if (x < -8 || x > width + 8) continue;

          const primaryPhase = xRatio * 1.8 + travelDepth * 6.4 - time * .28;
          const crossPhase = -xRatio * 2.5 + travelDepth * 8.8 - time * .34 + 1.35;
          const secondaryPhase = xRatio * 4 + travelDepth * 13.2 - time * .46 + .45;
          const ripplePhase = -xRatio * 7.2 + travelDepth * 20.5 - time * .6 + 2.1;
          const primary = Math.sin(primaryPhase) * .6;
          const cross = Math.sin(crossPhase) * .24;
          const secondary = Math.sin(secondaryPhase) * .11;
          const ripple = Math.sin(ripplePhase) * .05;
          const combinedSwell = primary + cross + secondary + ripple;
          const crestShape = combinedSwell + combinedSwell * Math.abs(combinedSwell) * .11;
          const horizontalDrift = (Math.cos(primaryPhase) * .58 + Math.cos(crossPhase) * .25)
            * terrainScale * .055;
          const xPosition = x + horizontalDrift;
          const y = baseY + crestShape * terrainScale + (seed - .5) * (2 + depth * 3.5);
          const bright = random(column + 19, row + 41);
          const copyClearance = xPosition < width * .48 && y < height * .54 ? .52 : 1;
          const logoClearance = xPosition > width * .57 && y < height * .48 ? .58 : 1;
          const readability = copyClearance * logoClearance;
          const alpha = (.16 + depth * .43) * (.7 + bright * .48) * readability;
          const radius = .42 + depth * 1.38 + (bright > .965 ? .72 : 0);

          if (bright > .965) {
            context.beginPath();
            context.fillStyle = `rgba(78,169,255,${alpha * .12})`;
            context.arc(xPosition, y, radius * 3.2, 0, Math.PI * 2);
            context.fill();
          }

          context.beginPath();
          context.fillStyle = bright > .88
            ? `rgba(226,241,255,${Math.min(.82, alpha * 1.28)})`
            : `rgba(74,165,255,${Math.min(.68, alpha)})`;
          context.arc(xPosition, y, radius, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalCompositeOperation = 'source-over';
    };

    resize();
    return { resize, draw };
  }

  let logoRenderer;
  try {
    logoRenderer = createLogoRenderer(logoCanvas);
  } catch (error) {
    logoCanvas.hidden = true;
    if (errorElement) {
      errorElement.style.display = 'block';
      errorElement.textContent = error.message;
    }
  }
  const waveRenderer = createWaveRenderer(waveCanvas);
  const renderers = [logoRenderer, waveRenderer].filter(Boolean);

  let frameId = 0;
  let visible = true;
  const startedAt = performance.now();

  const drawFrame = (now) => {
    frameId = 0;
    const time = reducedMotion.matches ? 0 : (now - startedAt) / 1000;
    renderers.forEach((renderer) => renderer.draw(time));
    if (visible && !document.hidden && !reducedMotion.matches) {
      frameId = window.requestAnimationFrame(drawFrame);
    }
  };

  const refreshAnimation = () => {
    if (frameId) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }
    if (visible && !document.hidden) frameId = window.requestAnimationFrame(drawFrame);
  };

  const resize = () => {
    renderers.forEach((renderer) => renderer.resize());
    refreshAnimation();
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      refreshAnimation();
    }, { threshold: .01 });
    observer.observe(hero);
  }

  document.addEventListener('visibilitychange', refreshAnimation);
  reducedMotion.addEventListener?.('change', refreshAnimation);
  window.addEventListener('resize', resize, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(hero);
  refreshAnimation();
})();
