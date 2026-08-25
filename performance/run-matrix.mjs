import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import os from "node:os";
import { writeReportWebsite } from "./report-builder.mjs";

const DEFAULT_USERS = [1, 5, 10, 20, 50, 100];
const DEFAULT_K6_IMAGE = "grafana/k6:0.57.0";
const BACKEND_ENVIRONMENT_KEYS = new Set([
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "DB_POOL_MIN",
  "DB_POOL_MAX",
  "LOG_REQUESTS_CONSOLE_ENABLED",
  "LOG_REQUESTS_FILE_ENABLED",
  "SECURITY_PRINCIPAL_CACHE_TTL_MS",
  "SECURITY_PRINCIPAL_CACHE_MAX_ENTRIES",
  "GLOBAL_SEARCH_INDEX_ENABLED",
]);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendEnvironment = readBackendEnvironment();
const options = parseArguments(process.argv.slice(2));
const users = parsePositiveIntegerList(
  options.users || process.env.SAPLING_USERS,
  DEFAULT_USERS,
);
const iterations = positiveInteger(
  options.iterations || process.env.SAPLING_ITERATIONS_PER_USER,
  10,
);
const engine =
  options.engine || process.env.SAPLING_PERFORMANCE_ENGINE || "native";
const configuredBaseUrl =
  options.baseUrl ||
  process.env.SAPLING_BASE_URL ||
  "http://localhost:3000/api";
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const resultsDirectory = path.resolve(
  options.results ||
    process.env.SAPLING_RESULTS_DIRECTORY ||
    path.join(scriptDirectory, "results", runId),
);

assertConfiguration(engine);
mkdirSync(resultsDirectory, { recursive: true });

const summaries = [];
let infrastructureFailure = false;
const warmupEnabled =
  String(options.warmup ?? process.env.SAPLING_WARMUP ?? "true") !== "false";

console.log(`Sapling performance matrix: ${users.join(", ")} users`);
console.log(`Engine: ${engine}`);
console.log(`Results: ${resultsDirectory}`);

if (warmupEnabled) {
  infrastructureFailure = !(await runWarmup());
}

for (const userCount of infrastructureFailure ? [] : users) {
  console.log(
    `\n=== ${userCount} concurrent user${userCount === 1 ? "" : "s"} ===`,
  );
  const summaryFile = path.join(
    resultsDirectory,
    `summary-${String(userCount).padStart(3, "0")}.json`,
  );
  const environment = buildEnvironment(
    userCount,
    iterations,
    summaryFile,
    runId,
    engine,
  );
  const command = buildCommand(engine, environment);
  const execution = await executeCommand(command, environment, true);

  if (execution.error) {
    infrastructureFailure = true;
    const hint =
      execution.error.code === "ENOENT"
        ? engine === "native"
          ? "Install k6 or rerun with --engine docker."
          : "Install/start Docker or rerun with --engine native."
        : "";
    console.error(
      `Could not start ${command.executable}: ${execution.error.message}. ${hint}`,
    );
    break;
  }

  if (execution.status !== 0 && execution.status !== 99) {
    infrastructureFailure = true;
    console.error(
      `k6 exited with code ${execution.status}; stopping the matrix because this is not a threshold-only failure.`,
    );
    break;
  }

  try {
    const summary = JSON.parse(readFileSync(summaryFile, "utf8"));
    summary.telemetry = execution.telemetry;
    writeFileSync(summaryFile, `${JSON.stringify(summary, null, 2)}\n`);
    summaries.push(summary);
  } catch (error) {
    infrastructureFailure = true;
    console.error(`Could not read ${summaryFile}: ${error.message}`);
    break;
  }
}

if (summaries.length > 0) {
  writeReports(summaries, resultsDirectory, {
    engine,
    users,
    iterations,
    baseUrl: configuredBaseUrl,
    runId,
    warmup: warmupEnabled,
    environment: runtimeMetadata(),
  });
  console.log(`\nMatrix report: ${path.join(resultsDirectory, "matrix.md")}`);
  console.log(
    `Machine-readable report: ${path.join(resultsDirectory, "matrix.json")}`,
  );
  console.log(
    `Per-endpoint report: ${path.join(resultsDirectory, "steps.csv")}`,
  );
  console.log(
    `Host telemetry: ${path.join(resultsDirectory, "host-telemetry.csv")}`,
  );
  console.log(
    `Database telemetry: ${path.join(resultsDirectory, "database-telemetry.csv")}`,
  );
  console.log(
    `Presentation website: ${path.join(resultsDirectory, "report.html")}`,
  );
}

