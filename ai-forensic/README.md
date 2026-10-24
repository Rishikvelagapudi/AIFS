# AI Forensic Module — AIFS

**AI Forensic Laboratory: Deepfake, Media Tamper & Biometric Verification Suite**

## Overview
The AI Forensic Laboratory is Module 02 of the Artificial Intelligence Forensic System (AIFS). It provides rigorous neural and statistical evidence verification to identify synthetic media manipulations, face swaps, voice clones, and video splicing before evidence is presented to command operators or legal authorities.

## Core Capabilities
- **Neural Deepfake Scanner:** Multi-layer inspection utilizing MesoNet and spatial-frequency convolutional networks.
- **Facial Landmark & Mesh Analysis:** 68-point facial geometry tracking, eye blink periodicity, pupil reflection symmetry, and synthetic skin blending artifacts.
- **Audio Spectrogram & Voiceprint Analysis:** High-frequency vocoder distortion detection (>14kHz), phase discontinuity analysis, and text-to-speech footprint scoring.
- **Frame-Level Error Level Analysis (ELA):** Pixel quantization residual analysis exposing modified boundaries and inserted plates.
- **Cryptographic Chain of Custody:** SHA-256 evidence hashing, immutable audit logging, and digital timestamp verification.
- **Forensic Export:** JSON and 1-page printable legal forensic certificates.

## File Structure
- `frontend/src/ai-forensic/`
  - `AiForensic.jsx`: Comprehensive forensic workbench component.
  - `index.js`: Public exports.
