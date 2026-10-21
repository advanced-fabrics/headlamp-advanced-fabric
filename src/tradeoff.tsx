import { SectionBox, Table } from '@kinvolk/headlamp-plugin/lib/components/common';
import {
  Alert,
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
  useTheme,
} from '@mui/material';
import React from 'react';
import {
  completeSamples,
  MAX_HISTORY_SECONDS,
  relationshipSeriesPath,
  TriangleSample as Sample,
} from './contract';

export type ObservationClient = (path: string) => Promise<any>;
type Subject = { kind: string; name: string; observedAt?: string; state: string };
type Relationship = { id: string; vertexLabel?: string; vertices: string[]; hypothesis?: string };
type TabName = 'evolution' | 'measurements' | 'dns' | 'paths' | 'raw' | 'evidence';

const FALLBACK_RELATIONSHIP: Relationship = {
  id: 'redundancy-independence-churn',
  vertexLabel: 'R-D-C',
  vertices: ['R', 'D', 'C'],
  hypothesis: 'Redundancy, diversity and churn relationship',
};

function useRequest(client: ObservationClient, path?: string) {
  const [state, setState] = React.useState<{ data?: any; error?: string }>({});
  React.useEffect(() => {
    let active = true;
    setState({});
    if (!path)
      return () => {
        active = false;
      };
    client(path)
      .then(data => active && setState({ data }))
      .catch(error => active && setState({ error: String(error) }));
    return () => {
      active = false;
    };
  }, [client, path]);
  return state;
}

const POSITIONS = [
  { x: 60, y: 10 },
  { x: 12, y: 92 },
  { x: 108, y: 92 },
];
const CENTER = { x: 60, y: 64.67 };
const VERTEX_COLORS = ['#ef4444', '#22c55e', '#3b82f6'];
const VERTEX_NAMES: Record<string, string> = {
  R: 'Redundancy',
  D: 'Diversity',
  C: 'Churn',
};

function samplePoints(vertices: string[], sample: Sample) {
  return vertices.map((vertex, index) => {
    const radius = 0.12 + Number(sample.coordinates[vertex]) * 0.84;
    const target = POSITIONS[index];
    return {
      x: CENTER.x + (target.x - CENTER.x) * radius,
      y: CENTER.y + (target.y - CENTER.y) * radius,
    };
  });
}

function formatTime(epochSeconds: number) {
  return new Date(epochSeconds * 1000).toLocaleString();
}

function formatValue(value: any) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(3);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function flattenPayload(value: any, path = ''): Array<{ path: string; value: string }> {
  if (value === null || value === undefined || typeof value !== 'object')
    return [{ path: path || '$', value: formatValue(value) }];
  const entries: Array<[string, any]> = Array.isArray(value)
    ? value.map((child, index) => [String(index), child])
    : Object.entries(value);
  return entries.flatMap(([key, child]) =>
    flattenPayload(child, path ? `${path}.${key}` : String(key))
  );
}

