export const CCTV_CHANNELS = [
  { id: "CAM-01", name: "Main Entrance North", zone: "Zone A - Gate 1", fps: "30.0", res: "1080p" },
  { id: "CAM-02", name: "Corridor East Wing", zone: "Zone B - Concourse", fps: "25.0", res: "1080p" },
  { id: "CAM-03", name: "Perimeter West Fence", zone: "Zone C - Outer Yard", fps: "30.0", res: "1080p" },
  { id: "CAM-04", name: "Lobby & Reception", zone: "Zone A - Atrium", fps: "30.0", res: "1080p" },
  { id: "CAM-05", name: "Server Room Vault", zone: "Zone D - Restricted", fps: "24.0", res: "1080p" },
  { id: "CAM-06", name: "Basement Parking B2", zone: "Zone E - Parking", fps: "30.0", res: "1080p" },
  { id: "CAM-07", name: "Emergency Exit South", zone: "Zone B - Stairwell", fps: "25.0", res: "1080p" },
  { id: "CAM-08", name: "Loading Bay Dock 3", zone: "Zone F - Logistics", fps: "30.0", res: "1080p" },
  { id: "CAM-09", name: "Rooftop Helipad & HVAC", zone: "Zone G - Helipad", fps: "30.0", res: "1080p" },
];

export const STATUS_LABEL = {
  awaiting_verification: "Awaiting verification",
  verified: "Verified",
  rejected: "Rejected",
  resolved: "Resolved",
};

export const OPEN_STATUSES = ["awaiting_verification", "verified"];
