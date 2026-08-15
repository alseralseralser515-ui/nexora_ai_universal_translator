import { spawn } from "node:child_process";

const env = { ...process.env, NODE_ENV: "development" };
const backend = spawn("pnpm", ["dev:server"], { stdio: ["inherit", "pipe", "pipe"], env });
let metro;
let started = false;

const startMetro = (port) => {
  if (started) return;
  started = true;
  const metroEnv = { ...env, EXPO_PUBLIC_API_BASE_URL: env.EXPO_PUBLIC_API_BASE_URL ?? `http://localhost:${port}` };
  metro = spawn("pnpm", ["dev:metro"], { stdio: "inherit", env: metroEnv });
  metro.on("exit", (code, signal) => shutdown(code ?? (signal ? 1 : 0)));
};

const handleOutput = (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  const match = text.match(/server listening on port (\d+)/);
  if (match) startMetro(Number(match[1]));
};
backend.stdout.on("data", handleOutput);
backend.stderr.on("data", (chunk) => process.stderr.write(chunk));
backend.on("exit", (code) => {
  if (!started) shutdown(code ?? 1);
});

const shutdown = (code = 0) => {
  if (backend.exitCode === null) backend.kill("SIGTERM");
  if (metro && metro.exitCode === null) metro.kill("SIGTERM");
  process.exitCode = code;
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