const thresholdFailure = summaries.some(
  (summary) => summary.thresholdsPassed === false,
);
if (infrastructureFailure || summaries.length !== users.length) {
  process.exitCode = 2;
} else if (thresholdFailure) {
  process.exitCode = 1;
}

function buildEnvironment(
  userCount,
  iterationCount,
  summaryFile,
  currentRunId,
  selectedEngine,
) {
  const environment = {
    ...process.env,
    K6_NO_COLOR: process.env.K6_NO_COLOR || "true",
    SAPLING_BASE_URL:
      selectedEngine === "docker"
        ? dockerBaseUrl(configuredBaseUrl)
        : configuredBaseUrl,
    SAPLING_USERS: String(userCount),
    SAPLING_ITERATIONS_PER_USER: String(iterationCount),
    SAPLING_RESULT_PATH:
      selectedEngine === "docker"
        ? `/results/${path.basename(summaryFile)}`
        : summaryFile,
    SAPLING_RUN_ID: `${currentRunId}-u${userCount}`,
  };
  return environment;
}

function buildCommand(selectedEngine, environment) {
  if (selectedEngine === "native") {
    return {
      executable: process.env.SAPLING_K6_BINARY || "k6",
      arguments: ["run", path.join(scriptDirectory, "sapling-workflow.js")],
    };
  }

  const forwardedVariables = [
    "K6_NO_COLOR",
    "SAPLING_BASE_URL",
    "SAPLING_TOKEN",
    "SAPLING_TOKENS_JSON",
    "SAPLING_AUTH_MODE",
    "SAPLING_SESSION_COOKIES_JSON",
    "SAPLING_USERS",
    "SAPLING_ITERATIONS_PER_USER",
    "SAPLING_THINK_TIME_MS",
    "SAPLING_P95_LIMIT_MS",
    "SAPLING_MAX_ERROR_RATE",
    "SAPLING_MAX_DURATION",
    "SAPLING_WRITE_MODE",
    "SAPLING_TICKET_FILTER",
    "SAPLING_EXTRA_ENTITIES",
    "SAPLING_RESULT_PATH",
    "SAPLING_RUN_ID",
  ].filter((name) => environment[name] !== undefined);
  const dockerArguments = [
    "run",
    "--rm",
    "-v",
    `${scriptDirectory}:/scripts:ro`,
    "-v",
    `${resultsDirectory}:/results`,
  ];
  if (process.platform === "linux") {
    const userId = process.getuid?.();
    const groupId = process.getgid?.();
    if (Number.isInteger(userId) && Number.isInteger(groupId)) {
      dockerArguments.push("--user", `${userId}:${groupId}`);
    }
    dockerArguments.push("--add-host", "host.docker.internal:host-gateway");
  }
  for (const variableName of forwardedVariables) {
    dockerArguments.push("-e", variableName);
  }
  dockerArguments.push(
    process.env.SAPLING_K6_IMAGE || DEFAULT_K6_IMAGE,
    "run",
    "/scripts/sapling-workflow.js",
  );
  return {
    executable: process.env.SAPLING_DOCKER_BINARY || "docker",
    arguments: dockerArguments,
  };
}

