# 🚀 ZERO SUM DROP - ZERO-LAG & PERFORMANCE STANDARDS

This document specifies the optimization rules and architectural constraints required to maintain a rock-solid **60 FPS** on both desktop and mobile web browsers (CrazyGames, Poki, etc.). To avoid the latency and micro-stuttering issues experienced in past projects, the developer must strictly implement the following guidelines from day one.

---

## 🛑 1. Memory Management & Garbage Collection (GC) Rules
Frequent object allocation and destruction cause the browser's Garbage Collector to trigger, leading to sudden micro-stutters.

* **Mandatory Object Pooling:** * Do **NOT** use `new` keywords or instantiate/destroy jelly balls, particle effects, or floating score texts dynamically during gameplay.
    * Pre-allocate a fixed pool (e.g., 50 jelly balls, 200 particle instances) at scene boot. 
    * When a ball is annihilated via a "Zero Sum" reaction, disable it (`active = false`, `visible = false`) and return it to the pool. Recycle it for the next spawn.
* **Zero Allocation in the Game Loop:** * Do not create temporary objects, arrays, or vector definitions (e.g., `{x: ball.x, y: ball.y}`) inside the `update()` loop or collision handlers. Reuse global/static reference variables for mathematical calculations.

---

## 🧮 2. Matter.js (Physics Engine) Optimization
Soft-body physics can easily become CPU-heavy. The physics load must be kept strictly minimal.

* **Low Vertex Count for Soft-Bodies:** * To simulate the jelly/squishy effect without lagging the browser, the circular spring constraint grid for each ball must use a maximum of **8 to 12 vertices**.
    * Visual smoothness must be achieved via high-quality sprite textures mapped over the low-poly physics body, not by increasing physics complexity.
* **Strict Collision Filtering:**
    * Jelly balls must only calculate collisions with other jelly balls and the container walls.
    * UI layers, launchers, and background elements must be completely isolated from the physics world using Matter.js `Collision Groups` / `Filters`.
* **Fixed Time Step Integration:**
    * Do not bind the physics step (`Matter.Engine.update`) directly to the browser's variable frame rate or monitor refresh rate (e.g., 144Hz monitors).
    * Force a fixed time step locked precisely at **16.66ms (60 FPS)** to ensure identical physics simulation speed and predictable CPU loads across all devices.

---

## 🎨 3. Rendering & Visual Effects (GPU Optimization)
Ensuring neon aesthetics and explosion graphics utilize GPU power rather than choking the CPU.

* **Texture Atlas / Sprite Sheets:**
    * Pack all jelly ball skins, math symbols ($\times2$, $\div2$), and UI elements into a single compressed Texture Atlas.
    * This minimizes web requests and reduces the WebGL `Draw Call` count to 1, preventing render-induced lag.
* **Particle & Screen Shake Caps:**
    * Limit the neon explosion particles to **15-20 particles per annihilation**.
    * Ensure particle lifespans are short, and instantly recycle dead particles back into the Object Pool.
* **Forced WebGL Renderer:**
    * Configure Phaser 3 to explicitly prioritize and force `WebGL` rendering mode over Canvas. Let the GPU handle the heavy neon blending and alpha effects.

---

## 📈 4. Boundary & Exception Safety
* **Active Object Cap:** Due to the $\pm16$ game rule design (opposite values annihilating each other), the maximum number of active physics bodies on screen will naturally stay low (approx. 30-40 objects). 
* **Out-of-Bounds Watchdog:** Implement a strict boundary check in the update loop. If a physics object glitches through walls or spawns out of bounds, instantly catch it and force-return it to the pool.

---

## 🌐 5. Pure Canvas Execution (No DOM/CSS Heavy Animations)
* To prevent the critical "Recalculate Style" performance drops experienced in past projects, **DO NOT** use HTML/CSS loops, div layers, or CSS keyframe animations for gameplay elements (like background neon grids, floating particles, or starfields).
* Everything—including the background effects, neon glows, particle bursts, and gameplay UI—must be rendered **strictly inside the Phaser Canvas/WebGL context**. Keep the DOM clean; no HTML overlays floating above the game container during active gameplay.


---

---

## 📱 6. Cross-Platform & Mobile Optimization (Desktop & Mobile Chrome/Safari)
To ensure the game runs smoothly and fits perfectly on both desktop monitors and mobile web browsers, the developer must follow these cross-platform rules:

* **Smart Scaling & Letterboxing:** * Use Phaser's `Scale.FIT` mode to automatically scale the canvas. 
    * Do **NOT** use responsive HTML/CSS wrappers to handle scaling. The entire game area, including side-bars or margins (letterboxes), must be drawn inside the Phaser Canvas to avoid triggering layout updates.
* **Touch Input & Drag Optimizations:**
    * Use simple touch input listeners (`pointerdown`, `pointermove`, `pointerup`). 
    * Keep the launcher's movement light: restrict complex path-finding or grid calculations during the `pointermove` event. Dragging the ball left and right must be calculated with basic X-coordinate math.
* **Mobile Asset Capping & Resolution:**
    * High-resolution images slow down mobile memory. Keep texture resolutions capped at a reasonable size (standard 1x/2x sheets) and let WebGL handle the scaling.
    * Limit the number of simultaneously playing audio channels on mobile browsers to prevent CPU throttling via the HTML5 Web Audio API.
