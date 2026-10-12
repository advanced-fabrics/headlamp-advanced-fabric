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
type TabName = 'evolution' | 'measurements' | 'evidence';

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
  const text = JSON.stringify(value);
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
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
  const oldest = complete[0];
  const newest = complete[complete.length - 1];
  const polygon = (sample: Sample) =>
    samplePoints(vertices, sample)
      .map(point => `${point.x},${point.y}`)
      .join(' ');
  const trajectories = vertices.map((vertex, vertexIndex) => ({
    vertex,
    points: complete.map(sample => samplePoints(vertices, sample)[vertexIndex]),
  }));

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
        <defs>
          <marker
            id="trajectory-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={theme.palette.primary.main} />
          </marker>
        </defs>
        <polygon
          points="60,10 12,92 108,92"
          fill="none"
          stroke={theme.palette.text.primary}
          strokeOpacity=".55"
          strokeWidth="1.2"
        />
        {[0.25, 0.5, 0.75].map(radius => (
          <polygon
            key={radius}
            fill="none"
            stroke={theme.palette.divider}
            strokeWidth=".45"
            points={POSITIONS.map(
              target =>
                `${CENTER.x + (target.x - CENTER.x) * radius},${
                  CENTER.y + (target.y - CENTER.y) * radius
                }`
            ).join(' ')}
          />
        ))}
        {complete.slice(1, -1).map((sample, index) => (
          <polygon
            key={sample.time}
            points={polygon(sample)}
            fill="none"
            stroke={theme.palette.primary.main}
            strokeOpacity={0.1 + (index / Math.max(1, complete.length - 2)) * 0.18}
            strokeWidth=".55"
            strokeDasharray="1.4 1.4"
          />
        ))}
        {oldest && (
          <polygon
            points={polygon(oldest)}
            fill="none"
            stroke={theme.palette.text.secondary}
            strokeWidth="1"
            strokeDasharray="3 2"
          />
        )}
        {trajectories.map(
          ({ vertex, points }) =>
            points.length > 1 && (
              <polyline
                key={vertex}
                points={points.map(point => `${point.x},${point.y}`).join(' ')}
                fill="none"
                stroke={theme.palette.primary.main}
                strokeOpacity=".65"
                strokeWidth=".8"
                markerEnd="url(#trajectory-arrow)"
              />
            )
        )}
        {newest && (
          <polygon
            points={polygon(newest)}
            fill={theme.palette.primary.main}
            fillOpacity=".08"
            stroke={theme.palette.primary.main}
            strokeWidth="1.7"
          />
        )}
        {newest &&
          samplePoints(vertices, newest).map((point, index) => (
            <circle
              key={vertices[index]}
              cx={point.x}
              cy={point.y}
              r="1.3"
              fill={theme.palette.primary.main}
            />
          ))}
        {vertices.map((vertex, index) => (
          <g key={vertex}>
            <circle
              cx={POSITIONS[index].x}
              cy={POSITIONS[index].y}
              r="2.6"
              fill={theme.palette.text.primary}
            />
            <text
              x={POSITIONS[index].x}
              y={index === 0 ? 5 : 102}
              textAnchor={index === 1 ? 'start' : index === 2 ? 'end' : 'middle'}
              fontSize="6"
              fontWeight="700"
              fill={theme.palette.text.primary}
            >
              {vertex}
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
          虚线是窗口起点，实线填充是窗口终点；浅色虚线为中间闭曲线，箭头显示每个顶点随时间的移动方向。
        </Alert>
        {!complete.length && (
          <Alert severity="warning">
            所选窗口内没有三个坐标均完整的同步样本；缺失值不会被当成零。
          </Alert>
        )}
        {oldest && newest && (
          <Stack gap={1}>
            <Typography variant="subtitle2">窗口变化</Typography>
            <Typography variant="caption" color="text.secondary">
              {formatTime(oldest.time)} → {formatTime(newest.time)} · {complete.length} 个完整样本
            </Typography>
            {vertices.map(vertex => {
              const start = Number(oldest.coordinates[vertex]);
              const end = Number(newest.coordinates[vertex]);
              const delta = (end - start) * 100;
              return (
                <Typography key={vertex} variant="body2">
                  {vertex}: {(start * 100).toFixed(1)}% → {(end * 100).toFixed(1)}%{' '}
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
  const relationships: Relationship[] = relationshipsState.data?.items || [];
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
          {!relationships.length && !relationshipsState.error && (
            <Alert severity="warning">
              The Advanced Fabric API reports no relationship definitions.
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
