(() => {
  const hero = document.querySelector('.glass-hero');
  const canvas = document.querySelector('#glass-flow');
  if (!hero || !canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const loopDuration = 14000;
  const startTime = performance.now();

  let heroFrame = 0;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let heroVisible = true;
  let glass = null;

  const compileShader = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'Unable to compile glass shader');
    }
    return shader;
  };

  const createGlassRenderer = (image) => {
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    if (!gl) return null;

    const vertexSource = `
      attribute vec2 aPosition;
      varying vec2 vUv;
      void main() {
        vUv = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision highp float;
      uniform sampler2D uTexture;
      uniform vec2 uResolution;
      uniform vec2 uImage;
      uniform vec2 uPointer;
      uniform float uPhase;
      uniform float uMotion;
      uniform float uFocus;
      varying vec2 vUv;

      vec2 artworkUv(vec2 uv, vec2 rigidOffset, out float inside) {
        float screenAspect = uResolution.x / uResolution.y;
        float imageAspect = uImage.x / uImage.y;
        vec2 sceneUv = uv - rigidOffset;
        vec2 mapped;

        vec2 coverScale = screenAspect > imageAspect
          ? vec2(1.0, imageAspect / screenAspect)
          : vec2(screenAspect / imageAspect, 1.0);
        coverScale *= 0.985;
        mapped = (sceneUv - 0.5) * coverScale + 0.5;
        mapped.x += (uFocus - 0.5) * (1.0 - coverScale.x);
        inside = 1.0;
        return clamp(mapped, 0.0, 1.0);
      }

      float materialMask(vec3 color) {
        float body = max(max(color.r, color.g), color.b);
        float chroma = max(color.b, color.r) - min(color.g, min(color.r, color.b));
        return smoothstep(0.025, 0.24, body + chroma * 0.3);
      }

      void main() {
        vec2 orbitalDrift = vec2(sin(uPhase), cos(uPhase))
          * vec2(0.0045, 0.0032) * uMotion;
        vec2 pointerDrift = uPointer * vec2(0.0035, 0.0028) * uMotion;

        float inside;
        vec2 uv = artworkUv(vUv, orbitalDrift + pointerDrift, inside);
        vec3 source = texture2D(uTexture, uv).rgb * inside;
        float material = materialMask(source);
        float interior = material * smoothstep(0.34, 0.78, material) * inside;
        float pointerPhase = dot(uPointer, vec2(0.55, -0.35));

        float cyanField = 0.5 + 0.5 * sin(
          uv.x * 12.0 - uv.y * 5.5 - uPhase * 2.0 + pointerPhase
        );
        float cyanPass = pow(cyanField, 5.0) * interior;

        float violetField = 0.5 + 0.5 * sin(
          uv.x * 7.0 + uv.y * 9.0 + uPhase * 3.0 - pointerPhase * 0.6
        );
        float violetPass = pow(violetField, 7.0) * interior;

        float silverField = 0.5 + 0.5 * cos(
          uv.x * 17.0 - uv.y * 3.0 + uPhase
        );
        float silverPass = pow(silverField, 15.0) * interior;

        vec3 travelingLight =
          vec3(0.08, 0.72, 1.0) * cyanPass * 0.24 +
          vec3(0.34, 0.14, 0.78) * violetPass * 0.22 +
          vec3(0.82, 0.93, 1.0) * silverPass * 0.2;

        float illumination = 0.94
          + cyanPass * 0.11
          + violetPass * 0.07
          + 0.025 * sin(uPhase);
        float lowerRight = smoothstep(0.6, 0.98, vUv.x)
          * (1.0 - smoothstep(0.08, 0.55, vUv.y));
        vec3 finalColor = (source * illumination + travelingLight * uMotion)
          * (1.0 - lowerRight * 0.04);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Unable to link glass shader');
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    const uniforms = {
      texture: gl.getUniformLocation(program, 'uTexture'),
      resolution: gl.getUniformLocation(program, 'uResolution'),
      image: gl.getUniformLocation(program, 'uImage'),
      pointer: gl.getUniformLocation(program, 'uPointer'),
      phase: gl.getUniformLocation(program, 'uPhase'),
      motion: gl.getUniformLocation(program, 'uMotion'),
      focus: gl.getUniformLocation(program, 'uFocus')
    };
    gl.uniform1i(uniforms.texture, 0);
    gl.uniform2f(uniforms.image, image.naturalWidth, image.naturalHeight);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.15 : 1.5);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      gl.uniform2f(uniforms.resolution, width, height);
      gl.uniform1f(uniforms.focus, window.innerWidth <= 700 ? 0.54 : 0.5);
    };

    const draw = (now, motion) => {
      resize();
      const phase = (((now - startTime) % loopDuration) / loopDuration) * Math.PI * 2;
      gl.uniform1f(uniforms.phase, phase);
      gl.uniform1f(uniforms.motion, motion);
      gl.uniform2f(uniforms.pointer, currentX / 20, -currentY / 14);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      canvas.classList.remove('is-active');
      glass = null;
    });
    canvas.classList.add('is-active');
    return { draw };
  };

  const renderHero = (now = performance.now()) => {
    currentX += (targetX - currentX) * 0.055;
    currentY += (targetY - currentY) * 0.055;
    hero.style.setProperty('--glass-pointer-x', `${currentX.toFixed(2)}px`);
    hero.style.setProperty('--glass-pointer-y', `${currentY.toFixed(2)}px`);
    glass?.draw(now, 1);

    if (heroVisible && !document.hidden && !reduceMotion.matches) {
      heroFrame = requestAnimationFrame(renderHero);
    } else {
      heroFrame = 0;
    }
  };

  const startHero = () => {
    if (!heroFrame && heroVisible && !document.hidden && !reduceMotion.matches) {
      heroFrame = requestAnimationFrame(renderHero);
    }
  };

  const stopHero = () => {
    if (heroFrame) cancelAnimationFrame(heroFrame);
    heroFrame = 0;
  };

  hero.addEventListener('pointermove', (event) => {
    if (reduceMotion.matches) return;
    const bounds = hero.getBoundingClientRect();
    targetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * -20;
    targetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * -14;
  }, { passive: true });

  hero.addEventListener('pointerleave', () => {
    targetX = 0;
    targetY = 0;
  });

  window.addEventListener('resize', () => {
    glass?.draw(performance.now(), reduceMotion.matches ? 0 : 1);
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopHero();
    else startHero();
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      heroVisible = entry.isIntersecting;
      if (heroVisible) startHero();
      else stopHero();
    }, { threshold: 0.02 });
    observer.observe(hero);
  }

  reduceMotion.addEventListener?.('change', () => {
    if (reduceMotion.matches) {
      stopHero();
      glass?.draw(performance.now(), 0);
    } else {
      startHero();
    }
  });

  const reveal = () => requestAnimationFrame(() => hero.classList.add('is-ready'));
  const keyVisual = new Image();
  keyVisual.onload = () => {
    try {
      glass = createGlassRenderer(keyVisual);
      glass?.draw(performance.now(), reduceMotion.matches ? 0 : 1);
    } catch (error) {
      console.warn('Glass motion fallback enabled.', error);
    }
    reveal();
    startHero();
  };
  keyVisual.onerror = reveal;
  keyVisual.src = 'assets/liquid-glass-ribbon-v2.png';
})();
