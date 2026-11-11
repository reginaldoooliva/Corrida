// T43 local UAT walk: drives the real app UI only (no DB writes), advancing a fake clock
// (APP_NOW) by restarting `next start` between steps. Reads the DB only to report the decision.
// Usage (project root, after `npm run build`, dev DB in .env): node scripts/uat-walk.mjs
// WALK_BASE=YYYY-MM-DD (a Monday, default 2028-03-06) picks the walk's first day; it must be past
// the race date of any plan the dev DB still has active, so that plan archives on its own.
// Screenshots go to test-results/uat-walk/.
import { createRequire } from "node:module";
import { spawn, execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const ROOT = process.cwd();
const require = createRequire(`${ROOT}/package.json`);
const { chromium } = require("@playwright/test");
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(ROOT);
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const SHOTS = `${ROOT}/test-results/uat-walk/`;
mkdirSync(SHOTS, { recursive: true });
const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
const results = [];
// Day n of the walk (local time, UTC-3), counted from WALK_BASE (a Monday).
const BASE_DAY = new Date(`${process.env.WALK_BASE ?? "2028-03-06"}T00:00:00Z`);
const day = (n) => new Date(BASE_DAY.getTime() + n * 86400000).toISOString().slice(0, 10);
const at = (n, hhmm) => `${day(n)}T${hhmm}:00-03:00`;
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
};

