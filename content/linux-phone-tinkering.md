---
title: Running rootless Linux environments on phones I shouldn't be tinkering with
date: 2026-04-22
excerpt: Termux, proot, and the quiet joy of running a full Linux userspace in your pocket.
read_time: 4
---

It started with "can I run Python on my phone" and ended with a full Debian userspace, a working gcc toolchain, and a vague sense that I'd violated the device warranty at least three times.

**The stack.** Termux provides the terminal and package manager. Proot gives us a fake root filesystem — no actual root required, just chroot-like namespace tricks. Together they let you run a nearly complete Linux environment without unlocking the bootloader.

**What works.**
- Python, NumPy (compiled from source, took 45 minutes on a phone CPU)
- Git, SSH, tmux — the essentials
- gcc and clang for small C programs
- A full Emacs installation (yes, I'm that kind of person)

**What doesn't.**
- CUDA (no GPU access, obviously)
- Docker (requires kernel features phones don't expose)
- Anything needing systemd (proot doesn't support it)
- Smooth scrolling in graphical apps (no hardware acceleration)

**Why bother.** It's not practical. A laptop is better at literally everything a phone can do with Linux. But there's something satisfying about having a full development environment in your pocket, always ready. And the constraint forces you to understand the system — when `pip install` fails because the phone CPU is missing a vector instruction, you learn what that instruction does.

Also: compiling NumPy on a phone is a surprisingly effective way to clear your mind between challenging tasks. Nothing like watching a phone CPU slowly optimize array operations to make you appreciate your workstation.
