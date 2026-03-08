import { useState, useEffect } from "react";
import * as math from "mathjs";

// ─── Utilities ────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

const defaultUnits = [
  { id: "lf", label: "Linear Feet", abbr: "LF" },
  { id: "sf", label: "Square Feet", abbr: "SF" },
  { id: "ea", label: "Each", abbr: "EA" },
  { id: "cy", label: "Cubic Yards", abbr: "CY" },
  { id: "ton", label: "Tons", abbr: "TON" },
  { id: "bag", label: "Bags", abbr: "BAG" },
  { id: "in", label: "Inches", abbr: "IN" },
  { id: "ft", label: "Feet", abbr: "FT" },
];

// ─── Section Library ──────────────────────────────────────────────────────────

function makeSection(name, description, takeoffInputs, materials) {
  return {
    id: uid(),
    name,
    description,
    takeoffInputs: takeoffInputs.map(t => ({ ...t, value: t.defaultValue ?? 0 })),
    primaryInputId: takeoffInputs[0]?.id,
    materials: materials.map(m => ({ id: uid(), wasteFactor: 1.0, notes: "", ...m })),
  };
}

const SECTION_LIBRARY = [
  {
    category: "Demolition",
    label: "General Demolition",
    fn: () => makeSection(
      "General Demolition", "Dumpster loads from demo area and material weight",
      [
        { id: "demo_sf", name: "Demo Area", unitId: "sf", defaultValue: 0 },
        { id: "debris_factor", name: "Debris Factor (1=light, 3=heavy)", unitId: "ea", defaultValue: 1.5 },
      ],
      [
        { name: "Dumpster (10 yd³)", formula: "ceil(demo_sf * debris_factor / 270)", unit: "EA", pricePerUnit: 450, wasteFactor: 1.0, notes: "10 yd³ ≈ 270 SF @ 1\" debris depth" },
        { name: "Labor Hours", formula: "ceil(demo_sf * debris_factor / 50)", unit: "HR", pricePerUnit: 65, wasteFactor: 1.0, notes: "~50 SF/hr for light demo" },
        { name: "Disposal Fee", formula: "ceil(demo_sf * debris_factor / 270)", unit: "EA", pricePerUnit: 75, wasteFactor: 1.0, notes: "Landfill tipping fee per load" },
      ]
    ),
  },
  {
    category: "Framing",
    label: "Wall Framing (2×4, 16\" OC)",
    fn: () => makeSection(
      "Wall Framing (2×4)", "Standard interior stud walls, 16\" on center",
      [
        { id: "wall_lf", name: "Wall Length", unitId: "lf", defaultValue: 0 },
        { id: "wall_height", name: "Wall Height", unitId: "ft", defaultValue: 8 },
      ],
      [
        { name: "2×4 Studs", formula: "ceil(wall_lf / 1.33 * (wall_height / 8)) + ceil(wall_lf / 8)", unit: "EA", pricePerUnit: 5.25, wasteFactor: 1.1, notes: "16\" OC + extra for corners/tees" },
        { name: "2×4 Plates (3× per wall run)", formula: "ceil(wall_lf * 3 / 8)", unit: "EA", pricePerUnit: 4.75, wasteFactor: 1.05, notes: "Double top plate + single bottom" },
        { name: "2×4 Blocking (mid-height)", formula: "ceil(wall_lf / 8)", unit: "EA", pricePerUnit: 4.75, wasteFactor: 1.05, notes: "Fire blocking" },
        { name: "Framing Nails 16d (1lb box)", formula: "ceil(wall_lf / 100)", unit: "BOX", pricePerUnit: 14, wasteFactor: 1.0 },
        { name: "Construction Adhesive", formula: "ceil(wall_lf / 60)", unit: "TUBE", pricePerUnit: 5.5, wasteFactor: 1.0, notes: "Bottom plate to slab" },
      ]
    ),
  },
  {
    category: "Framing",
    label: "Wall Framing (2×6, 16\" OC)",
    fn: () => makeSection(
      "Wall Framing (2×6)", "Exterior or insulated stud walls",
      [
        { id: "wall_lf", name: "Wall Length", unitId: "lf", defaultValue: 0 },
        { id: "wall_height", name: "Wall Height", unitId: "ft", defaultValue: 9 },
      ],
      [
        { name: "2×6 Studs", formula: "ceil(wall_lf / 1.33 * (wall_height / 8)) + ceil(wall_lf / 8)", unit: "EA", pricePerUnit: 9.5, wasteFactor: 1.1 },
        { name: "2×6 Plates (3×)", formula: "ceil(wall_lf * 3 / 8)", unit: "EA", pricePerUnit: 8.5, wasteFactor: 1.05 },
        { name: "Framing Nails 16d", formula: "ceil(wall_lf / 80)", unit: "BOX", pricePerUnit: 16, wasteFactor: 1.0 },
      ]
    ),
  },
  {
    category: "Framing",
    label: "Doors & Windows (Rough Framing)",
    fn: () => makeSection(
      "Door & Window Rough Framing", "Headers, trimmers, kings, sills per opening",
      [
        { id: "door_ea", name: "Door Openings", unitId: "ea", defaultValue: 0 },
        { id: "window_ea", name: "Window Openings", unitId: "ea", defaultValue: 0 },
      ],
      [
        { name: "2× Header Stock — Doors", formula: "door_ea * 2", unit: "EA", pricePerUnit: 14, wasteFactor: 1.05, notes: "Doubled 2×10 per door" },
        { name: "2× Header Stock — Windows", formula: "window_ea * 2", unit: "EA", pricePerUnit: 12, wasteFactor: 1.05, notes: "Doubled 2×8 per window" },
        { name: "Trimmer Studs", formula: "(door_ea + window_ea) * 2", unit: "EA", pricePerUnit: 5.25, wasteFactor: 1.05 },
        { name: "King Studs", formula: "(door_ea + window_ea) * 2", unit: "EA", pricePerUnit: 5.25, wasteFactor: 1.05 },
        { name: "Cripple Studs", formula: "ceil((door_ea + window_ea) * 3)", unit: "EA", pricePerUnit: 4.75, wasteFactor: 1.1 },
        { name: "Window Sill Plates", formula: "window_ea * 2", unit: "EA", pricePerUnit: 4.75, wasteFactor: 1.05, notes: "Doubled sill" },
      ]
    ),
  },
  {
    category: "Insulation",
    label: "Wall Batt Insulation (R-13 / R-19)",
    fn: () => makeSection(
      "Wall Batt Insulation", "Fiberglass batts for stud cavities",
      [
        { id: "wall_lf", name: "Wall Length", unitId: "lf", defaultValue: 0 },
        { id: "wall_height", name: "Wall Height", unitId: "ft", defaultValue: 8 },
      ],
      [
        { name: "R-13 Batts (2×4 walls, ~40 SF/bag)", formula: "ceil(wall_lf * wall_height / 40)", unit: "BAG", pricePerUnit: 52, wasteFactor: 1.05 },
        { name: "R-19 Batts (2×6 walls, ~40 SF/bag)", formula: "ceil(wall_lf * wall_height / 40)", unit: "BAG", pricePerUnit: 68, wasteFactor: 1.05 },
        { name: "Vapor Barrier 6mil poly (500 SF/roll)", formula: "ceil(wall_lf * wall_height / 500)", unit: "ROLL", pricePerUnit: 85, wasteFactor: 1.1 },
      ]
    ),
  },
  {
    category: "Insulation",
    label: "Ceiling Insulation (R-38)",
    fn: () => makeSection(
      "Ceiling Insulation", "Blown or batt insulation for ceilings",
      [
        { id: "ceil_sf", name: "Ceiling Area", unitId: "sf", defaultValue: 0 },
      ],
      [
        { name: "R-38 Batts (64 SF/bag)", formula: "ceil(ceil_sf / 64)", unit: "BAG", pricePerUnit: 95, wasteFactor: 1.05 },
        { name: "Blown Insulation R-38 (40 SF/bag)", formula: "ceil(ceil_sf / 40)", unit: "BAG", pricePerUnit: 22, wasteFactor: 1.05 },
      ]
    ),
  },
  {
    category: "Drywall",
    label: "Drywall (Walls + Ceiling)",
    fn: () => makeSection(
      "Drywall", "Sheets, screws, tape, compound, and bead",
      [
        { id: "wall_sf", name: "Wall Area", unitId: "sf", defaultValue: 0 },
        { id: "ceil_sf", name: "Ceiling Area", unitId: "sf", defaultValue: 0 },
      ],
      [
        { name: "Drywall 4×8 — Walls", formula: "ceil(wall_sf / 32)", unit: "EA", pricePerUnit: 14.5, wasteFactor: 1.1, notes: "32 SF per sheet" },
        { name: "Drywall 4×8 — Ceiling", formula: "ceil(ceil_sf / 32)", unit: "EA", pricePerUnit: 14.5, wasteFactor: 1.1 },
        { name: "Drywall Screws (5lb box)", formula: "ceil((wall_sf + ceil_sf) / 500)", unit: "BOX", pricePerUnit: 12, wasteFactor: 1.0 },
        { name: "Joint Compound (5gal bucket)", formula: "ceil((wall_sf + ceil_sf) / 400)", unit: "EA", pricePerUnit: 24, wasteFactor: 1.15 },
        { name: "Drywall Tape (500ft roll)", formula: "ceil((wall_sf + ceil_sf) / 200)", unit: "ROLL", pricePerUnit: 8, wasteFactor: 1.1 },
        { name: "Corner Bead (8ft)", formula: "ceil(wall_sf / 64)", unit: "EA", pricePerUnit: 2.5, wasteFactor: 1.1 },
        { name: "Primer / Sealer (gallon)", formula: "ceil((wall_sf + ceil_sf) / 400)", unit: "GAL", pricePerUnit: 18, wasteFactor: 1.0 },
      ]
    ),
  },
  {
    category: "Painting",
    label: "Interior Painting",
    fn: () => makeSection(
      "Interior Painting", "Walls, ceiling, trim, and doors",
      [
        { id: "wall_sf", name: "Paintable Wall Area", unitId: "sf", defaultValue: 0 },
        { id: "ceil_sf", name: "Ceiling Area", unitId: "sf", defaultValue: 0 },
        { id: "trim_lf", name: "Trim Linear Feet", unitId: "lf", defaultValue: 0 },
        { id: "door_ea", name: "Doors (both sides)", unitId: "ea", defaultValue: 0 },
      ],
      [
        { name: "Wall Paint (gallon, 2 coats)", formula: "ceil(wall_sf * 2 / 350)", unit: "GAL", pricePerUnit: 45, wasteFactor: 1.05, notes: "350 SF/gal per coat" },
        { name: "Ceiling Paint (gallon, 2 coats)", formula: "ceil(ceil_sf * 2 / 400)", unit: "GAL", pricePerUnit: 38, wasteFactor: 1.05 },
        { name: "Trim Paint (quart)", formula: "ceil(trim_lf / 200)", unit: "QT", pricePerUnit: 22, wasteFactor: 1.1 },
        { name: "Door Paint (quart)", formula: "ceil(door_ea / 4)", unit: "QT", pricePerUnit: 22, wasteFactor: 1.05, notes: "1 qt covers ~4 doors" },
        { name: "Painter's Tape (60yd roll)", formula: "ceil((trim_lf + door_ea * 20) / 180)", unit: "ROLL", pricePerUnit: 8, wasteFactor: 1.0 },
        { name: "Drop Cloths", formula: "ceil(ceil_sf / 400)", unit: "EA", pricePerUnit: 12, wasteFactor: 1.0 },
        { name: "Roller Covers", formula: "ceil((wall_sf + ceil_sf) / 800)", unit: "EA", pricePerUnit: 5, wasteFactor: 1.0 },
      ]
    ),
  },
  {
    category: "Flooring",
    label: "LVP / Laminate Flooring",
    fn: () => makeSection(
      "LVP / Laminate Flooring", "Luxury vinyl plank or laminate",
      [
        { id: "floor_sf", name: "Floor Area", unitId: "sf", defaultValue: 0 },
      ],
      [
        { name: "LVP Planks (20 SF/carton)", formula: "ceil(floor_sf / 20)", unit: "CARTON", pricePerUnit: 55, wasteFactor: 1.1, notes: "10% waste for cuts" },
        { name: "Underlayment (100 SF/roll)", formula: "ceil(floor_sf / 100)", unit: "ROLL", pricePerUnit: 28, wasteFactor: 1.05 },
        { name: "Transition Strips", formula: "ceil(floor_sf / 200)", unit: "EA", pricePerUnit: 18, wasteFactor: 1.0 },
        { name: "Floor Leveler (50lb bag, 50 SF)", formula: "ceil(floor_sf / 50)", unit: "BAG", pricePerUnit: 22, wasteFactor: 1.0, notes: "Only if subfloor needs leveling" },
      ]
    ),
  },
  {
    category: "Flooring",
    label: "Hardwood Flooring",
    fn: () => makeSection(
      "Hardwood Flooring", "Solid or engineered hardwood strips",
      [
        { id: "floor_sf", name: "Floor Area", unitId: "sf", defaultValue: 0 },
      ],
      [
        { name: "Hardwood (25 SF/bundle)", formula: "ceil(floor_sf / 25)", unit: "BUNDLE", pricePerUnit: 95, wasteFactor: 1.12, notes: "12% waste for angles & end cuts" },
        { name: "Rosin Paper (500 SF/roll)", formula: "ceil(floor_sf / 500)", unit: "ROLL", pricePerUnit: 25, wasteFactor: 1.05 },
        { name: "Cleats/Staples (5000/box)", formula: "ceil(floor_sf / 250)", unit: "BOX", pricePerUnit: 18, wasteFactor: 1.0 },
        { name: "Wood Filler (quart)", formula: "ceil(floor_sf / 500)", unit: "QT", pricePerUnit: 14, wasteFactor: 1.0 },
        { name: "Baseboard 1×4 (8ft)", formula: "ceil(floor_sf / 12)", unit: "EA", pricePerUnit: 6, wasteFactor: 1.15, notes: "Perimeter estimate from area" },
      ]
    ),
  },
  {
    category: "Tiling",
    label: "Floor or Wall Tile",
    fn: () => makeSection(
      "Tile Installation", "Tile, thinset, grout — quantity varies by tile size",
      [
        { id: "tile_sf", name: "Tile Area", unitId: "sf", defaultValue: 0 },
        { id: "tile_size", name: "Tile Size (inches square, e.g. 12)", unitId: "in", defaultValue: 12 },
        { id: "grout_joint", name: "Grout Joint Width (inches, e.g. 0.125)", unitId: "in", defaultValue: 0.125 },
      ],
      [
        { name: "Tiles", formula: "ceil(tile_sf / ((tile_size / 12) ^ 2))", unit: "EA", pricePerUnit: 3.5, wasteFactor: 1.1, notes: "10% overage for cuts" },
        { name: "Thinset Mortar 50lb (40 SF/bag)", formula: "ceil(tile_sf / 40)", unit: "BAG", pricePerUnit: 18, wasteFactor: 1.05, notes: "3/8\" V-notch trowel" },
        { name: "Grout 10lb", formula: "ceil(tile_sf * grout_joint * 0.3 / 10)", unit: "BAG", pricePerUnit: 14, wasteFactor: 1.1, notes: "Coverage varies by joint width" },
        { name: "Tile Spacers (100/pack)", formula: "ceil(tile_sf * 4 / 100)", unit: "PACK", pricePerUnit: 4.5, wasteFactor: 1.0 },
        { name: "Grout Sealer (quart)", formula: "ceil(tile_sf / 150)", unit: "QT", pricePerUnit: 18, wasteFactor: 1.0 },
        { name: "Cement Backer Board 3×5", formula: "ceil(tile_sf / 15)", unit: "EA", pricePerUnit: 14, wasteFactor: 1.1, notes: "For tile over wood subfloor" },
      ]
    ),
  },
  {
    category: "Masonry",
    label: "Mortar & Masonry (Trowel-Applied)",
    fn: () => makeSection(
      "Mortar & Masonry", "Mortar bags based on area and trowel notch depth",
      [
        { id: "mason_sf", name: "Masonry Area", unitId: "sf", defaultValue: 0 },
        { id: "trowel_depth", name: "Trowel Notch Depth (inches)", unitId: "in", defaultValue: 0.375 },
      ],
      [
        { name: "Mortar Mix 60lb", formula: "ceil(mason_sf * trowel_depth * 0.083 * 0.6 / 0.45)", unit: "BAG", pricePerUnit: 12, wasteFactor: 1.1, notes: "Notch volume × compaction factor" },
        { name: "Mason Sand (50lb bag)", formula: "ceil(mason_sf / 25)", unit: "BAG", pricePerUnit: 7, wasteFactor: 1.05 },
        { name: "Bonding Adhesive (gallon)", formula: "ceil(mason_sf / 200)", unit: "GAL", pricePerUnit: 28, wasteFactor: 1.0 },
        { name: "Pointing Compound", formula: "ceil(mason_sf / 100)", unit: "BAG", pricePerUnit: 16, wasteFactor: 1.1 },
      ]
    ),
  },
  {
    category: "Trimwork",
    label: "Interior Trimwork",
    fn: () => makeSection(
      "Interior Trimwork", "Baseboard, crown, door and window casing",
      [
        { id: "base_lf", name: "Baseboard Length", unitId: "lf", defaultValue: 0 },
        { id: "crown_lf", name: "Crown Molding Length", unitId: "lf", defaultValue: 0 },
        { id: "door_ea", name: "Door Openings (to case)", unitId: "ea", defaultValue: 0 },
        { id: "window_ea", name: "Window Openings (to case)", unitId: "ea", defaultValue: 0 },
      ],
      [
        { name: "Baseboard (8ft sticks)", formula: "ceil(base_lf / 8)", unit: "EA", pricePerUnit: 8, wasteFactor: 1.15, notes: "15% miter waste" },
        { name: "Crown Molding (8ft sticks)", formula: "ceil(crown_lf / 8)", unit: "EA", pricePerUnit: 14, wasteFactor: 1.2, notes: "20% waste for corners" },
        { name: "Door Casing Sets", formula: "door_ea", unit: "SET", pricePerUnit: 28, wasteFactor: 1.1 },
        { name: "Window Casing (8ft sticks)", formula: "ceil(window_ea * 14 / 8)", unit: "EA", pricePerUnit: 10, wasteFactor: 1.15, notes: "~14 LF per window" },
        { name: "Base Shoe / Quarter Round (8ft)", formula: "ceil(base_lf / 8)", unit: "EA", pricePerUnit: 4.5, wasteFactor: 1.15 },
        { name: "Finish Nails 18ga (1000/box)", formula: "ceil((base_lf + crown_lf) / 200)", unit: "BOX", pricePerUnit: 12, wasteFactor: 1.0 },
        { name: "Paintable Caulk", formula: "ceil((base_lf + crown_lf) / 300)", unit: "TUBE", pricePerUnit: 6, wasteFactor: 1.0 },
      ]
    ),
  },
  {
    category: "Cabinetry",
    label: "Kitchen Cabinetry",
    fn: () => makeSection(
      "Kitchen Cabinetry", "Base/upper cabinets and countertop from linear footage",
      [
        { id: "base_lf", name: "Base Cabinet Run", unitId: "lf", defaultValue: 0 },
        { id: "upper_lf", name: "Upper Cabinet Run", unitId: "lf", defaultValue: 0 },
      ],
      [
        { name: "Base Cabinets", formula: "ceil(base_lf)", unit: "EA", pricePerUnit: 250, wasteFactor: 1.0, notes: "1 cabinet per LF (avg 12–24\" widths)" },
        { name: "Upper Cabinets", formula: "ceil(upper_lf)", unit: "EA", pricePerUnit: 180, wasteFactor: 1.0 },
        { name: "Filler Strips", formula: "ceil((base_lf + upper_lf) / 8)", unit: "EA", pricePerUnit: 35, wasteFactor: 1.0 },
        { name: "Countertop (25\" depth laminate)", formula: "ceil(base_lf * 1.1)", unit: "LF", pricePerUnit: 65, wasteFactor: 1.05, notes: "10% for returns and overhang" },
        { name: "Cabinet Hardware (pulls)", formula: "ceil((base_lf + upper_lf) * 2)", unit: "EA", pricePerUnit: 8, wasteFactor: 1.0 },
      ]
    ),
  },
  {
    category: "Specialty Finishes",
    label: "Venetian Plaster / Skim Coat",
    fn: () => makeSection(
      "Venetian Plaster / Skim Coat", "Multi-coat decorative plaster finish",
      [
        { id: "plaster_sf", name: "Surface Area", unitId: "sf", defaultValue: 0 },
        { id: "coat_count", name: "Number of Coats", unitId: "ea", defaultValue: 2 },
      ],
      [
        { name: "Venetian Plaster (gallon)", formula: "ceil(plaster_sf * coat_count / 100)", unit: "GAL", pricePerUnit: 55, wasteFactor: 1.1, notes: "~100 SF/gal per coat" },
        { name: "Primer / Sealer (gallon)", formula: "ceil(plaster_sf / 300)", unit: "GAL", pricePerUnit: 22, wasteFactor: 1.0 },
        { name: "Polishing Wax (quart)", formula: "ceil(plaster_sf / 200)", unit: "QT", pricePerUnit: 28, wasteFactor: 1.0 },
        { name: "Taping Knife / Tool Set", formula: "1", unit: "SET", pricePerUnit: 45, wasteFactor: 1.0 },
      ]
    ),
  },
  {
    category: "Specialty Finishes",
    label: "Acoustic Ceiling Tiles (Drop Grid)",
    fn: () => makeSection(
      "Acoustic Ceiling Tiles", "T-bar grid system with 2×2 or 2×4 tiles",
      [
        { id: "ceil_sf", name: "Ceiling Area", unitId: "sf", defaultValue: 0 },
        { id: "tile_size", name: "Tile Size (2 = 2×2, 4 = 2×4)", unitId: "ea", defaultValue: 4 },
      ],
      [
        { name: "Ceiling Tiles", formula: "ceil(ceil_sf / if(tile_size == 4, 8, 4))", unit: "EA", pricePerUnit: 8, wasteFactor: 1.1, notes: "2×4 = 8 SF each; 2×2 = 4 SF each" },
        { name: "Main Tees (12ft)", formula: "ceil(ceil_sf / 48)", unit: "EA", pricePerUnit: 9, wasteFactor: 1.1 },
        { name: "Cross Tees (4ft)", formula: "ceil(ceil_sf / 16)", unit: "EA", pricePerUnit: 3.5, wasteFactor: 1.1 },
        { name: "Wall Angle (12ft)", formula: "ceil(sqrt(ceil_sf) * 4 / 12)", unit: "EA", pricePerUnit: 6, wasteFactor: 1.15, notes: "Perimeter estimate" },
        { name: "Hanger Wire (roll)", formula: "ceil(ceil_sf / 64)", unit: "EA", pricePerUnit: 12, wasteFactor: 1.0 },
      ]
    ),
  },

  // ── METAL BULKHEADS ──────────────────────────────────────────────────────────

  {
    category: "Metal Framing / Bulkheads",
    label: "Floating Bulkhead (All Sides Open)",
    fn: () => makeSection(
      "Floating Bulkhead", "Metal stud bulkhead suspended from ceiling — all 4 sides exposed",
      [
        { id: "bh_length", name: "Bulkhead Length", unitId: "lf", defaultValue: 0 },
        { id: "bh_width", name: "Bulkhead Width (depth)", unitId: "in", defaultValue: 12 },
        { id: "bh_drop", name: "Bulkhead Drop (face height)", unitId: "in", defaultValue: 12 },
      ],
      [
        {
          name: "25ga Metal Track (10ft sticks)",
          formula: "ceil(((bh_length * 2 + (bh_width / 12) * 2) * 2) / 10)",
          unit: "EA", pricePerUnit: 8.5, wasteFactor: 1.1,
          notes: "Top + bottom track on all 4 faces",
        },
        {
          name: "25ga Metal Studs — Faces (8ft)",
          formula: "ceil(bh_length / 1.33) * 2 + ceil((bh_width / 12) / 1.33) * 2",
          unit: "EA", pricePerUnit: 6, wasteFactor: 1.1,
          notes: "16\" OC on both long faces + 2 end caps each",
        },
        {
          name: "Threaded Rod 3/8\" (10ft)",
          formula: "ceil(bh_length / 4)",
          unit: "EA", pricePerUnit: 12, wasteFactor: 1.0,
          notes: "Positive hanger rod from deck every 4ft",
        },
        {
          name: "Hanger Wire (50ft roll)",
          formula: "ceil(bh_length * 2 / 50)",
          unit: "ROLL", pricePerUnit: 18, wasteFactor: 1.0,
          notes: "Wire ties to rod hangers",
        },
        {
          name: "Drywall 4×8 — Long Faces (×2)",
          formula: "ceil((bh_length * (bh_drop / 12) * 2) / 32)",
          unit: "EA", pricePerUnit: 14.5, wasteFactor: 1.15,
          notes: "Both long vertical faces",
        },
        {
          name: "Drywall 4×8 — Bottom Soffit",
          formula: "ceil((bh_length * (bh_width / 12)) / 32)",
          unit: "EA", pricePerUnit: 14.5, wasteFactor: 1.15,
          notes: "Underside horizontal face",
        },
        {
          name: "Drywall 4×8 — End Caps (×2)",
          formula: "ceil(((bh_width / 12) * (bh_drop / 12) * 2) / 32)",
          unit: "EA", pricePerUnit: 14.5, wasteFactor: 1.15,
          notes: "Two exposed ends",
        },
        {
          name: "Fine-Thread Drywall Screws (1lb)",
          formula: "ceil(bh_length / 25)",
          unit: "BOX", pricePerUnit: 8, wasteFactor: 1.0,
        },
        {
          name: "Corner Bead (8ft) — All Corners",
          formula: "ceil((bh_length * 4 + (bh_width / 12) * 4) / 8)",
          unit: "EA", pricePerUnit: 2.5, wasteFactor: 1.1,
          notes: "4 long-face corners + 4 end corners",
        },
        {
          name: "Joint Compound (gallon)",
          formula: "ceil(bh_length / 20)",
          unit: "GAL", pricePerUnit: 18, wasteFactor: 1.1,
        },
      ]
    ),
  },
  {
    category: "Metal Framing / Bulkheads",
    label: "Wall-Edge Bulkhead (One Side on Wall)",
    fn: () => makeSection(
      "Wall-Edge Bulkhead", "Metal stud bulkhead with one long edge anchored to wall — 3 faces exposed",
      [
        { id: "bh_length", name: "Bulkhead Length", unitId: "lf", defaultValue: 0 },
        { id: "bh_width", name: "Bulkhead Width (projection from wall)", unitId: "in", defaultValue: 12 },
        { id: "bh_drop", name: "Bulkhead Drop (face height)", unitId: "in", defaultValue: 12 },
      ],
      [
        {
          name: "25ga Metal Track — Front + Ends (10ft)",
          formula: "ceil(((bh_length + (bh_width / 12) * 2) * 2) / 10)",
          unit: "EA", pricePerUnit: 8.5, wasteFactor: 1.1,
          notes: "Top + bottom on front face and 2 ends; wall side uses ledger instead",
        },
        {
          name: "Ledger Track — Wall Anchor (10ft)",
          formula: "ceil(bh_length / 10)",
          unit: "EA", pricePerUnit: 8.5, wasteFactor: 1.05,
          notes: "Single track screwed directly to wall at top of drop",
        },
        {
          name: "25ga Metal Studs — Front Face (8ft)",
          formula: "ceil(bh_length / 1.33)",
          unit: "EA", pricePerUnit: 6, wasteFactor: 1.1,
          notes: "16\" OC on exposed front face only",
        },
        {
          name: "25ga Metal Studs — End Caps (8ft)",
          formula: "ceil((bh_width / 12) / 1.33) * 2",
          unit: "EA", pricePerUnit: 6, wasteFactor: 1.1,
          notes: "2 exposed ends",
        },
        {
          name: "Hanger Wire (50ft roll)",
          formula: "ceil(bh_length / 50)",
          unit: "ROLL", pricePerUnit: 18, wasteFactor: 1.0,
          notes: "Suspend front edge from deck every 4ft",
        },
        {
          name: "Drywall 4×8 — Front Face",
          formula: "ceil((bh_length * (bh_drop / 12)) / 32)",
          unit: "EA", pricePerUnit: 14.5, wasteFactor: 1.15,
          notes: "One exposed long vertical face",
        },
        {
          name: "Drywall 4×8 — Bottom Soffit",
          formula: "ceil((bh_length * (bh_width / 12)) / 32)",
          unit: "EA", pricePerUnit: 14.5, wasteFactor: 1.15,
          notes: "Underside horizontal face",
        },
        {
          name: "Drywall 4×8 — End Caps (×2)",
          formula: "ceil(((bh_width / 12) * (bh_drop / 12) * 2) / 32)",
          unit: "EA", pricePerUnit: 14.5, wasteFactor: 1.15,
          notes: "Two exposed ends",
        },
        {
          name: "Fine-Thread Drywall Screws (1lb)",
          formula: "ceil(bh_length / 30)",
          unit: "BOX", pricePerUnit: 8, wasteFactor: 1.0,
        },
        {
          name: "Corner Bead (8ft)",
          formula: "ceil((bh_length * 2 + (bh_width / 12) * 4) / 8)",
          unit: "EA", pricePerUnit: 2.5, wasteFactor: 1.1,
          notes: "Front top/bottom corners + end corners",
        },
        {
          name: "Joint Compound (gallon)",
          formula: "ceil(bh_length / 25)",
          unit: "GAL", pricePerUnit: 18, wasteFactor: 1.1,
        },
      ]
    ),
  },
  {
    category: "Metal Framing / Bulkheads",
    label: "Wide Bulkhead (>24\", needs mid-span backing)",
    fn: () => makeSection(
      "Wide Bulkhead (>24\")", "Widths over 24\" require lateral backing to prevent racking — choose floating or wall-edge",
      [
        { id: "bh_length", name: "Bulkhead Length", unitId: "lf", defaultValue: 0 },
        { id: "bh_width", name: "Bulkhead Width (inches)", unitId: "in", defaultValue: 36 },
        { id: "bh_drop", name: "Bulkhead Drop (inches)", unitId: "in", defaultValue: 14 },
        { id: "wall_sided", name: "Wall-Sided? (1=yes, 0=floating)", unitId: "ea", defaultValue: 0 },
      ],
      [
        {
          name: "25ga Metal Track (10ft)",
          formula: "ceil(((bh_length * (2 - wall_sided * 0.5) + (bh_width / 12) * 2) * 2) / 10)",
          unit: "EA", pricePerUnit: 8.5, wasteFactor: 1.1,
          notes: "Full perimeter track; wall-sided reduces one long run to a ledger",
        },
        {
          name: "25ga Vertical Studs — Faces (8ft)",
          formula: "ceil(bh_length / 1.33) * (2 - wall_sided) + ceil((bh_width / 12) / 1.33) * 2",
          unit: "EA", pricePerUnit: 6, wasteFactor: 1.1,
          notes: "16\" OC on exposed faces + end caps",
        },
        {
          name: "Mid-Span Lateral Backing Studs",
          formula: "ceil(bh_length / 1.33)",
          unit: "EA", pricePerUnit: 6, wasteFactor: 1.05,
          notes: "REQUIRED >24\" wide: center spine stud every 16\" prevents bottom rack",
        },
        {
          name: "Cross-Brace Bridging (track)",
          formula: "ceil(bh_length / 4) * 2",
          unit: "EA", pricePerUnit: 5, wasteFactor: 1.05,
          notes: "Lateral bridging every 4ft ties faces to backing spine",
        },
        {
          name: "Threaded Rod 3/8\" (10ft)",
          formula: "ceil(bh_length / 4)",
          unit: "EA", pricePerUnit: 12, wasteFactor: 1.0,
          notes: "Positive hanger every 4ft",
        },
        {
          name: "Hanger Wire (50ft roll)",
          formula: "ceil(bh_length * 2 / 50)",
          unit: "ROLL", pricePerUnit: 18, wasteFactor: 1.0,
        },
        {
          name: "Drywall 4×8 — Vertical Faces",
          formula: "ceil((bh_length * (bh_drop / 12) * (2 - wall_sided)) / 32)",
          unit: "EA", pricePerUnit: 14.5, wasteFactor: 1.15,
          notes: "1 or 2 long faces depending on wall-sided setting",
        },
        {
          name: "Drywall 4×8 — Bottom Soffit",
          formula: "ceil((bh_length * (bh_width / 12)) / 32)",
          unit: "EA", pricePerUnit: 14.5, wasteFactor: 1.15,
        },
        {
          name: "Drywall 4×8 — End Caps (×2)",
          formula: "ceil(((bh_width / 12) * (bh_drop / 12) * 2) / 32)",
          unit: "EA", pricePerUnit: 14.5, wasteFactor: 1.15,
        },
        {
          name: "Fine-Thread Drywall Screws (1lb)",
          formula: "ceil(bh_length / 20)",
          unit: "BOX", pricePerUnit: 8, wasteFactor: 1.0,
          notes: "Higher density due to extra backing surfaces",
        },
        {
          name: "Corner Bead (8ft)",
          formula: "ceil((bh_length * (2 - wall_sided) * 2 + (bh_width / 12) * 4) / 8)",
          unit: "EA", pricePerUnit: 2.5, wasteFactor: 1.1,
        },
        {
          name: "Joint Compound (gallon)",
          formula: "ceil(bh_length / 18)",
          unit: "GAL", pricePerUnit: 18, wasteFactor: 1.1,
          notes: "More compound needed for extra corners on wide builds",
        },
      ]
    ),
  },
];

