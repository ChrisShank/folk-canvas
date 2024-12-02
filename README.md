# Folk Canvas

## Explorations

- What would it look like if the browser had primitives for building spatial canvases?
- How easily can we turn a document into a canvas?
- Can we incrementally change ownership and control of the web from single-origin server to the user?
- How can someone more easily annotate and re-layout web pages they did not make?
- How can we more easily compose and connect web pages and their data?
  - How can we compose together live and visual programming notations?
- Can we have lightweight visual and live scripting for web pages?

## Development

1. Install [Bun](https://bun.sh/docs/installation)

```bash
bun i
# then
bun dev
```

## Primitives

- `<folk-shape>`: Manipulate HTML elements in space.
- `<folk-ink>`: Draw lines of ink.
- `<folk-arrow>`: Define connection between HTML elements.
- `<folk-canvas>`: Control a camera (panning/zoom) and query elements in space
