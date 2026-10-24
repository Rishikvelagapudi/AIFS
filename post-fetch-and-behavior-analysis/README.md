# Post Fetch & Behavior Analysis Module — AIFS

**Multi-Camera Trajectory Reconstruction, Dwell Time & Kinematic Telemetry**

## Overview
Post Fetch & Behavior Analysis is Module 03 of the Artificial Intelligence Forensic System (AIFS). It allows investigators and command operators to query historical footage, reconstruct suspect movement trajectories across multiple cameras, and identify behavioral anomalies such as loitering, crowd surges, wrong-way transit, and unattended luggage.

## Core Capabilities
- **Post-Fetch Query Engine:** Multi-attribute database query filtering by target profile, timestamp window, camera zone, and anomaly class.
- **Synchronized Multi-Camera Trajectory Replay:** Step-by-step waypoint reconstruction mapping suspect transit across entrance gates, concourses, restricted vaults, and exit doors.
- **Behavior Anomaly Engine:**
  - *Restricted Dwell Time Violation:* Alerts on unauthorized stationary stay in restricted zones (e.g. Server Room Vault).
  - *Kinematic Acceleration Divergence:* Flags sudden speed spikes (walking to sprinting).
  - *Surveillance Gaze Evasion:* Tracks subjects deliberately turning away from camera optical centers.
  - *Stationary Object Persistence:* Flags abandoned bags or cargo left unattended.
- **Spatial Density & Heatmap Telemetry:** 2D normalized projection of foot-traffic congestion and anomaly concentration areas.
- **Dossier Export:** Export structured JSON telemetry and printable 1-page reports.

## File Structure
- `frontend/src/post-fetch-and-behavior-analysis/`
  - `PostFetchBehaviorAnalysis.jsx`: Main behavior analytics interface.
  - `index.js`: Public exports.