function writeReports(results, directory, configuration) {
  const rows = results
    .slice()
    .sort((left, right) => left.config.users - right.config.users)
    .map(toMatrixRow);
  const report = {
    schemaVersion: 3,
    generatedAt: new Date().toISOString(),
    configuration,
    results,
  };
  writeFileSync(
    path.join(directory, "matrix.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  writeFileSync(path.join(directory, "matrix.csv"), matrixCsv(rows));
  writeFileSync(
    path.join(directory, "matrix.md"),
    matrixMarkdown(rows, configuration),
  );
  writeFileSync(path.join(directory, "steps.csv"), stepsCsv(results));
  writeFileSync(
    path.join(directory, "host-telemetry.csv"),
    hostTelemetryCsv(results),
  );
  writeFileSync(
    path.join(directory, "database-telemetry.csv"),
    databaseTelemetryCsv(results),
  );
  writeReportWebsite(report, directory);
}

function toMatrixRow(summary) {
  const requests = summary.metrics.httpRequests || {};
  const duration = summary.metrics.httpRequestDuration || {};
  const failures = summary.metrics.httpRequestFailed || {};
  const workflow = summary.metrics.workflowSuccess || {};
  const workflowDuration = summary.metrics.workflowDuration || {};
  const serverTiming = summary.metrics.serverTiming || {};
  const failureDiagnostics = summary.failureDiagnostics || {};
  const host = summary.telemetry?.host?.summary || {};
  const databaseTelemetry = summary.telemetry?.database || {};
  const database = databaseTelemetry.summary || {};
  const durationSeconds = summary.durationMs ? summary.durationMs / 1000 : 0;
  const requestCount = requests.count || 0;
  const missingServerTiming = serverTiming.missing?.count || 0;
  return {
    users: summary.config.users,
    workflowsExpected: summary.config.expectedWorkflows,
    workflowsCompleted: summary.metrics.iterations?.count || 0,
    workflowSuccessRate: workflow.rate,
    requestCount,
    requestsPerSecond:
      durationSeconds > 0 ? (requests.count || 0) / durationSeconds : null,
    httpErrorRate: failures.rate,
    requestFailureCount: failureDiagnostics.total?.count || 0,
    transportFailureCount: failureDiagnostics.transport?.count || 0,
    clientFailureCount: failureDiagnostics.client?.count || 0,
    serverFailureCount: failureDiagnostics.server?.count || 0,
    unexpectedFailureCount: failureDiagnostics.unexpected?.count || 0,
    failureStatusMin: failureDiagnostics.status?.min,
    failureStatusMax: failureDiagnostics.status?.max,
    failureErrorCodeMin: failureDiagnostics.errorCode?.min,
    failureErrorCodeMax: failureDiagnostics.errorCode?.max,
    httpAverageMs: duration.avg,
    httpP90Ms: duration["p(90)"],
    httpP95Ms: duration["p(95)"],
    httpP99Ms: duration["p(99)"],
    httpMaxMs: duration.max,
    workflowP95Ms: workflowDuration["p(95)"],
    serverTimingCoverage:
      requestCount > 0
        ? clampRatio(1 - missingServerTiming / requestCount)
        : null,
    serverAuthP95Ms: serverTiming.auth?.["p(95)"],
    serverHandlerP95Ms: serverTiming.handler?.["p(95)"],
    serverTotalP95Ms: serverTiming.total?.["p(95)"],
    hostCpuAveragePercent: host.cpuAveragePercent,
    hostCpuP95Percent: host.cpuP95Percent,
    hostCpuMaxPercent: host.cpuMaxPercent,
    hostUsedMemoryMaxBytes: host.usedMemoryMaxBytes,
    databaseTelemetryAvailable: databaseTelemetry.available === true,
    databaseTotalConnectionsMax: database.totalConnectionsMax,
    databaseActiveConnectionsP95: database.activeConnectionsP95,
    databaseActiveConnectionsMax: database.activeConnectionsMax,
    databaseWaitingConnectionsMax: database.waitingConnectionsMax,
    thresholdsPassed: summary.thresholdsPassed,
  };
}

function matrixCsv(rows) {
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => csvValue(row[header])).join(","),
    ),
    "",
  ].join("\n");
}

function stepsCsv(results) {
  const rows = [];
  for (const summary of results) {
    for (const [step, values] of Object.entries(summary.steps || {})) {
      const serverTiming = summary.stepServerTiming?.[step] || {};
      const failures = summary.failureDiagnostics?.steps?.[step] || {};
      const requestCount = values.count || 0;
      const missingCount = serverTiming.missing?.count || 0;
      const failureCount = failures.total?.count || 0;
      rows.push({
        users: summary.config.users,
        step,
        count: values.count,
        averageMs: values.avg,
        p90Ms: values["p(90)"],
        p95Ms: values["p(95)"],
        p99Ms: values["p(99)"],
        maxMs: values.max,
        failureCount,
        failureRate:
          requestCount > 0 ? clampRatio(failureCount / requestCount) : null,
        transportFailureCount: failures.transport?.count || 0,
        clientFailureCount: failures.client?.count || 0,
        serverFailureCount: failures.server?.count || 0,
        unexpectedFailureCount: failures.unexpected?.count || 0,
        failureStatusMin: failures.status?.min,
        failureStatusMax: failures.status?.max,
        failureErrorCodeMin: failures.errorCode?.min,
        failureErrorCodeMax: failures.errorCode?.max,
        serverTimingCoverage:
          requestCount > 0 ? clampRatio(1 - missingCount / requestCount) : null,
        authAverageMs: serverTiming.auth?.avg,
        authP95Ms: serverTiming.auth?.["p(95)"],
        handlerAverageMs: serverTiming.handler?.avg,
        handlerP95Ms: serverTiming.handler?.["p(95)"],
        serverTotalAverageMs: serverTiming.total?.avg,
        serverTotalP95Ms: serverTiming.total?.["p(95)"],
      });
    }
  }
  const headers = Object.keys(rows[0] || { users: "", step: "" });
  return [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => csvValue(row[header])).join(","),
    ),
    "",
  ].join("\n");
}

