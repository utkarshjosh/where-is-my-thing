import { useState, useEffect } from 'react';
import { api, type SystemHealth, type DataStats, type MetricsSummary, type RateLimitStats, type CacheStats, type RequestLog } from './api';
import './App.css';

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function StatusBadge({ status }: { status: string }) {
  const colorClass = status === 'healthy' || status === 'connected' || status === 'configured'
    ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : status === 'degraded'
      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      : 'bg-red-500/20 text-red-400 border-red-500/30';

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${colorClass}`}>
      {status}
    </span>
  );
}

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`card p-6 ${className}`}>
      <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function StatNumber({ value, label, unit = '' }: { value: number | string; label: string; unit?: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-white">
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit && <span className="text-lg text-gray-400 ml-1">{unit}</span>}
      </div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const percentage = Math.min((value / max) * 100, 100);
  const color = percentage > 80 ? 'bg-red-500' : percentage > 50 ? 'bg-yellow-500' : 'bg-blue-500';

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white">{value.toFixed(0)} / {max}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export default function App() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [stats, setStats] = useState<DataStats | null>(null);
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitStats | null>(null);
  const [cache, setCache] = useState<CacheStats | null>(null);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAllData = async () => {
    try {
      const [healthData, statsData, metricsData, rateLimitData, cacheData, logsData] = await Promise.all([
        api.getHealth(),
        api.getStats(),
        api.getMetrics(),
        api.getRateLimit(),
        api.getCache(),
        api.getLogs(20),
      ]);
      setHealth(healthData);
      setStats(statsData);
      setMetrics(metricsData);
      setRateLimit(rateLimitData);
      setCache(cacheData);
      setLogs(logsData.requests);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card p-8 text-center">
          <div className="text-red-400 text-lg mb-4">Failed to connect</div>
          <div className="text-gray-500 mb-4">{error}</div>
          <button
            onClick={fetchAllData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Spatial Memory Admin</h1>
            <p className="text-gray-500 text-sm mt-1">System monitoring dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            {health && <StatusBadge status={health.status} />}
            <span className="text-gray-500 text-sm">v{health?.version}</span>
          </div>
        </div>
      </header>

      {/* System Health Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card title="System Status">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Neo4j</span>
              <StatusBadge status={health?.neo4j || 'unknown'} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Groq API</span>
              <StatusBadge status={health?.groq_api || 'unknown'} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Uptime</span>
              <span className="text-white font-medium">{formatUptime(health?.uptime_seconds || 0)}</span>
            </div>
          </div>
        </Card>

        <Card title="Database">
          <div className="grid grid-cols-2 gap-4">
            <StatNumber value={stats?.users || 0} label="Users" />
            <StatNumber value={stats?.things || 0} label="Things" />
            <StatNumber value={stats?.places || 0} label="Places" />
            <StatNumber value={stats?.nodes_total || 0} label="Total" />
          </div>
        </Card>

        <Card title="API Traffic">
          <div className="space-y-4">
            <StatNumber value={metrics?.total_requests || 0} label="Total Requests" />
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Avg Latency</span>
              <span className="text-white">{metrics?.avg_latency_ms?.toFixed(1) || 0}ms</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Error Rate</span>
              <span className={metrics?.error_rate && metrics.error_rate > 5 ? 'text-red-400' : 'text-green-400'}>
                {metrics?.error_rate?.toFixed(2) || 0}%
              </span>
            </div>
          </div>
        </Card>

        <Card title="Rate Limiter">
          <div className="space-y-4">
            <ProgressBar
              value={rateLimit?.current_tokens || 0}
              max={100}
              label="Available Tokens"
            />
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Rate Limited</span>
              <span className="text-white">{rateLimit?.rate_limited_requests || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">In Window</span>
              <span className="text-white">{rateLimit?.requests_in_window || 0}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Cache Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card title="Cache Performance">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-2">JWKS Cache</div>
              <div className="text-2xl font-bold text-white">
                {((cache?.jwks_cache.hit_rate || 0) * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500">Hit Rate</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-2">User ID Cache</div>
              <div className="text-2xl font-bold text-white">
                {((cache?.user_id_cache.hit_rate || 0) * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500">Hit Rate</div>
            </div>
          </div>
        </Card>

        <Card title="Endpoint Latencies">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-left">
                  <th className="pb-2">Endpoint</th>
                  <th className="pb-2 text-right">Calls</th>
                  <th className="pb-2 text-right">Avg</th>
                  <th className="pb-2 text-right">P95</th>
                </tr>
              </thead>
              <tbody>
                {metrics && Object.entries(metrics.endpoints).slice(0, 5).map(([endpoint, data]) => (
                  <tr key={endpoint} className="border-t border-gray-800">
                    <td className="py-2 text-gray-300 font-mono text-xs">{endpoint}</td>
                    <td className="py-2 text-right text-white">{data.calls}</td>
                    <td className="py-2 text-right text-gray-400">{data.avg_ms.toFixed(0)}ms</td>
                    <td className="py-2 text-right text-gray-400">{data.p95_ms.toFixed(0)}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Recent Requests */}
      <Card title="Recent API Requests">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left">
                <th className="pb-2">Time</th>
                <th className="pb-2">Method</th>
                <th className="pb-2">Endpoint</th>
                <th className="pb-2 text-right">Status</th>
                <th className="pb-2 text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={i} className="border-t border-gray-800">
                  <td className="py-2 text-gray-500 text-xs">
                    {new Date(log.timestamp * 1000).toLocaleTimeString()}
                  </td>
                  <td className="py-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${log.method === 'GET' ? 'bg-blue-500/20 text-blue-400' :
                      log.method === 'POST' ? 'bg-green-500/20 text-green-400' :
                        log.method === 'DELETE' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                      }`}>
                      {log.method}
                    </span>
                  </td>
                  <td className="py-2 text-gray-300 font-mono text-xs">{log.endpoint}</td>
                  <td className="py-2 text-right">
                    <span className={log.status < 400 ? 'text-green-400' : 'text-red-400'}>
                      {log.status}
                    </span>
                  </td>
                  <td className="py-2 text-right text-gray-400">{log.duration_ms.toFixed(0)}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <footer className="mt-8 text-center text-gray-600 text-sm">
        Updates every 5 seconds • Spatial Memory API v{health?.version}
      </footer>
    </div>
  );
}
