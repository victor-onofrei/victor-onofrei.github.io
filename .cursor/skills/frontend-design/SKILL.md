---
name: frontend-design
description: Guides creation of distinctive, production-grade web interfaces with strong aesthetic intent. Use when building or styling web components, pages, landing sites, dashboards, React/Vue/HTML layouts, posters, or any UI where generic “AI default” styling should be avoided.
---

# Frontend design

Derived from [Anthropic’s frontend-design skill](https://github.com/anthropics/skills/tree/main/skills/frontend-design) (Apache-2.0). License terms: [LICENSE.txt](LICENSE.txt).

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic “AI slop” aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design thinking

Before coding, understand the context and commit to a **bold** aesthetic direction:

- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this **unforgettable**? What is the one thing someone will remember?

**Critical**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work—the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:

- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point of view
- Meticulously refined in every detail

## Frontend aesthetics guidelines

Focus on:

- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic defaults (Arial, Inter, Roboto, system UI stacks) when the design calls for character; pair a distinctive display face with a refined body face where appropriate.
- **Color and theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prefer CSS-only solutions for plain HTML/CSS. Use Motion (or the project’s motion library) for React when available. Prioritize high-impact moments: one well-orchestrated page load with staggered reveals (`animation-delay`) often beats scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space **or** controlled density—match the concept.
- **Backgrounds and visual details**: Create atmosphere and depth rather than defaulting to flat solids. Add contextual effects and textures: gradient meshes, noise, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, grain overlays—whatever fits the direction.

**Avoid** clichéd “template” aesthetics: purple-on-white gradients as a default, predictable hero + three-card + testimonial grids, and cookie-cutter UI with no context-specific character.

Interpret creatively and make unexpected choices that feel designed for **this** brief. Vary light/dark themes, type, and mood across different tasks; do not converge on the same trendy stack every time (e.g. repeating the same display font across unrelated projects).

**Important**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animation and effects. Minimalist or refined designs need restraint, precision, and careful spacing, typography, and subtle detail. Elegance comes from executing the vision well.

Commit fully to a distinctive vision—do not hold back when the brief calls for memorable, intentional design.