let server;
function stopServer() {
  if (process.platform === "win32") execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" });
  else server.kill("SIGTERM");
}
async function startServer(appNow) {
  if (server) {
    stopServer();
    await new Promise((r) => setTimeout(r, 1500));
  }
  server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: ROOT,
    env: { ...process.env, APP_NOW: appNow, NODE_ENV: "production" },
    shell: true,
    stdio: "ignore",
  });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/login`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("server did not start");
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const shot = (name) => page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true });

async function login() {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Usuário").fill(process.env.SEED_USERNAME);
  await page.getByLabel("Senha").fill(process.env.SEED_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/dashboard/);
}

async function weekDistances() {
  const rows = page.locator("main ul > li");
  const out = [];
  for (const text of await rows.allInnerTexts()) {
    const m = text.match(/([\d.]+)km/);
    out.push({ text: text.split("\n")[0], km: m ? Number(m[1]) : NaN });
  }
  return out;
}

try {
  // --- Criterion 1: 10km plan from a manual 5km time, in under 5 minutes -------------------
  await startServer(at(0, "08:00")); // Monday; any earlier active plan is past race day
  const t0 = Date.now();
  await login();
  await shot("01-dashboard-start");
  await page.goto(`${BASE}/plan/new/vdot`);
  await page.getByRole("link", { name: /tempo de prova recente/i }).click();
  await page.getByLabel("Distância (km)").fill("5");
  await page.getByLabel("Minutos").fill("19");
  await page.getByLabel("Segundos").fill("57");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.waitForURL(/\/plan\/new\?/);
  await page.getByRole("radio", { name: "10km", exact: true }).check();
  await page.getByLabel("Data da prova").fill(day(70));
  for (const d of ["Seg", "Qua", "Sáb"]) await page.getByRole("checkbox", { name: d }).check();
  await page.getByRole("button", { name: "Criar plano" }).click();
  await page.getByRole("heading", { name: "Plano criado" }).waitFor({ timeout: 60000 });
  const elapsed = (Date.now() - t0) / 1000;
  const weeks = await page.locator("main ol > li").allInnerTexts();
  await shot("02-plan-created");
  const phases = weeks.map((w) => w.split("— ")[1]);
  check("C1: plano de 10km criado a partir de 5km manual", weeks.length === 10, `${weeks.length} semanas: ${phases.join(", ")}`);
  check("C1: fases em ordem Base→Construção→Pico→Polimento", phases.join(",") === [...phases].sort((a, b) => ["Base", "Construção", "Pico", "Polimento"].indexOf(a) - ["Base", "Construção", "Pico", "Polimento"].indexOf(b)).join(",") && phases.at(-1) === "Polimento");
  check("C1: em menos de 5 minutos", elapsed < 300, `${elapsed.toFixed(0)}s`);

  // --- Criterion 2: a fatigued week 1 -> reduce, week 2 visibly lighter ---------------------
  await startServer(at(6, "20:00")); // Sunday evening, week 1 still current
  await login();
  const week1 = await weekDistances();
  await shot("03-week1-before-logging");
  const rows = await page.locator("main ul > li").count();
  for (let i = 0; i < rows; i++) {
    const row = page.locator("main ul > li").nth(i);
    const text = await row.innerText();
    const [, mm, ss] = text.match(/Pace planejado:\s*(\d+):(\d+)/);
    const planned = Number(mm) * 60 + Number(ss);
    const slow = Math.round(planned * 1.1); // 10% slower than target
    const km = Number(text.match(/([\d.]+)km/)[1]);
    await row.getByRole("link", { name: "Registrar treino" }).click();
    await page.getByLabel(/Pace/).fill(`${Math.floor(slow / 60)}:${String(slow % 60).padStart(2, "0")}`);
    await page.getByLabel("Distância (km)").fill(String(km));
    await page.getByLabel("Duração (min)").fill(String(Math.round((km * slow) / 60)));
    await page.getByRole("radio", { name: /^RPE 9:/ }).check();
    await page.getByRole("button", { name: "Salvar registro" }).click();
    await page.waitForURL(/\/dashboard$/);
  }
  await shot("04-week1-logged");
  const doneCount = await page.locator("main ul > li", { hasText: "Feito" }).count();
  check("C2: as 3 sessões da semana 1 registradas (RPE 9, pace 10% mais lento)", doneCount === rows, `${doneCount}/${rows}`);

  await startServer(at(7, "08:00")); // Monday: week 1 has ended
  await login();
  await page.getByRole("heading", { name: "Semana 2" }).waitFor({ timeout: 60000 });
  const week2 = await weekDistances();
  await shot("05-week2-after-reduce");
  const total = (w) => w.reduce((s, x) => s + x.km, 0);
  const adj = await prisma.weeklyAdjustment.findFirst({
    where: { week: { weekNumber: 1, plan: { status: "ACTIVE" } } },
    orderBy: { id: "desc" },
  });
  check("C2: decisão da semana 1 é REDUCE", adj?.decision === "REDUCE", `decision=${adj?.decision} adjustmentPct=${adj?.adjustmentPct}`);
  check("C2: semana 2 visivelmente mais leve", total(week2) < total(week1), `semana 1 ${total(week1).toFixed(1)}km -> semana 2 ${total(week2).toFixed(1)}km`);

  // --- 4 weeks later: retest prompt ------------------------------------------------------------
  await startServer(at(28, "08:00"));
  await login();
  const retest = page.getByRole("region", { name: "Aviso de reteste de VDOT" });
  await page.waitForLoadState("networkidle");
  await shot("06-retest-prompt");
  check("Reteste: aviso aparece após 4 semanas", await retest.count() === 1);
  if (await retest.count()) {
    await retest.getByRole("button", { name: "Agora não" }).click();
    await retest.waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
    check("Reteste: 'Agora não' esconde o aviso", (await retest.count()) === 0);
  }

  // --- Criterion 3: race day, result, new plan --------------------------------------------------
  await startServer(at(70, "08:00")); // race day: still active
  await login();
  await page.waitForLoadState("networkidle");
  await shot("07-race-day");
  check("C3: no dia da prova o plano ainda está ativo", (await page.getByRole("heading", { name: /^Semana \d+$/ }).count()) === 1);

  await startServer(at(71, "08:00")); // day after: archived, result prompt
  await login();
  const prompt = page.getByRole("region", { name: "Aviso de resultado de prova" });
  await prompt.waitFor({ timeout: 60000 });
  await shot("08-race-result-prompt");
  await prompt.getByLabel("Horas").fill("0");
  await prompt.getByLabel("Minutos").fill("41");
  await prompt.getByLabel("Segundos").fill("30");
  await prompt.getByRole("button", { name: "Salvar resultado" }).click();
  await prompt.waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
  await shot("09-after-result");
  check("C3: resultado da prova salvo (aviso some)", (await prompt.count()) === 0);
  await page.getByRole("link", { name: "Criar um novo plano" }).click();
  const vdotField = page.getByLabel("VDOT inicial");
  await vdotField.waitFor();
  const carried = await vdotField.inputValue();
  await shot("10-new-plan-carry-over");
  check("C3: novo plano já vem com o VDOT herdado", Number(carried) > 0, `VDOT inicial ${carried}`);
  await page.getByRole("radio", { name: /21km/ }).check();
  await page.getByLabel("Data da prova").fill(day(181));
  for (const d of ["Seg", "Qua", "Sex", "Sáb"]) await page.getByRole("checkbox", { name: d }).check();
  await page.getByRole("button", { name: "Criar plano" }).click();
  await page.getByRole("heading", { name: "Plano criado" }).waitFor({ timeout: 60000 });
  await shot("11-new-plan-created");
  await page.getByRole("link", { name: "Ir para o painel" }).click();
  await page.getByRole("heading", { name: "Semana 1" }).waitFor();
  await page.getByRole("navigation", { name: "Seções" }).getByRole("link", { name: "Histórico" }).click();
  await page.getByRole("heading", { name: "Histórico" }).waitFor();
  await shot("12-history");
  check("C3: novo plano criado e histórico lista o plano arquivado", (await page.getByRole("link", { name: /arquivado/ }).count()) >= 1);
} catch (e) {
  console.log("ERROR", e.message.split("\n")[0]);
  await shot("99-error").catch(() => {});
  results.push({ name: "walk completed", ok: false });
} finally {
  await browser.close();
  if (server) stopServer();
  await prisma.$disconnect();
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
  process.exitCode = results.every((r) => r.ok) ? 0 : 1;
}
