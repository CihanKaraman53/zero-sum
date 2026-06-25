# 🚀 ZERO SUM DROP - TECHNICAL ARCHITECTURE & PERFORMANCE GUIDE

This document serves as the absolute blueprint for development. To avoid the lag, stutter, and rendering issues faced in past projects, the developer must strictly enforce these rules from day one using **TypeScript**, **Vite**, **Phaser 3**, and **Matter.js**.

---

## ⚙️ 1. Core Physics & Gameplay Mechanics
* **Jelly-Merge & Collapse:** Matching numbers merge into a larger number ($+2$ and $+2 \rightarrow +4$). Opposite matching numbers collapse into zero ($+4$ and $-4 \rightarrow 0$) via WebGL explosion particles.
* **Shrink Mechanic:** When opposite unequal numbers collide (e.g., $+8$ and $-4$), the smaller ball is destroyed, and the larger ball dynamically shrinks in size and changes value to $+4$.
* **The Absolute Cap:** Numbers cap at $\pm16$. Two matching $\pm16$ balls form a "King Ball" with a crown sprite and can only be cleared by a matching opposite $\pm16$.

---

## 🌌 2. Ultimate Combo: Chain Reaction Black Hole
* **The Vortex Trigger:** Executing a rapid chain of 3-4 consecutive "Zero Sum" destructions completely fills a Combo Bar and spawns a miniature neon vortex at the grid's center for **3 seconds**.
* **Suika-Jelly Pull:** The Black Hole exerts a radial gravitational pull forcing all active low-poly soft bodies to stretch, deform, and slide into the center using Matter.js constraint physics.
* **Cosmic Clear:** Any conflicting numbers sucked into the vortex automatically neutralize each other. At 3 seconds, the hole detonates, shooting out massive particle bursts and an outward physics shockwave.

---

## 🚨 3. "Juiciness" & Panic Mode Mechanics (The Polish)
* **Silly Animated Eyes:** Every jelly ball must have tiny, playful cartoon eyes mapped onto its texture. The eyes must procedurally look toward the direction the ball is rolling, squeezing, or being pulled into the Black Hole.
* **Dynamic Combo Text:** Successful merges must trigger scaling neon texts flying across the WebGL canvas (e.g., *"SMASH!"*, *"ZERO SUM!"*, *"COSMIC CLEAR!"*).
* **Panic State Trigger:** When jelly balls approach the top "Game Over" threshold, the ambient soundtrack pitch/tempo must accelerate immediately. The overlapping balls must flash neon red, triggering a visual 3-second countdown timer before triggering the Game Over scene.

---

## 🗺️ 4. Modular Level Generation Structure
The level schema must be built via a modular JSON system supporting 3 main archetypes:
* **Score Attack:** Clean tray, reach target points before hitting the limit line.
* **Fusion Goal:** Merge sub-numbers to successfully create a single target value (e.g., Target $+16$).
* **Board Clear:** Starts with frozen, static shapes blockaded at the bottom. Spawner drops *only* negative values or divide ($\div2$) items to melt the arena clean.
* **Hazards & Traps:** Support for internal spinning paddles, horizontal neon wind fans, magnetic walls pulling specific signs ($+/-$), and rising floor-acid.
* **Ball Flags:** Ability to flag balls as *Chained* (immobile until merged next to), *Bubbled* (floating up until popped), or *Ghost* (value hidden instantly upon landing).

---

## 🛑 5. Performance, Memory, & Anti-Lag Restrictions
* **Mandatory Object Pooling:** Absolutely **NO** dynamic object creation (`new` keywords) or direct destruction of jelly balls, particle instances, or pop-up texts during mid-gameplay loops. Pre-allocate a closed cache (e.g., 50 balls, 200 particles) at scene initialization.
* **Low Poly Soft-Bodies:** Keep the spring/constraint vertex count for the circular soft-bodies strictly restricted between **8 to 12 vertices** per ball. Rely on smart, elastic sprite texture-mapping for visual smoothness.
* **Forced WebGL & Single Draw Call:** Lock Phaser 3 to WebGL render rendering mode. Combine all ball skins, math fonts, and UI assets into a single compressed Texture Atlas / Sprite Sheet.
* **Pure Canvas Execution (No DOM/CSS Interferences):** To eliminate browser *Recalculate Style* frames, do **NOT** use HTML wrapper `div` blocks, CSS keyframes, or layout animation loops for game components. Arka plan grids, particles, and gameplay menus must live **entirely inside the Phaser Canvas**.
* **Fixed Time Step:** Do not bind the physics tick to variable monitor refresh rates (e.g., 144Hz). Hard-lock `Matter.Engine.update` to a predictable, fixed **16.66ms (60 FPS)** clock.
* **Cross-Platform Responsive Scale:** Handle mobile/desktop resizing via Phaser's built-in `Scale.FIT` wrapper inside the canvas context. Do not run heavy touch calculators over mobile `pointermove` triggers.