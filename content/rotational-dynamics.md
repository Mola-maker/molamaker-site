---
title: Rotational dynamics — notes from the physics rabbit hole
date: 2026-03-10
excerpt: Angular momentum, moment of inertia tensors, and why spinning things are surprisingly hard.
read_time: 5
---

I started reading about rotational dynamics because a GPU kernel involved coordinate transforms. I stayed because the math is beautiful and deeply unintuitive.

**What spins isn't what you think.** A rigid body rotating about an axis doesn't just "spin around that axis." The angular momentum vector points in a different direction than the angular velocity vector — unless you're rotating about a principal axis. The moment of inertia is a tensor, not a scalar, and it transforms with the body's orientation.

**The intermediate axis theorem.** Spin a tennis racket about the axis through the handle (long axis) — stable. Spin it about the axis perpendicular to the strings (short axis) — stable. Spin it about the intermediate axis (through the side of the head) — it flips. Every rotation. No amount of careful throwing fixes it. The Dzhanibekov effect, verified on the ISS: a spinning wingnut flips periodically. The intermediate axis is unstable because the moments of inertia create a saddle point in the phase space.

**Why this matters for computing.** Quaternion slerp for smooth camera rotations, rigid body simulation for physics engines, and orientation estimation from IMU data all depend on understanding rotational dynamics. A naive Euler-angle interpolation drifts; a quaternion slerp stays on the unit sphere. But the deeper truth: you can't understand quaternions unless you understand the rotation group SO(3), and you can't understand SO(3) unless you understand why spinning things resist being tipped.

The GPU kernel I was debugging turned out to be fine. I'd made an error in the coordinate transform — a 90-degree rotation that should have been -90. But the rabbit hole was worth it.