function hostTelemetryCsv(results) {
  const rows = [];
  for (const summary of results) {
    for (const sample of summary.telemetry?.host?.samples || []) {
      rows.push({
        users: summary.config.users,
        atMs: sample.atMs,
        cpuUtilizationPercent: sample.cpuUtilizationPercent,
        usedMemoryBytes: sample.usedMemoryBytes,
        freeMemoryBytes: sample.freeMemoryBytes,
      });
    }
  }
  const headers = Object.keys(
    rows[0] || {
      users: "",
      atMs: "",
      cpuUtilizationPercent: "",
      usedMemoryBytes: "",
      freeMemoryBytes: "",
    },
  );
  return [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => csvValue(row[header])).join(","),
    ),
    "",
  ].join("\n");
}

function databaseTelemetryCsv(results) {
  const rows = [];
  for (const summary of results) {
    for (const sample of summary.telemetry?.database?.samples || []) {
      rows.push({
        users: summary.config.users,
        atMs: sample.atMs,
        totalConnections: sample.totalConnections,
        activeConnections: sample.activeConnections,
        idleConnections: sample.idleConnections,
        idleInTransactionConnections: sample.idleInTransactionConnections,
        waitingConnections: sample.waitingConnections,
      });
    }
  }
  const headers = Object.keys(
    rows[0] || {
      users: "",
      atMs: "",
      totalConnections: "",
      activeConnections: "",
      idleConnections: "",
      idleInTransactionConnections: "",
      waitingConnections: "",
    },
  );
  return [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => csvValue(row[header])).join(","),
    ),
    "",
  ].join("\n");
}