const LIBRARY_BY_CATEGORY = SECTION_LIBRARY.reduce((acc, s) => {
  if (!acc[s.category]) acc[s.category] = [];
  acc[s.category].push(s);
  return acc;
}, {});

// ─── Formula Engine ───────────────────────────────────────────────────────────

function evaluateFormula(formula, variables) {
  try {
    const result = math.evaluate(formula, { ...variables });
    if (typeof result !== "number" || isNaN(result) || !isFinite(result))
      return { value: null, error: "Result is not a valid number" };
    return { value: result, error: null };
  } catch (e) {
    return { value: null, error: e.message };
  }
}

function sectionValues(section) {
  return Object.fromEntries((section.takeoffInputs || []).map(t => [t.id, t.value ?? 0]));
}

function sectionCost(section) {
  const vals = sectionValues(section);
  return section.materials.reduce((sum, mat) => {
    const r = evaluateFormula(mat.formula, vals);
    return r.value !== null ? sum + Math.ceil(r.value * (mat.wasteFactor || 1)) * mat.pricePerUnit : sum;
  }, 0);
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "bom_builder_v2";
function loadState() { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function saveState(s) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} }

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const Icons = {
  plus: "M12 5v14M5 12h14", trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  chevDown: "M6 9l6 6 6-6", chevUp: "M18 15l-6-6-6 6",
  copy: "M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2M8 4a2 2 0 012-2h4a2 2 0 012 2M8 4h8",
  download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  folder: "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z",
  x: "M18 6L6 18M6 6l12 12", save: "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8",
  check: "M20 6L9 17l-5-5",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
  library: "M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 014 17V4a2 2 0 012-2h14a2 2 0 012 2v13M4 19.5V20",
};

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide, extraWide }) {
  useEffect(() => {
    const h = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-box ${wide ? "modal-wide" : ""} ${extraWide ? "modal-xwide" : ""}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}><Icon d={Icons.x} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ─── Formula Help ─────────────────────────────────────────────────────────────

function FormulaHelp({ takeoffInputs, onClose }) {
  const fns = [
    ["ceil(x)", "Round up"], ["floor(x)", "Round down"], ["round(x,n)", "Round to n places"],
    ["min(a,b)", "Smaller value"], ["max(a,b)", "Larger value"], ["abs(x)", "Absolute value"],
    ["mod(a,b)", "Remainder"], ["if(cond,a,b)", "Conditional"], ["and(a,b)", "Logical AND"],
    ["or(a,b)", "Logical OR"], ["sqrt(x)", "Square root"],
  ];
  return (
    <Modal title="Formula Reference" onClose={onClose} wide>
      <div className="help-grid">
        <div>
          <h4 className="help-section-title">This Section's Variables</h4>
          <div className="help-vars">
            {(takeoffInputs || []).length === 0 && <p className="help-note">No inputs yet.</p>}
            {(takeoffInputs || []).map(t => <div key={t.id} className="help-var"><code>{t.id}</code><span>{t.name}</span></div>)}
          </div>
        </div>
        <div>
          <h4 className="help-section-title">Functions</h4>
          <div className="help-vars">{fns.map(([f, d]) => <div key={f} className="help-var"><code>{f}</code><span>{d}</span></div>)}</div>
        </div>
        <div>
          <h4 className="help-section-title">Examples</h4>
          <div className="help-examples">
            <code>ceil(wall_lf / 1.33) + 3</code>
            <code>if(bh_width &gt; 24, ceil(bh_length / 4), 0)</code>
            <code>ceil(tile_sf / ((tile_size / 12) ^ 2))</code>
          </div>
          <p className="help-note">Waste factor is multiplied in automatically — do not include it in formulas.</p>
        </div>
      </div>
    </Modal>
  );
}

// ─── Material Row ─────────────────────────────────────────────────────────────

function MaterialRow({ mat, sectionVals, takeoffInputs, primaryInputId, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(mat);
  const [showHelp, setShowHelp] = useState(false);

  const result = evaluateFormula(mat.formula, sectionVals);
  const qty = result.value !== null ? Math.ceil(result.value * (mat.wasteFactor || 1)) : null;
  const totalCost = qty !== null ? qty * mat.pricePerUnit : null;
  const primaryVal = sectionVals[primaryInputId] || 0;
  const costPerUnit = primaryVal > 0 && totalCost !== null ? totalCost / primaryVal : null;

  if (editing) return (
    <>
      {showHelp && <FormulaHelp takeoffInputs={takeoffInputs} onClose={() => setShowHelp(false)} />}
      <tr className="mat-row editing">
        <td><input className="cell-input" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Material name" /></td>
        <td>
          <div className="formula-edit-wrap">
            <input className="cell-input mono" value={draft.formula} onChange={e => setDraft({ ...draft, formula: e.target.value })} placeholder="formula" />
            <button className="help-btn" onClick={() => setShowHelp(true)}>?</button>
          </div>
        </td>
        <td><input className="cell-input sm" value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value })} placeholder="EA" /></td>
        <td><input className="cell-input sm" type="number" step="0.01" value={draft.wasteFactor} onChange={e => setDraft({ ...draft, wasteFactor: parseFloat(e.target.value) || 1 })} /></td>
        <td><input className="cell-input sm" type="number" step="0.01" value={draft.pricePerUnit} onChange={e => setDraft({ ...draft, pricePerUnit: parseFloat(e.target.value) || 0 })} /></td>
        <td className="muted">—</td><td className="muted">—</td><td className="muted">—</td>
        <td>
          <div className="row-actions">
            <button className="action-btn save" onClick={() => { onUpdate(draft); setEditing(false); }}><Icon d={Icons.check} size={14} /></button>
            <button className="action-btn" onClick={() => setEditing(false)}><Icon d={Icons.x} size={14} /></button>
          </div>
        </td>
      </tr>
      <tr className="formula-note-row">
        <td /><td colSpan={8}><input className="cell-input notes-input" value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes (optional)" /></td>
      </tr>
    </>
  );

  return (
    <tr className="mat-row">
      <td>
        <div className="mat-name">{mat.name}</div>
        {mat.notes && <div className="mat-notes">{mat.notes}</div>}
      </td>
      <td><code className="formula-display">{mat.formula}</code></td>
      <td className="center">{mat.unit}</td>
      <td className="center">{mat.wasteFactor}×</td>
      <td className="right">${mat.pricePerUnit.toFixed(2)}</td>
      <td className="center">
        {result.error ? <span className="formula-error" title={result.error}>⚠ err</span> : <span className="qty-value">{qty ?? "—"}</span>}
      </td>
      <td className="right">{totalCost !== null ? `$${totalCost.toFixed(2)}` : "—"}</td>
      <td className="right muted">{costPerUnit !== null ? `$${costPerUnit.toFixed(2)}` : "—"}</td>
      <td>
        <div className="row-actions">
          <button className="action-btn" onClick={() => setEditing(true)}><Icon d={Icons.edit} size={14} /></button>
          <button className="action-btn danger" onClick={onDelete}><Icon d={Icons.trash} size={14} /></button>
        </div>
      </td>
    </tr>
  );
}