function RelationshipEvolution({
  relationship,
  samples,
}: {
  relationship: Relationship;
  samples: Sample[];
}) {
  const theme = useTheme();
  const vertices = relationship.vertices;
  const complete = completeSamples(vertices, samples).sort((a, b) => a.time - b.time);
  const [selectedIndex, setSelectedIndex] = React.useState(Math.max(0, complete.length - 1));
  React.useEffect(() => setSelectedIndex(Math.max(0, complete.length - 1)), [complete.length]);
  const oldest = complete[0];
  const newest = complete[complete.length - 1];
  const selected = complete[selectedIndex];
  const linePath = (sample: Sample, side: number) => {
    const points = samplePoints(vertices, sample);
    const start = points[side];
    const end = points[(side + 1) % points.length];
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  };
  const curveWidth = 760;
  const curveHeight = 126;
  const curveX = (index: number) =>
    complete.length <= 1 ? 20 : 20 + (index / (complete.length - 1)) * (curveWidth - 40);
  const curveY = (value: number) => 10 + (1 - value) * (curveHeight - 30);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(520px,1.35fr) minmax(300px,.65fr)' },
        gap: 3,
      }}
    >
      <svg
        viewBox="0 0 120 106"
        width="100%"
        height="520"
        style={{ maxHeight: 520, minHeight: 360 }}
        role="img"
        aria-label={`${vertices.join(' ')} relationship evolution`}
      >
        <polygon
          points="60,10 12,92 108,92"
          fill="none"
          stroke={theme.palette.text.primary}
          strokeOpacity=".55"
          strokeWidth="1.2"
        />
        {complete.map((sample, sampleIndex) => {
          const isSelected = sampleIndex === selectedIndex;
          const opacity = isSelected ? 0.6 : 0.08 + (sampleIndex / Math.max(1, complete.length - 1)) * 0.16;
          return (
            <g key={sample.time}>
              {vertices.map((_, side) => (
                <path
                  key={side}
                  d={linePath(sample, side)}
                  fill="none"
                  stroke={VERTEX_COLORS[side]}
                  strokeOpacity={opacity}
                  strokeWidth={isSelected ? 1.8 : 0.55}
                  strokeDasharray={isSelected ? undefined : '1.2 1.5'}
                />
              ))}
            </g>
          );
        })}
        {selected &&
          samplePoints(vertices, selected).map((point, index) => (
            <circle
              key={vertices[index]}
              cx={point.x}
              cy={point.y}
              r="1.3"
              fill={VERTEX_COLORS[index]}
              fillOpacity=".6"
            />
          ))}
        {vertices.map((vertex, index) => (
          <g key={vertex}>
            <circle
              cx={POSITIONS[index].x}
              cy={POSITIONS[index].y}
              r="2.6"
              fill={VERTEX_COLORS[index]}
            />
            <text
              x={POSITIONS[index].x}
              y={index === 0 ? 5 : 102}
              textAnchor={index === 1 ? 'start' : index === 2 ? 'end' : 'middle'}
              fontSize="6"
              fontWeight="700"
              fill={theme.palette.text.primary}
            >
              {VERTEX_NAMES[vertex] || vertex}
            </text>
          </g>
        ))}
      </svg>
      <Stack gap={2} justifyContent="center">
        <Box>
          <Typography variant="h5">{relationship.vertexLabel || vertices.join('–')}</Typography>
          <Typography color="text.secondary">
            {relationship.hypothesis || 'Observed structural relationship.'}
          </Typography>
        </Box>
        <Alert severity="info">
          Redundancy、Diversity、Churn 分别使用红、绿、蓝编码；浅色闭线表示历史，60% 不透明度的实线表示当前游标样本。
        </Alert>
        {!complete.length && (
          <Alert severity="warning">
            所选窗口内没有三个坐标均完整的同步样本；缺失值不会被当成零。
          </Alert>
        )}
        {oldest && newest && selected && (
          <Stack gap={1}>
            <Typography variant="subtitle2">窗口变化</Typography>
            <Typography variant="caption" color="text.secondary">
              {formatTime(oldest.time)} → {formatTime(newest.time)} · {complete.length} 个完整样本
              <br />当前高亮：{formatTime(selected.time)}
            </Typography>
            {vertices.map(vertex => {
              const start = Number(oldest.coordinates[vertex]);
              const end = Number(newest.coordinates[vertex]);
              const delta = (end - start) * 100;
              return (
                <Typography key={vertex} variant="body2">
                  {VERTEX_NAMES[vertex] || vertex}: {(start * 100).toFixed(1)}% →{' '}
                  {(end * 100).toFixed(1)}%{' '}
                  <Box
                    component="span"
                    sx={{
                      color:
                        delta > 0 ? 'success.main' : delta < 0 ? 'warning.main' : 'text.secondary',
                    }}
                  >
                    ({delta > 0 ? '+' : ''}
                    {delta.toFixed(1)} pp)
                  </Box>
                </Typography>
              );
            })}
          </Stack>
        )}
      </Stack>
      {!!complete.length && (
        <Box sx={{ gridColumn: '1 / -1', px: 1 }}>
          <Typography variant="subtitle2">时间范围内的 RDC 演变</Typography>
          <Box sx={{ position: 'relative', mt: 1 }}>
            <svg
              viewBox={`0 0 ${curveWidth} ${curveHeight}`}
              width="100%"
              height="150"
              role="img"
              aria-label="Redundancy Diversity Churn time curves"
            >
              {[0, 0.5, 1].map(value => (
                <line
                  key={value}
                  x1="20"
                  x2={curveWidth - 20}
                  y1={curveY(value)}
                  y2={curveY(value)}
                  stroke={theme.palette.divider}
                  strokeWidth="1"
                />
              ))}
              {vertices.map((vertex, vertexIndex) => (
                <polyline
                  key={vertex}
                  points={complete
                    .map((sample, index) =>
                      `${curveX(index)},${curveY(Number(sample.coordinates[vertex]))}`
                    )
                    .join(' ')}
                  fill="none"
                  stroke={VERTEX_COLORS[vertexIndex]}
                  strokeWidth="2"
                  strokeOpacity=".8"
                />
              ))}
              <line
                x1={curveX(selectedIndex)}
                x2={curveX(selectedIndex)}
                y1="6"
                y2={curveHeight - 16}
                stroke={theme.palette.text.primary}
                strokeOpacity=".55"
                strokeWidth="1"
              />
              <path
                d={`M ${curveX(selectedIndex) - 7} 2 L ${curveX(selectedIndex) + 7} 2 L ${curveX(selectedIndex)} 14 Z`}
                fill={theme.palette.text.primary}
              />
            </svg>
            <Box
              component="input"
              type="range"
              aria-label="Highlighted observation time"
              min={0}
              max={Math.max(0, complete.length - 1)}
              step={1}
              value={selectedIndex}
              title={formatTime(selected?.time || 0)}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setSelectedIndex(Number(event.target.value))
              }
              sx={{ display: 'block', width: '100%', mt: -3, accentColor: 'primary.main' }}
            />
          </Box>
          <Stack direction="row" gap={2} flexWrap="wrap">
            {vertices.map((vertex, index) => (
              <Typography key={vertex} variant="caption" sx={{ color: VERTEX_COLORS[index] }}>
                ● {VERTEX_NAMES[vertex] || vertex}
              </Typography>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}

function RangeSelector({
  value,
  bounds,
  onCommit,
}: {
  value: [number, number];
  bounds: [number, number];
  onCommit: (value: [number, number]) => void;
}) {
  const [draft, setDraft] = React.useState<[number, number]>(value);
  React.useEffect(() => setDraft(value), [value[0], value[1]]);
  const updateDraft = (endpoint: 0 | 1, rawValue: string) => {
    const nextValue = Number(rawValue);
    setDraft(current =>
      endpoint === 0
        ? [Math.min(nextValue, current[1]), current[1]]
        : [current[0], Math.max(nextValue, current[0])]
    );
  };
  return (
    <Box sx={{ px: 1, pt: 1, minWidth: { md: 420 }, flex: 1 }}>
      <Stack direction="row" justifyContent="space-between" gap={2}>
        <Typography variant="caption">{formatTime(draft[0])}</Typography>
        <Typography variant="caption">{formatTime(draft[1])}</Typography>
      </Stack>
      <Stack gap={0.5} sx={{ my: 1 }}>
        <Typography component="label" variant="caption">
          起点
          <Box
            component="input"
            type="range"
            aria-label="Observation start time"
            value={draft[0]}
            min={bounds[0]}
            max={draft[1]}
            step={900}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              updateDraft(0, event.target.value)
            }
            onPointerUp={() => onCommit(draft)}
            onKeyUp={() => onCommit(draft)}
            sx={{ display: 'block', width: '100%', accentColor: 'primary.main' }}
          />
        </Typography>
        <Typography component="label" variant="caption">
          终点
          <Box
            component="input"
            type="range"
            aria-label="Observation end time"
            value={draft[1]}
            min={draft[0]}
            max={bounds[1]}
            step={900}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              updateDraft(1, event.target.value)
            }
            onPointerUp={() => onCommit(draft)}
            onKeyUp={() => onCommit(draft)}
            sx={{ display: 'block', width: '100%', accentColor: 'primary.main' }}
          />
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        拖动两个端点选择数据期限；最长回看 30 天，松开端点后才重新查询。
      </Typography>
    </Box>
  );
}

export default function TradeoffObservatory({
  client,
  capabilities,
}: {
  client: ObservationClient;
  capabilities: string[];
}) {
  const now = React.useMemo(() => Math.floor(Date.now() / 1000), []);
  const bounds = React.useMemo<[number, number]>(() => [now - MAX_HISTORY_SECONDS, now], [now]);
  const [range, setRange] = React.useState<[number, number]>(bounds);
  const [tab, setTab] = React.useState<TabName>('evolution');
  const subjectsState = useRequest(client, '/api/v1/subjects');
  const relationshipsState = useRequest(
    client,
    tab === 'evolution' ? '/api/v1/relationships' : undefined
  );
  const subjects: Subject[] = subjectsState.data?.items || [];
  const advertisedRelationships: Relationship[] = relationshipsState.data?.items || [];
  const relationships: Relationship[] = advertisedRelationships.length
    ? advertisedRelationships
    : [FALLBACK_RELATIONSHIP];
  const [selectedSubject, setSelectedSubject] = React.useState('');
  const [selectedRelationship, setSelectedRelationship] = React.useState('');
  const subject = subjects.some(item => item.name === selectedSubject)
    ? selectedSubject
    : subjects[0]?.name || '';
  const relationshipId = relationships.some(item => item.id === selectedRelationship)
    ? selectedRelationship
    : relationships[0]?.id || '';
  const relationship = relationships.find(item => item.id === relationshipId);
  const seriesPath =
    tab === 'evolution' && relationshipId && subject
      ? relationshipSeriesPath(relationshipId, subject, {
          start: range[0],
          end: range[1],
          maxPoints: 100,
        })
      : undefined;
  const seriesState = useRequest(client, seriesPath);
  const snapshotState = useRequest(
    client,
    tab !== 'evolution' && subject
      ? `/api/v1/subjects/Node/${encodeURIComponent(subject)}/snapshot`
      : undefined
  );
  const snapshot = snapshotState.data;
  const errors = [
    subjectsState.error,
    relationshipsState.error,
    seriesState.error,
    snapshotState.error,
  ].filter(Boolean) as string[];
  const measurementRows = (snapshot?.measurement?.measurements || []).map((item: any) => ({
    symbol: item.symbol,
    state: item.state || item.observationStatus || '—',
    value: formatValue(item.value),
    unit: item.unit || snapshot?.measurement?.trackingValues?.[item.symbol]?.unit || '—',
    observedAt: item.observedAt ? new Date(item.observedAt).toLocaleString() : '—',
    source: item.source || '—',
    note: item.missingEvidence || item.note || '—',
  }));
  const evidenceRows = Object.entries(snapshot?.latent || {}).map(([name, value]: any) => ({
    name,
    state: value.state,
    required: (value.requiredSymbols || []).join(', ') || '—',
    available: (value.availableSymbols || []).join(', ') || '—',
    missing: (value.missingSymbols || []).join(', ') || '—',
  }));
  const networkQuality = Array.isArray(snapshot?.networkQuality) ? snapshot.networkQuality : [];
  const dnsRows = networkQuality.flatMap((source: any) =>
    [
      ...(source.dns || []).map((entry: any) => ({ ...entry, kind: 'DNS' })),
      ...(source.doh || []).map((entry: any) => ({ ...entry, kind: 'DoH' })),
    ].map((entry: any) => ({
      source: `${source.sourceNode || subject}/${source.sourcePlane || 'unknown'}`,
      observedAt: source.observedAt ? new Date(source.observedAt).toLocaleString() : '—',
      kind: entry.kind,
      role: entry.serverRole || entry.role || '—',
      server: entry.server || entry.url || '—',
      protocol: entry.protocol || (entry.kind === 'DoH' ? 'https' : '—'),
      name: entry.name || entry.queryName || '—',
      attempts: entry.attempts ?? '—',
      successes: entry.successes ?? '—',
      failureRatio: entry.failureRatio ?? '—',
      p50Ms: entry.p50Ms ?? '—',
      p95Ms: entry.p95Ms ?? '—',
      responses: formatValue(entry.responses),
      raw: formatValue(entry),
    }))
  );
  const pathRows = networkQuality.flatMap((source: any) =>
    (source.paths || []).map((entry: any) => ({
      source: `${source.sourceNode || subject}/${source.sourcePlane || 'unknown'}`,
      observedAt: source.observedAt ? new Date(source.observedAt).toLocaleString() : '—',
      target: `${entry.targetNode || '—'}/${entry.targetPlane || '—'}`,
      address: entry.address || entry.target || '—',
      attempts: entry.attempts ?? '—',
      successes: entry.successes ?? '—',
      lossRatio: entry.lossRatio ?? entry.failureRatio ?? '—',
      p50Ms: entry.p50Ms ?? '—',
      p95Ms: entry.p95Ms ?? '—',
      raw: formatValue(entry),
    }))
  );
  const rawRows = snapshot
    ? flattenPayload({
        structural: Object.fromEntries(
          Object.entries(snapshot).filter(
            ([key]) => !['apiVersion', 'kind', 'name', 'measurement', 'networkQuality', 'networkStatus'].includes(key)
          )
        ),
        measurement: snapshot.measurement,
        networkQuality: snapshot.networkQuality,
        networkStatus: snapshot.networkStatus,
      })
    : [];

  return (
    <Box>
      {errors.map(error => (
        <Alert severity="error" sx={{ my: 1 }} key={error}>
          {error}
        </Alert>
      ))}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'center' }}
        gap={2}
        sx={{ my: 2 }}
      >
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel id="subject">Node</InputLabel>
          <Select
            labelId="subject"
            label="Node"
            value={subject}
            onChange={event => setSelectedSubject(event.target.value)}
          >
            {subjects.map(item => (
              <MenuItem key={item.name} value={item.name}>
                {item.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {subjects.find(item => item.name === subject) && (
          <Chip
            label={subjects.find(item => item.name === subject)!.state}
            color={
              subjects.find(item => item.name === subject)!.state === 'Ready'
                ? 'success'
                : 'warning'
            }
          />
        )}
        <Chip variant="outlined" label={`API capabilities: ${capabilities.length}`} />
      </Stack>
      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        <Tab value="evolution" label="Relationship evolution" />
        <Tab value="measurements" label="Measurements" />
        <Tab value="dns" label="DNS / DoH" />
        <Tab value="paths" label="Path probes" />
        <Tab value="raw" label="All agent data" />
        <Tab value="evidence" label="Structural evidence" />
      </Tabs>
      {!subjects.length && !subjectsState.error && (
        <Alert severity="warning">The Advanced Fabric API reports no observable subjects.</Alert>
      )}
      {tab === 'evolution' && (
        <>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ md: 'center' }}
            gap={3}
            sx={{ mb: 2 }}
          >
            <FormControl size="small" sx={{ minWidth: 280 }}>
              <InputLabel id="relationship">Relationship</InputLabel>
              <Select
                labelId="relationship"
                label="Relationship"
                value={relationshipId}
                onChange={event => setSelectedRelationship(event.target.value)}
              >
                {relationships.map(item => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.vertexLabel || item.vertices.join('–')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <RangeSelector value={range} bounds={bounds} onCommit={setRange} />
          </Stack>
          {!advertisedRelationships.length && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Relationship definitions are temporarily unavailable; showing the canonical R-D-C
              frame while observation data recovers.
            </Alert>
          )}
          {relationship && (
            <SectionBox
              title={`${
                relationship.vertexLabel || relationship.vertices.join('–')
              } relationship evolution`}
            >
              <RelationshipEvolution
                relationship={relationship}
                samples={seriesState.data?.samples || []}
              />
            </SectionBox>
          )}
        </>
      )}
      {tab === 'measurements' && snapshot && (
        <SectionBox title={`${subject} measurements (${measurementRows.length})`}>
          <Table
            data={measurementRows}
            columns={
              [
                { header: 'Symbol', accessorKey: 'symbol' },
                { header: 'State', accessorKey: 'state' },
                { header: 'Value', accessorKey: 'value' },
                { header: 'Unit', accessorKey: 'unit' },
                { header: 'Observed at', accessorKey: 'observedAt' },
                { header: 'Source', accessorKey: 'source' },
                { header: 'Missing evidence / note', accessorKey: 'note' },
              ] as any
            }
          />
        </SectionBox>
      )}
      {tab === 'dns' && snapshot && (
        <SectionBox title={`${subject} DNS / DoH observations (${dnsRows.length})`}>
          <Table
            data={dnsRows}
            columns={
              [
                { header: 'Source', accessorKey: 'source' },
                { header: 'Observed at', accessorKey: 'observedAt' },
                { header: 'Kind', accessorKey: 'kind' },
                { header: 'Role', accessorKey: 'role' },
                { header: 'Server', accessorKey: 'server' },
                { header: 'Protocol', accessorKey: 'protocol' },
                { header: 'Query', accessorKey: 'name' },
                { header: 'Attempts', accessorKey: 'attempts' },
                { header: 'Successes', accessorKey: 'successes' },
                { header: 'Failure ratio', accessorKey: 'failureRatio' },
                { header: 'p50 ms', accessorKey: 'p50Ms' },
                { header: 'p95 ms', accessorKey: 'p95Ms' },
                { header: 'Responses', accessorKey: 'responses' },
                { header: 'Complete record', accessorKey: 'raw' },
              ] as any
            }
          />
        </SectionBox>
      )}
      {tab === 'paths' && snapshot && (
        <SectionBox title={`${subject} path probe observations (${pathRows.length})`}>
          <Table
            data={pathRows}
            columns={
              [
                { header: 'Source', accessorKey: 'source' },
                { header: 'Observed at', accessorKey: 'observedAt' },
                { header: 'Target', accessorKey: 'target' },
                { header: 'Address', accessorKey: 'address' },
                { header: 'Attempts', accessorKey: 'attempts' },
                { header: 'Successes', accessorKey: 'successes' },
                { header: 'Loss ratio', accessorKey: 'lossRatio' },
                { header: 'p50 ms', accessorKey: 'p50Ms' },
                { header: 'p95 ms', accessorKey: 'p95Ms' },
                { header: 'Complete record', accessorKey: 'raw' },
              ] as any
            }
          />
        </SectionBox>
      )}
      {tab === 'raw' && snapshot && (
        <SectionBox title={`${subject} complete agent payload (${rawRows.length} fields)`}>
          <Alert severity="info" sx={{ mb: 2 }}>
            This view expands every leaf field supplied by structural observation, node measurement,
            network-quality and node-status collectors. Values are not truncated.
          </Alert>
          <Table
            data={rawRows}
            columns={
              [
                { header: 'Field path', accessorKey: 'path' },
                { header: 'Value', accessorKey: 'value' },
              ] as any
            }
          />
        </SectionBox>
      )}
      {tab === 'evidence' && snapshot && (
        <SectionBox title={`${subject} structural evidence`}>
          <Table
            data={evidenceRows}
            columns={
              [
                { header: 'Quantity', accessorKey: 'name' },
                { header: 'Evidence state', accessorKey: 'state' },
                { header: 'Required measurements', accessorKey: 'required' },
                { header: 'Available measurements', accessorKey: 'available' },
                { header: 'Missing measurements', accessorKey: 'missing' },
              ] as any
            }
          />
        </SectionBox>
      )}
    </Box>
  );
}