function matrixMarkdown(rows, configuration) {
  const environment = configuration.environment || {};
  const lines = [
    "# Sapling performance matrix",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "| Users | Workflows | Success | Requests/s | HTTP errors | HTTP avg | HTTP p95 | HTTP p99 | Workflow p95 | Thresholds |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :--- |",
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.users} | ${row.workflowsCompleted}/${row.workflowsExpected} | ${percent(row.workflowSuccessRate)} | ${decimal(row.requestsPerSecond, 1)} | ${percent(row.httpErrorRate)} | ${milliseconds(row.httpAverageMs)} | ${milliseconds(row.httpP95Ms)} | ${milliseconds(row.httpP99Ms)} | ${milliseconds(row.workflowP95Ms)} | ${row.thresholdsPassed ? "pass" : "fail"} |`,
    );
  }
  lines.push(
    "",
    "Use `steps.csv` to identify which API step grows most strongly as concurrency increases.",
    "",
    "## Test environment",
    "",
    `- Backend mode: ${environment.backendMode || "unknown"}${environment.backendModeDeclared ? " (declared)" : " (not declared)"}`,
    `- Authentication: ${environment.authMode || "unknown"} with ${environment.credentialCount ?? "unknown"} credential(s)`,
    `- DB pool: ${environment.dbPoolMin ?? "unknown"}–${environment.dbPoolMax ?? "unknown"}`,
    `- Request logging: console=${booleanText(environment.requestConsoleLogging)}, file=${booleanText(environment.requestFileLogging)}`,
    `- Security principal cache: TTL ${environment.securityPrincipalCacheTtlMs ?? "unknown"} ms, max ${environment.securityPrincipalCacheMaxEntries ?? "unknown"} entries`,
    `- Global search index: ${booleanText(environment.globalSearchIndexEnabled)}`,
    "",
    "## Diagnostics",
    "",
    "| Users | Server-Timing coverage | Auth p95 | Handler p95 | Server total p95 | Load-host CPU avg | Load-host CPU p95 | Load-host CPU max | Load-host memory max | DB active p95 | DB waiting max |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  );
  for (const row of rows) {
    lines.push(
      `| ${row.users} | ${percent(row.serverTimingCoverage)} | ${milliseconds(row.serverAuthP95Ms)} | ${milliseconds(row.serverHandlerP95Ms)} | ${milliseconds(row.serverTotalP95Ms)} | ${percentValue(row.hostCpuAveragePercent)} | ${percentValue(row.hostCpuP95Percent)} | ${percentValue(row.hostCpuMaxPercent)} | ${bytes(row.hostUsedMemoryMaxBytes)} | ${decimal(row.databaseActiveConnectionsP95, 1)} | ${decimal(row.databaseWaitingConnectionsMax, 0)} |`,
    );
  }
  lines.push(
    "",
    "## Request failure diagnostics",
    "",
    "| Users | Failed requests | Transport | HTTP 4xx | HTTP 5xx | Other | Status range | k6 error-code range |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | :--- | :--- |",
  );
  for (const row of rows) {
    lines.push(
      `| ${row.users} | ${row.requestFailureCount} | ${row.transportFailureCount} | ${row.clientFailureCount} | ${row.serverFailureCount} | ${row.unexpectedFailureCount} | ${metricRange(row.failureStatusMin, row.failureStatusMax)} | ${metricRange(row.failureErrorCodeMin, row.failureErrorCodeMax)} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function parseArguments(argumentsList) {
  const parsed = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!argument.startsWith("--")) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const [rawName, inlineValue] = argument.slice(2).split("=", 2);
    const name = rawName.replace(/-([a-z])/g, (_, letter) =>
      letter.toUpperCase(),
    );
    const value =
      inlineValue === undefined ? argumentsList[index + 1] : inlineValue;
    if (inlineValue === undefined) {
      index += 1;
    }
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${rawName}`);
    }
    parsed[name] = value;
  }
  return parsed;
}

function assertConfiguration(selectedEngine) {
  if (!["native", "docker"].includes(selectedEngine)) {
    configurationError("--engine must be native or docker.");
  }
  if (
    options.backendMode &&
    !["production", "development", "unknown"].includes(options.backendMode)
  ) {
    configurationError(
      "--backend-mode must be production, development, or unknown.",
    );
  }
  const authMode =
    process.env.SAPLING_AUTH_MODE ||
    (process.env.SAPLING_SESSION_COOKIES_JSON ? "session" : "bearer");
  if (!["bearer", "session"].includes(authMode)) {
    configurationError("SAPLING_AUTH_MODE must be bearer or session.");
  }
  if (authMode === "session" && !process.env.SAPLING_SESSION_COOKIES_JSON) {
    configurationError(
      "Set SAPLING_SESSION_COOKIES_JSON when SAPLING_AUTH_MODE=session.",
    );
  }
  if (
    authMode === "bearer" &&
    !process.env.SAPLING_TOKEN &&
    !process.env.SAPLING_TOKENS_JSON
  ) {
    configurationError(
      "Set SAPLING_TOKEN or SAPLING_TOKENS_JSON when SAPLING_AUTH_MODE=bearer.",
    );
  }
}

async function runWarmup() {
  console.log("\n=== warm-up workflow ===");
  const warmupFile = path.join(resultsDirectory, "warmup.json");
  const environment = buildEnvironment(1, 1, warmupFile, runId, engine);
  const command = buildCommand(engine, environment);
  const execution = await executeCommand(command, environment, false);
  if (execution.error || (execution.status !== 0 && execution.status !== 99)) {
    console.error(
      `Warm-up failed${execution.error ? `: ${execution.error.message}` : ` with exit code ${execution.status}`}.`,
    );
    return false;
  }
  return true;
}

async function executeCommand(command, environment, collectTelemetry) {
  const sampler = collectTelemetry ? await createTelemetrySampler() : null;
  return new Promise((resolve) => {
    let settled = false;

    const finish = async (result) => {
      if (settled) return;
      settled = true;
      resolve({
        ...result,
        telemetry: sampler ? await sampler.stop() : null,
      });
    };

    let child;
    try {
      child = spawn(command.executable, command.arguments, {
        cwd: scriptDirectory,
        env: environment,
        stdio: "inherit",
        windowsHide: true,
      });
    } catch (error) {
      void finish({ error, status: null, signal: null });
      return;
    }

    child.once("error", (error) => {
      void finish({ error, status: null, signal: null });
    });
    child.once("close", (status, signal) => {
      void finish({ error: null, status, signal });
    });
  });
}

async function createTelemetrySampler() {
  const host = createHostTelemetrySampler();
  const database = await createDatabaseTelemetrySampler();
  return {
    async stop() {
      let databaseTelemetry;
      try {
        databaseTelemetry = await database.stop();
      } catch (error) {
        databaseTelemetry = {
          available: false,
          reason: safeTelemetryError(error),
          samples: [],
          summary: null,
        };
      }
      return {
        ...host.stop(),
        database: databaseTelemetry,
      };
    },
  };
}

function createHostTelemetrySampler(sampleIntervalMs = 1000) {
  const startedAt = Date.now();
  const samples = [];
  let previousCpu = cpuTimes();

  const capture = () => {
    const currentCpu = cpuTimes();
    const totalDelta = currentCpu.total - previousCpu.total;
    const idleDelta = currentCpu.idle - previousCpu.idle;
    previousCpu = currentCpu;
    const freeMemoryBytes = os.freemem();
    const totalMemoryBytes = os.totalmem();
    samples.push({
      atMs: Date.now() - startedAt,
      cpuUtilizationPercent:
        totalDelta > 0
          ? clampPercent((1 - idleDelta / totalDelta) * 100)
          : null,
      usedMemoryBytes: totalMemoryBytes - freeMemoryBytes,
      freeMemoryBytes,
    });
  };

  const timer = setInterval(capture, sampleIntervalMs);
  return {
    stop() {
      clearInterval(timer);
      capture();
      return {
        host: {
          scope: "load-generator host",
          sampleIntervalMs,
          samples,
          summary: summarizeHostTelemetry(samples),
        },
      };
    },
  };
}

async function createDatabaseTelemetrySampler(sampleIntervalMs = 1000) {
  const startedAt = Date.now();
  const samples = [];
  let sampleErrors = 0;
  let lastError = null;
  const explicitlyEnabled = nullableBoolean(
    process.env.SAPLING_DATABASE_TELEMETRY,
  );
  if (explicitlyEnabled === false) {
    return unavailableDatabaseTelemetry(
      "Database telemetry was disabled through SAPLING_DATABASE_TELEMETRY.",
    );
  }
  if (explicitlyEnabled !== true && !isLocalBaseUrl(configuredBaseUrl)) {
    return unavailableDatabaseTelemetry(
      "Database telemetry is automatic only for a local API. Set SAPLING_DATABASE_TELEMETRY=true and provide DB_* environment variables for an intentional remote measurement.",
    );
  }
  const databaseUser = backendSetting("DB_USER");
  const databaseName = backendSetting("DB_NAME");
  if (!databaseUser || !databaseName) {
    return unavailableDatabaseTelemetry(
      "DB_USER or DB_NAME is not configured for the performance runner.",
    );
  }

  let client;
  try {
    const pgPath = path.resolve(
      scriptDirectory,
      "..",
      "backend",
      "node_modules",
      "pg",
      "lib",
      "index.js",
    );
    const pgModule = await import(pathToFileURL(pgPath).href);
    const Client = pgModule.default?.Client ?? pgModule.Client;
    client = new Client({
      host: backendSetting("DB_HOST") || "localhost",
      port: nullableInteger(backendSetting("DB_PORT")) || 5432,
      user: databaseUser,
      password: backendSetting("DB_PASSWORD") || undefined,
      database: databaseName,
      application_name: "sapling-performance-sampler",
      connectionTimeoutMillis: 2000,
      query_timeout: 2000,
      statement_timeout: 2000,
    });
    await client.connect();
  } catch (error) {
    const message = safeTelemetryError(error);
    console.warn(`Database telemetry unavailable: ${message}`);
    try {
      await client?.end();
    } catch {
      // The failed telemetry connection has no impact on the load test.
    }
    return unavailableDatabaseTelemetry(message);
  }

  let pendingCapture = Promise.resolve();
  const capture = () => {
    pendingCapture = pendingCapture.then(async () => {
      try {
        const result = await client.query(`
          select
            count(*)::int as "totalConnections",
            count(*) filter (where state = 'active')::int as "activeConnections",
            count(*) filter (where state = 'idle')::int as "idleConnections",
            count(*) filter (where state = 'idle in transaction')::int as "idleInTransactionConnections",
            count(*) filter (
              where state = 'active' and wait_event is not null
            )::int as "waitingConnections"
          from pg_stat_activity
          where datname = current_database()
            and application_name <> 'sapling-performance-sampler'
        `);
        const row = result.rows[0] || {};
        samples.push({
          atMs: Date.now() - startedAt,
          totalConnections: Number(row.totalConnections) || 0,
          activeConnections: Number(row.activeConnections) || 0,
          idleConnections: Number(row.idleConnections) || 0,
          idleInTransactionConnections:
            Number(row.idleInTransactionConnections) || 0,
          waitingConnections: Number(row.waitingConnections) || 0,
        });
      } catch (error) {
        sampleErrors += 1;
        lastError = safeTelemetryError(error);
      }
    });
    return pendingCapture;
  };

  await capture();
  const timer = setInterval(() => {
    void capture();
  }, sampleIntervalMs);

  return {
    async stop() {
      clearInterval(timer);
      await capture();
      try {
        await client.end();
      } catch (error) {
        sampleErrors += 1;
        lastError = safeTelemetryError(error);
      }
      return {
        available: true,
        scope: "current PostgreSQL database",
        sampleIntervalMs,
        samples,
        sampleErrors,
        lastError,
        summary: summarizeDatabaseTelemetry(samples),
      };
    },
  };
}

function unavailableDatabaseTelemetry(reason) {
  return {
    async stop() {
      return {
        available: false,
        reason,
        samples: [],
        summary: null,
      };
    },
  };
}

function summarizeDatabaseTelemetry(samples) {
  const metric = (name) =>
    samples.map((sample) => sample[name]).filter(Number.isFinite);
  const total = metric("totalConnections");
  const active = metric("activeConnections");
  const idle = metric("idleConnections");
  const idleInTransaction = metric("idleInTransactionConnections");
  const waiting = metric("waitingConnections");
  return {
    sampleCount: samples.length,
    durationMs: samples.at(-1)?.atMs ?? 0,
    totalConnectionsAverage: average(total),
    totalConnectionsMax: maximum(total),
    activeConnectionsAverage: average(active),
    activeConnectionsP95: percentile(active, 95),
    activeConnectionsMax: maximum(active),
    idleConnectionsAverage: average(idle),
    idleConnectionsMax: maximum(idle),
    idleInTransactionConnectionsMax: maximum(idleInTransaction),
    waitingConnectionsP95: percentile(waiting, 95),
    waitingConnectionsMax: maximum(waiting),
  };
}

function safeTelemetryError(error) {
  if (!(error instanceof Error)) return "unknown error";
  return `${error.name}: ${error.message.split(/\r?\n/, 1)[0]}`.slice(0, 300);
}

function cpuTimes() {
  return os.cpus().reduce(
    (result, cpu) => {
      const times = cpu.times;
      result.idle += times.idle;
      result.total +=
        times.user + times.nice + times.sys + times.idle + times.irq;
      return result;
    },
    { idle: 0, total: 0 },
  );
}

function summarizeHostTelemetry(samples) {
  const cpuValues = samples
    .map((sample) => sample.cpuUtilizationPercent)
    .filter(Number.isFinite);
  const memoryValues = samples
    .map((sample) => sample.usedMemoryBytes)
    .filter(Number.isFinite);
  return {
    sampleCount: samples.length,
    durationMs: samples.at(-1)?.atMs ?? 0,
    cpuAveragePercent: average(cpuValues),
    cpuP95Percent: percentile(cpuValues, 95),
    cpuMaxPercent: maximum(cpuValues),
    usedMemoryAverageBytes: average(memoryValues),
    usedMemoryP95Bytes: percentile(memoryValues, 95),
    usedMemoryMaxBytes: maximum(memoryValues),
  };
}

function average(values) {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function maximum(values) {
  return values.length > 0 ? Math.max(...values) : null;
}

function percentile(values, requestedPercentile) {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((left, right) => left - right);
  const index = ((sorted.length - 1) * requestedPercentile) / 100;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

function clampRatio(value) {
  return Math.max(0, Math.min(1, value));
}

function runtimeMetadata() {
  const backendMode =
    options.backendMode || process.env.SAPLING_BACKEND_MODE || "unknown";
  return {
    backendMode,
    backendModeDeclared: backendMode !== "unknown",
    platform: process.platform,
    architecture: process.arch,
    cpuModel: os.cpus()[0]?.model || "unknown",
    logicalCpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    dbPoolMin: nullableInteger(backendSetting("DB_POOL_MIN")),
    dbPoolMax: nullableInteger(backendSetting("DB_POOL_MAX")),
    requestConsoleLogging: nullableBoolean(
      backendSetting("LOG_REQUESTS_CONSOLE_ENABLED"),
    ),
    requestFileLogging: nullableBoolean(
      backendSetting("LOG_REQUESTS_FILE_ENABLED"),
    ),
    securityPrincipalCacheTtlMs: nullableInteger(
      backendSetting("SECURITY_PRINCIPAL_CACHE_TTL_MS"),
    ),
    securityPrincipalCacheMaxEntries: nullableInteger(
      backendSetting("SECURITY_PRINCIPAL_CACHE_MAX_ENTRIES"),
    ),
    globalSearchIndexEnabled: nullableBoolean(
      backendSetting("GLOBAL_SEARCH_INDEX_ENABLED"),
    ),
    metadataSources: {
      backendMode: options.backendMode
        ? "cli"
        : process.env.SAPLING_BACKEND_MODE
          ? "process-environment"
          : "unknown",
      backendConfiguration:
        isLocalBaseUrl(configuredBaseUrl) && existsSync(backendEnvironment.path)
          ? "backend/.env with process-environment overrides"
          : "process-environment only",
    },
    authMode:
      process.env.SAPLING_AUTH_MODE ||
      (process.env.SAPLING_SESSION_COOKIES_JSON ? "session" : "bearer"),
    credentialCount: credentialCount(),
  };
}

function backendSetting(name) {
  return (
    process.env[name] ??
    (isLocalBaseUrl(configuredBaseUrl)
      ? backendEnvironment.values[name]
      : undefined)
  );
}

function isLocalBaseUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return ["localhost", "127.0.0.1", "::1"].includes(hostname);
  } catch {
    return false;
  }
}

function readBackendEnvironment() {
  const environmentPath = path.resolve(
    scriptDirectory,
    "..",
    "backend",
    ".env",
  );
  const values = {};
  if (!existsSync(environmentPath)) {
    return { path: environmentPath, values };
  }

  for (const rawLine of readFileSync(environmentPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const name = line.slice(0, separator).trim();
    if (!BACKEND_ENVIRONMENT_KEYS.has(name)) continue;
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[name] = value;
  }
  return { path: environmentPath, values };
}

function credentialCount() {
  const json =
    process.env.SAPLING_SESSION_COOKIES_JSON || process.env.SAPLING_TOKENS_JSON;
  if (!json) return process.env.SAPLING_TOKEN ? 1 : 0;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function nullableInteger(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function nullableBoolean(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function configurationError(message) {
  console.error(`Configuration error: ${message}`);
  process.exit(2);
}

function parsePositiveIntegerList(value, fallback) {
  if (!value) {
    return fallback;
  }
  const parsed = String(value)
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10));
  if (
    parsed.length === 0 ||
    parsed.some((item) => !Number.isInteger(item) || item <= 0)
  ) {
    throw new Error(
      "The user matrix must be a comma-separated list of positive integers.",
    );
  }
  return [...new Set(parsed)];
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function dockerBaseUrl(baseUrl) {
  return baseUrl
    .replace("://localhost", "://host.docker.internal")
    .replace("://127.0.0.1", "://host.docker.internal");
}

function csvValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function percent(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "n/a";
}

function percentValue(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : "n/a";
}

function booleanText(value) {
  return value === true ? "enabled" : value === false ? "disabled" : "unknown";
}

function bytes(value) {
  if (!Number.isFinite(value)) return "n/a";
  const gibibytes = value / 1024 ** 3;
  return `${gibibytes.toFixed(2)} GiB`;
}

function milliseconds(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} ms` : "n/a";
}

function decimal(value, digits) {
  return Number.isFinite(value) ? value.toFixed(digits) : "n/a";
}

function metricRange(minimum, maximumValue) {
  if (!Number.isFinite(minimum) || !Number.isFinite(maximumValue)) {
    return "n/a";
  }
  return minimum === maximumValue
    ? String(minimum)
    : `${minimum}–${maximumValue}`;
}