// ─── Section Takeoff Inputs ───────────────────────────────────────────────────

function SectionTakeoffInputs({ section, units, onUpdate }) {
  const [editMode, setEditMode] = useState(false);
  const [draftInputs, setDraftInputs] = useState(section.takeoffInputs || []);

  function updateValue(id, val) {
    onUpdate({ ...section, takeoffInputs: section.takeoffInputs.map(t => t.id === id ? { ...t, value: parseFloat(val) || 0 } : t) });
  }

  function saveInputs() {
    onUpdate({ ...section, takeoffInputs: draftInputs, primaryInputId: draftInputs[0]?.id || section.primaryInputId });
    setEditMode(false);
  }

  if (editMode) return (
    <div className="takeoff-inputs-editor">
      <div className="takeoff-inputs-editor-header">
        <span className="editor-label">Edit Section Inputs</span>
        <div className="row-actions">
          <button className="action-btn" onClick={() => setDraftInputs([...draftInputs, { id: "var_" + uid(), name: "New Input", unitId: units[0]?.id || "ea", defaultValue: 0, value: 0 }])}>
            <Icon d={Icons.plus} size={12} /> Add
          </button>
          <button className="action-btn save" onClick={saveInputs}><Icon d={Icons.check} size={13} /> Save</button>
          <button className="action-btn" onClick={() => { setDraftInputs(section.takeoffInputs || []); setEditMode(false); }}><Icon d={Icons.x} size={13} /></button>
        </div>
      </div>
      <div className="draft-inputs-list">
        {draftInputs.map((t, i) => (
          <div key={t.id} className="draft-input-row">
            <input className="cell-input flex1" value={t.name} onChange={e => setDraftInputs(draftInputs.map((d, j) => j === i ? { ...d, name: e.target.value } : d))} placeholder="Label" />
            <input className="cell-input sm mono" value={t.id} onChange={e => setDraftInputs(draftInputs.map((d, j) => j === i ? { ...d, id: e.target.value.replace(/\W/g, "_") } : d))} placeholder="var_id" />
            <select className="cell-input sm" value={t.unitId} onChange={e => setDraftInputs(draftInputs.map((d, j) => j === i ? { ...d, unitId: e.target.value } : d))}>
              {units.map(u => <option key={u.id} value={u.id}>{u.abbr} — {u.label}</option>)}
            </select>
            <button className="action-btn danger" onClick={() => setDraftInputs(draftInputs.filter((_, j) => j !== i))}><Icon d={Icons.trash} size={12} /></button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="section-takeoffs">
      {(section.takeoffInputs || []).map(t => {
        const unit = units.find(u => u.id === t.unitId);
        return (
          <div key={t.id} className="section-takeoff-field">
            <label className="stf-label">{t.name}</label>
            <div className="stf-input-wrap">
              <input type="number" className="stf-input" value={t.value ?? ""} onChange={e => updateValue(t.id, e.target.value)} placeholder="0" />
              <span className="stf-unit">{unit?.abbr || t.unitId?.toUpperCase()}</span>
            </div>
          </div>
        );
      })}
      <button className="edit-inputs-btn" onClick={() => { setDraftInputs((section.takeoffInputs || []).map(t => ({ ...t }))); setEditMode(true); }}>
        <Icon d={Icons.settings} size={11} /> inputs
      </button>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ section, units, onUpdate, onDelete, onDuplicate }) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(section.name);

  const vals = sectionValues(section);
  const primaryInputId = section.primaryInputId || section.takeoffInputs?.[0]?.id;
  const primaryInput = section.takeoffInputs?.find(t => t.id === primaryInputId);
  const primaryUnit = units.find(u => u.id === primaryInput?.unitId);
  const primaryVal = vals[primaryInputId] || 0;

  const totals = section.materials.reduce((acc, mat) => {
    const r = evaluateFormula(mat.formula, vals);
    if (r.value !== null) { acc.cost += Math.ceil(r.value * (mat.wasteFactor || 1)) * mat.pricePerUnit; acc.valid++; }
    else acc.errors++;
    return acc;
  }, { cost: 0, valid: 0, errors: 0 });

  const costPerUnit = primaryVal > 0 ? totals.cost / primaryVal : null;

  function addMaterial() {
    const firstVar = section.takeoffInputs?.[0]?.id;
    onUpdate({ ...section, materials: [...section.materials, { id: uid(), name: "New Material", formula: firstVar ? `ceil(${firstVar})` : "0", unit: "EA", pricePerUnit: 0, wasteFactor: 1.0, notes: "" }] });
  }

  return (
    <div className="section-card">
      <div className="section-header">
        <div className="section-header-left">
          <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}><Icon d={collapsed ? Icons.chevDown : Icons.chevUp} size={14} /></button>
          {editingTitle ? (
            <div className="title-edit">
              <input className="title-input" value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (onUpdate({ ...section, name: titleDraft }), setEditingTitle(false))} autoFocus />
              <button className="action-btn save" onClick={() => { onUpdate({ ...section, name: titleDraft }); setEditingTitle(false); }}><Icon d={Icons.check} size={13} /></button>
              <button className="action-btn" onClick={() => setEditingTitle(false)}><Icon d={Icons.x} size={13} /></button>
            </div>
          ) : (
            <h3 className="section-title" onDoubleClick={() => setEditingTitle(true)}>{section.name}</h3>
          )}
          {section.description && !editingTitle && <span className="section-desc">{section.description}</span>}
        </div>
        <div className="section-header-right">
          <div className="section-stats">
            <span className="stat-badge cost">${totals.cost.toFixed(2)}</span>
            {costPerUnit !== null && primaryUnit && <span className="stat-badge unit">${costPerUnit.toFixed(2)} / {primaryUnit.abbr}</span>}
            {totals.errors > 0 && <span className="stat-badge error">⚠ {totals.errors} err</span>}
          </div>
          <div className="section-actions">
            <button className="action-btn" onClick={onDuplicate} title="Duplicate"><Icon d={Icons.copy} size={14} /></button>
            <button className="action-btn danger" onClick={onDelete} title="Delete"><Icon d={Icons.trash} size={14} /></button>
          </div>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="section-inputs-bar">
            <SectionTakeoffInputs section={section} units={units} onUpdate={onUpdate} />
          </div>
          <div className="section-body">
            <table className="mat-table">
              <thead>
                <tr>
                  <th>Material</th><th>Formula</th>
                  <th className="center">Unit</th><th className="center">Waste</th>
                  <th className="right">$/Unit</th><th className="center">Qty</th>
                  <th className="right">Cost</th><th className="right">$/Input</th><th></th>
                </tr>
              </thead>
              <tbody>
                {section.materials.map(mat => (
                  <MaterialRow key={mat.id} mat={mat} sectionVals={vals} takeoffInputs={section.takeoffInputs}
                    primaryInputId={primaryInputId}
                    onUpdate={updated => onUpdate({ ...section, materials: section.materials.map(m => m.id === mat.id ? updated : m) })}
                    onDelete={() => onUpdate({ ...section, materials: section.materials.filter(m => m.id !== mat.id) })}
                  />
                ))}
              </tbody>
            </table>
            <button className="add-mat-btn" onClick={addMaterial}><Icon d={Icons.plus} size={14} /> Add Material</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Add Section Modal ────────────────────────────────────────────────────────

function AddSectionModal({ onAdd, onClose }) {
  const cats = Object.keys(LIBRARY_BY_CATEGORY);
  const [tab, setTab] = useState(cats[0]);

  return (
    <Modal title="Add Section" onClose={onClose} wide>
      <div className="add-section-layout">
        <div className="add-section-cats">
          {cats.map(cat => <button key={cat} className={`cat-btn ${tab === cat ? "active" : ""}`} onClick={() => setTab(cat)}>{cat}</button>)}
          <button className={`cat-btn ${tab === "__blank" ? "active" : ""}`} onClick={() => setTab("__blank")}>+ Blank</button>
        </div>
        <div className="add-section-items">
          {tab === "__blank" ? (
            <div className="blank-section-prompt">
              <p>Start with an empty section — add your own inputs and materials.</p>
              <button className="btn-primary" onClick={() => onAdd({
                id: uid(), name: "Custom Section", description: "",
                takeoffInputs: [{ id: "quantity", name: "Quantity", unitId: "ea", defaultValue: 0, value: 0 }],
                primaryInputId: "quantity", materials: [],
              })}>Create Blank Section</button>
            </div>
          ) : (
            LIBRARY_BY_CATEGORY[tab]?.map(item => (
              <div key={item.label} className="library-item">
                <div className="library-item-name">{item.label}</div>
                <button className="action-btn" onClick={() => onAdd(item.fn())}>Add</button>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

// ─── Manage Units Modal ───────────────────────────────────────────────────────

function ManageUnitsModal({ units, onSave, onClose }) {
  const [draft, setDraft] = useState(units.map(u => ({ ...u })));
  return (
    <Modal title="Units of Measure" onClose={onClose}>
      <div className="manage-list">
        {draft.map((u, i) => (
          <div key={u.id} className="manage-row">
            <input className="cell-input flex1" value={u.label} onChange={e => setDraft(draft.map((d, j) => j === i ? { ...d, label: e.target.value } : d))} placeholder="Label" />
            <input className="cell-input sm" value={u.abbr} onChange={e => setDraft(draft.map((d, j) => j === i ? { ...d, abbr: e.target.value.toUpperCase() } : d))} placeholder="Abbr" />
            <button className="action-btn danger" onClick={() => setDraft(draft.filter((_, j) => j !== i))}><Icon d={Icons.trash} size={13} /></button>
          </div>
        ))}
        <button className="add-mat-btn" onClick={() => setDraft([...draft, { id: uid(), label: "New Unit", abbr: "NEW" }])}>
          <Icon d={Icons.plus} size={13} /> Add Unit
        </button>
      </div>
      <div className="modal-footer">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => onSave(draft)}>Save</button>
      </div>
    </Modal>
  );
}

// ─── Projects Modal ───────────────────────────────────────────────────────────

function ProjectsModal({ projects, currentId, onLoad, onDelete, onNew, onClose }) {
  return (
    <Modal title="Projects" onClose={onClose}>
      <div className="projects-list">
        {projects.length === 0 && <p className="muted-text">No saved projects yet.</p>}
        {[...projects].reverse().map(p => (
          <div key={p.id} className={`project-row ${p.id === currentId ? "active" : ""}`}>
            <div>
              <div className="project-name">{p.name}</div>
              <div className="project-meta">{new Date(p.savedAt).toLocaleDateString()} · {p.sections.length} section{p.sections.length !== 1 ? "s" : ""}</div>
            </div>
            <div className="row-actions">
              <button className="action-btn" onClick={() => onLoad(p)}>Load</button>
              <button className="action-btn danger" onClick={() => onDelete(p.id)}><Icon d={Icons.trash} size={13} /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="modal-footer">
        <button className="btn-secondary" onClick={onClose}>Close</button>
        <button className="btn-primary" onClick={onNew}><Icon d={Icons.plus} size={13} /> New Project</button>
      </div>
    </Modal>
  );
}

// ─── Summary Sidebar ──────────────────────────────────────────────────────────

function SummaryPanel({ sections, units }) {
  const grandTotal = sections.reduce((sum, sec) => sum + sectionCost(sec), 0);
  return (
    <div className="summary-panel">
      <div className="panel-header"><span className="panel-title">Summary</span></div>
      <div className="summary-rows">
        {sections.map(sec => {
          const cost = sectionCost(sec);
          const vals = sectionValues(sec);
          const primaryId = sec.primaryInputId || sec.takeoffInputs?.[0]?.id;
          const primaryInput = sec.takeoffInputs?.find(t => t.id === primaryId);
          const primaryUnit = units.find(u => u.id === primaryInput?.unitId);
          const primaryVal = vals[primaryId] || 0;
          return (
            <div key={sec.id} className="summary-row">
              <span>{sec.name}</span>
              <div className="summary-row-right">
                <span className="summary-cost">${cost.toFixed(2)}</span>
                {primaryVal > 0 && <span className="summary-per">${(cost / primaryVal).toFixed(2)}/{primaryUnit?.abbr || "—"}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="summary-total"><span>Total</span><span>${grandTotal.toFixed(2)}</span></div>
    </div>
  );
}

// ─── Print Report ─────────────────────────────────────────────────────────────

function PrintReport({ projectName, sections, units }) {
  const grandTotal = sections.reduce((sum, sec) => sum + sectionCost(sec), 0);
  return (
    <div className="print-report">
      <div className="print-header">
        <div className="print-header-left">
          <div className="print-logo">▦ BOM Builder</div>
          <h1 className="print-project-name">{projectName}</h1>
        </div>
        <div className="print-header-right">
          <div className="print-date">Prepared: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
          <div className="print-grand-total">${grandTotal.toFixed(2)}</div>
          <div className="print-grand-total-label">Total Estimated Cost</div>
        </div>
      </div>

      <div className="print-section">
        <h2 className="print-section-heading">Cost Summary</h2>
        <table className="print-table">
          <thead><tr><th>Section</th><th className="print-right">Subtotal</th><th className="print-right">% of Total</th><th>Primary Input</th></tr></thead>
          <tbody>
            {sections.map(sec => {
              const cost = sectionCost(sec);
              const pct = grandTotal > 0 ? (cost / grandTotal * 100).toFixed(1) : "0.0";
              const primaryId = sec.primaryInputId || sec.takeoffInputs?.[0]?.id;
              const primaryInput = sec.takeoffInputs?.find(t => t.id === primaryId);
              const unit = units.find(u => u.id === primaryInput?.unitId);
              const primaryVal = (primaryInput?.value || 0);
              return (
                <tr key={sec.id}>
                  <td>{sec.name}</td>
                  <td className="print-right print-mono">${cost.toFixed(2)}</td>
                  <td className="print-right print-mono">{pct}%</td>
                  <td className="print-mono">{primaryVal.toLocaleString()} {unit?.abbr || ""}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr className="print-total-row"><td><strong>Total</strong></td><td className="print-right print-mono"><strong>${grandTotal.toFixed(2)}</strong></td><td className="print-right print-mono">100%</td><td /></tr></tfoot>
        </table>
      </div>

      {sections.map(sec => {
        const vals = sectionValues(sec);
        const primaryId = sec.primaryInputId || sec.takeoffInputs?.[0]?.id;
        const primaryInput = sec.takeoffInputs?.find(t => t.id === primaryId);
        const primaryVal = vals[primaryId] || 0;
        const primaryUnit = units.find(u => u.id === primaryInput?.unitId);
        const secTotal = sectionCost(sec);
        return (
          <div className="print-section print-break-inside" key={sec.id}>
            <div className="print-section-header">
              <h2 className="print-section-heading">{sec.name}</h2>
              <div className="print-section-meta">
                {sec.takeoffInputs?.map(t => { const u = units.find(u => u.id === t.unitId); return `${t.name}: ${t.value ?? 0} ${u?.abbr || ""}`; }).join("  ·  ")}
                &nbsp;·&nbsp; Total: <strong>${secTotal.toFixed(2)}</strong>
                {primaryVal > 0 && <>&nbsp;·&nbsp; ${(secTotal / primaryVal).toFixed(2)} / {primaryUnit?.abbr}</>}
              </div>
            </div>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Material</th><th>Formula</th><th className="print-center">Unit</th>
                  <th className="print-center">Waste</th><th className="print-right">$/Unit</th>
                  <th className="print-right">Qty</th><th className="print-right">Line Cost</th>
                  {primaryVal > 0 && <th className="print-right">$/Input Unit</th>}
                </tr>
              </thead>
              <tbody>
                {sec.materials.map(mat => {
                  const r = evaluateFormula(mat.formula, vals);
                  const qty = r.value !== null ? Math.ceil(r.value * (mat.wasteFactor || 1)) : null;
                  const cost = qty !== null ? qty * mat.pricePerUnit : null;
                  return (
                    <tr key={mat.id}>
                      <td><div>{mat.name}</div>{mat.notes && <div className="print-note">{mat.notes}</div>}</td>
                      <td className="print-mono print-formula">{mat.formula}</td>
                      <td className="print-center">{mat.unit}</td>
                      <td className="print-center">{mat.wasteFactor}×</td>
                      <td className="print-right print-mono">${mat.pricePerUnit.toFixed(2)}</td>
                      <td className="print-right print-mono">{qty ?? "—"}</td>
                      <td className="print-right print-mono">{cost !== null ? `$${cost.toFixed(2)}` : "—"}</td>
                      {primaryVal > 0 && <td className="print-right print-mono">{cost !== null ? `$${(cost / primaryVal).toFixed(2)}` : "—"}</td>}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="print-total-row">
                  <td colSpan={primaryVal > 0 ? 6 : 5}><strong>Section Total</strong></td>
                  <td className="print-right print-mono"><strong>${secTotal.toFixed(2)}</strong></td>
                  {primaryVal > 0 && <td className="print-right print-mono"><strong>${(secTotal / primaryVal).toFixed(2)}</strong></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })}
      <div className="print-footer">Generated by BOM Builder · {new Date().toLocaleString()}</div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const saved = loadState();
  const [units, setUnits] = useState(saved?.units || defaultUnits);
  const [sections, setSections] = useState(saved?.sections || []);
  const [projects, setProjects] = useState(saved?.projects || []);
  const [currentProjectId, setCurrentProjectId] = useState(saved?.currentProjectId || null);
  const [currentProjectName, setCurrentProjectName] = useState(saved?.currentProjectName || "Untitled Project");
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showManageUnits, setShowManageUnits] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  useEffect(() => {
    saveState({ units, sections, projects, currentProjectId, currentProjectName });
  }, [units, sections, projects, currentProjectId, currentProjectName]);

  const grandTotal = sections.reduce((sum, sec) => sum + sectionCost(sec), 0);

  function addSection(sec) { setSections([...sections, sec]); setShowAddSection(false); }
  function updateSection(id, updated) { setSections(sections.map(s => s.id === id ? updated : s)); }
  function deleteSection(id) { if (confirm("Delete this section?")) setSections(sections.filter(s => s.id !== id)); }
  function duplicateSection(sec) {
    setSections([...sections, { ...sec, id: uid(), name: sec.name + " (copy)", materials: sec.materials.map(m => ({ ...m, id: uid() })), takeoffInputs: sec.takeoffInputs.map(t => ({ ...t })) }]);
  }

  function saveProject() {
    const project = { id: currentProjectId || uid(), name: currentProjectName, savedAt: new Date().toISOString(), sections, units };
    setProjects([...projects.filter(p => p.id !== project.id), project]);
    setCurrentProjectId(project.id);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1500);
  }

  function loadProject(p) {
    setSections(p.sections); setUnits(p.units || defaultUnits);
    setCurrentProjectId(p.id); setCurrentProjectName(p.name); setShowProjects(false);
  }

  return (
    <div className="app">
      {showAddSection && <AddSectionModal onAdd={addSection} onClose={() => setShowAddSection(false)} />}
      {showManageUnits && <ManageUnitsModal units={units} onSave={u => { setUnits(u); setShowManageUnits(false); }} onClose={() => setShowManageUnits(false)} />}
      {showProjects && <ProjectsModal projects={projects} currentId={currentProjectId}
        onLoad={loadProject}
        onDelete={id => setProjects(projects.filter(p => p.id !== id))}
        onNew={() => { setSections([]); setCurrentProjectId(null); setCurrentProjectName("Untitled Project"); setShowProjects(false); }}
        onClose={() => setShowProjects(false)} />}

      <header className="topbar">
        <div className="topbar-left">
          <div className="logo"><div className="logo-icon">▦</div><span className="logo-text">BOM Builder</span></div>
          <div className="project-name-wrap">
            {editingProjectName
              ? <input className="project-name-input" value={currentProjectName} onChange={e => setCurrentProjectName(e.target.value)} onBlur={() => setEditingProjectName(false)} onKeyDown={e => e.key === "Enter" && setEditingProjectName(false)} autoFocus />
              : <span className="project-name" onDoubleClick={() => setEditingProjectName(true)} title="Double-click to rename">{currentProjectName}</span>
            }
          </div>
        </div>
        <div className="topbar-right">
          <div className="grand-total-badge">${grandTotal.toFixed(2)}</div>
          <button className="topbar-btn" onClick={() => setShowManageUnits(true)}><Icon d={Icons.settings} size={15} /> Units</button>
          <button className="topbar-btn" onClick={() => setShowProjects(true)}><Icon d={Icons.folder} size={15} /> Projects</button>
          <button className={`topbar-btn ${saveFlash ? "flash" : ""}`} onClick={saveProject}><Icon d={saveFlash ? Icons.check : Icons.save} size={15} /> {saveFlash ? "Saved!" : "Save"}</button>
          <button className="topbar-btn" onClick={() => window.print()}><Icon d={Icons.download} size={15} /> Print / PDF</button>
        </div>
      </header>

      <div className="main-layout">
        <aside className="sidebar"><SummaryPanel sections={sections} units={units} /></aside>
        <main className="content">
          {sections.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">▦</div>
              <h2>No sections yet</h2>
              <p>Pick from the section library or start with a blank section.</p>
              <button className="btn-primary large" onClick={() => setShowAddSection(true)}><Icon d={Icons.library} size={16} /> Browse Section Library</button>
            </div>
          )}
          {sections.map(sec => (
            <Section key={sec.id} section={sec} units={units}
              onUpdate={updated => updateSection(sec.id, updated)}
              onDelete={() => deleteSection(sec.id)}
              onDuplicate={() => duplicateSection(sec)} />
          ))}
          {sections.length > 0 && (
            <button className="add-section-btn" onClick={() => setShowAddSection(true)}>
              <Icon d={Icons.plus} size={15} /> Add Section
            </button>
          )}
        </main>
      </div>

      <PrintReport projectName={currentProjectName} sections={sections} units={units} />
    </div>
  );
}
