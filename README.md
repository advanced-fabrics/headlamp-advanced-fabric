# Headlamp Advanced Fabrics

Headlamp Advanced Fabrics is a read-only UI client for the public Advanced Fabrics
observation API. It discovers the API from
`AdvancedFabric.status.observationAPI` and accesses the advertised Kubernetes
Service through the Kubernetes Service Proxy.

The plugin does not scan implementation ConfigMaps, query a metrics database,
derive structural coordinates, or provide fixed/demo/fallback observations.
Missing producer data remains unavailable in the UI. Relationship polygons are
drawn only when the producer supplies all three synchronized coordinates.

The node view is split into separate `Relationship evolution`, `Measurements`,
`DNS / DoH`, `Path probes`, `All agent data`, and `Structural evidence` tabs.
The canonical R-D-C frame remains visible while relationship discovery is temporarily
unavailable. Relationship evolution accepts a two-ended time
window of up to 30 days and requests at most 100 producer-selected samples. It
uses a dashed start shape, a solid end shape and per-vertex trajectories instead
of assigning an unrelated colour to every timestamp. The Measurements tab shows
the complete producer-published measurement envelope, including unavailable and
right-censored records. DNS, DoH and path-probe records are rendered without
field truncation, and the complete agent payload is available as flattened field
paths; the UI does not synthesize missing values.

## Requirements

- `networking.advfab.org/v1alpha1` `AdvancedFabric` CRD;
- observation API `v1` with the advertised `subjects`, `snapshots`,
  `relationships`, `relationship-series`, and `episodes` capabilities; and
- RBAC for `get/list/watch` on `AdvancedFabric` plus `get` on the advertised
  Service proxy.

## Build

```sh
npm ci
npm run tsc
npm run lint
npm run build
npm run package
```
