# 🗺️ ZERO SUM DROP - LEVELS & ADVANCED MECHANICS GUIDE

This document defines the structural rules for level generation, environmental hazards, ball modifiers, and the ultimate combo mechanic: the **Chain Reaction Black Hole**. The developer must implement these features using a modular JSON-ready structure.

---

## 🌌 1. Ultimate Combo: Chain Reaction Black Hole
This is the core "hype" mechanic designed to maximize visual juice and reward skillful play.

* **Trigger Condition:** Every "Zero Sum" annihilation fills a Combo Bar. Executing a rapid sequence of 3-4 consecutive annihilations (Chain Combo) triggers the Black Hole.
* **Physics Behavior:** A tiny, neon-colored vortex spawns at the geometric center of the active jelly balls for **3 seconds**. It applies a radial gravity pull (`Matter.Constraint` or directional force) drawing all nearby balls toward its center.
* **Annihilation & Shockwave:** Any opposite values that touch inside the vortex instantly collapse into 0. After 3 seconds, the Black Hole explodes, pushing surviving balls outward with a heavy physics impulse and a massive WebGL neon particle burst.

---

## 🎯 2. Level Win Conditions (3 Core Types)
Every level config must choose one of these templates:

* **Score Attack:** The grid starts empty. The player drops random numbers to merge and annihilate, aiming to hit a Target Score before reaching the Game Over threshold.
* **Fusion Goal:** A specific target number lights up on the UI (e.g., `"Target: +16"`). The player wins instantly upon merging and creating that exact jelly ball.
* **Board Clear:** The level starts with static, frozen (physics-disabled) jelly blocks at the bottom. The spawner dispenses *only negative numbers* or *divide ($\div2$) modifiers*. The goal is to melt and clear the entire board.

---

## 🚧 3. Environmental Hazards & Obstacles
Dynamic elements placed inside the grid container to alter the paths of falling shapes:

* **The Rising Acid:** Neon fluid rises slowly from the floor, melting any jelly ball it touches. It creates an intense time-attack scenario by shrinking the playable area.
* **Magnetic Edges:** The left wall pulls positive ($+$) balls, and the right wall pulls negative ($-$) balls, distorting standard drop trajectories.
* **Wind Fans:** Invisible wind zones that push floating items horizontally (visualized via soft neon air currents).
* **Spinning Paddles:** Constantly rotating paddles in the center that redirect dropping pieces on impact.

---

## 🛡️ 4. Ball Modifiers (Special Statuses)
* **Chained Balls:** Static blocks locked by heavy chains that ignore standard gravity. Players must merge matching numbers next to them to break the chains and unlock their physics.
* **Bubbled Numbers:** Floating units trapped in bubbles drifting upward. Players must hit them with a heavy dropped ball to pop the bubble and release the number into the tray.
* **Ghost Balls:** Hidden items whose values vanish the split second they land in the container. Players must memorize whether the ball was positive or negative.

---

## 📈 5. Level Progression & Difficulty Balance
* **Levels 1 - 5 (Orientation):** Spawns only $\pm2$ and $\pm4$ units. No obstacles. Purely for learning basic physics and match-rules.
* **Levels 6 - 15 (Intermediate):** Introduces direct $\pm8$ spawns. Static obstacles, blocks, and spinning paddles appear.
* **Levels 16 - 30+ (Mastery):** Introduces $\times2$ and $\div2$ power-ups. The drop balance shifts tightly (%70 positive, rare negatives). Rising acid, move limits, and chained hazards become active.