/**
 * The harness contract — `parity.json` beside the programs.
 *
 * Parity owns the legacy leg: it compiles the COBOL itself, because it needs a
 * second, instrumented build for coverage. The modern leg is any language: a
 * build command and a run command.
 *
 * Both legs speak the same protocol: one delimited record per line on stdin,
 * one delimited result per line on stdout. Real batch programs read files;
 * a thin driver adapts them. That constraint is stated, not hidden.
 */

import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { parseCobol, type CobolProgram } from "./cobol/parse.js";

export interface InputDecl {
  /** A data item in the COBOL program; its PIC defines the input domain. */
  name: string;
  /** For text fields: the values worth trying. Harvested literals are added. */
  values?: string[];
}

export interface Contract {
  name: string;
  dir: string;
  legacy: { source: string; dialect: string };
  modern: { build?: string; run: string; label?: string };
  inputs: InputDecl[];
  outputs: string[];
  delimiter: string;
}

export interface Loaded {
  contract: Contract;
  program: CobolProgram;
  legacyBin: string;
  tracedBin: string;
  modernRun: string;
  workDir: string;
}

export function loadContract(dir: string): Contract {
  const abs = resolve(dir);
  const file = join(abs, "parity.json");
  if (!existsSync(file)) throw new Error(`parity: no parity.json in ${abs}`);
  const raw = JSON.parse(readFileSync(file, "utf8"));
  return {
    name: raw.name ?? "program",
    dir: abs,
    legacy: { source: raw.legacy.source, dialect: raw.legacy.dialect ?? "ibm" },
    modern: raw.modern,
    inputs: raw.inputs,
    outputs: raw.outputs,
    delimiter: raw.delimiter ?? ",",
  };
}

function sh(cmd: string, cwd: string): void {
  try {
    execSync(cmd, { cwd, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, JAVA_TOOL_OPTIONS: "" } });
  } catch (err) {
    const e = err as { stderr?: Buffer; message: string };
    throw new Error(`parity: build failed: ${cmd}\n${e.stderr?.toString() ?? e.message}`);
  }
}

export function prepare(dir: string): Loaded {
  const contract = loadContract(dir);
  const workDir = join(contract.dir, ".parity");
  mkdirSync(join(workDir, "build"), { recursive: true });

  const src = join(contract.dir, contract.legacy.source);
  const program = parseCobol(readFileSync(src, "utf8"));

  for (const name of [...contract.inputs.map((i) => i.name), ...contract.outputs]) {
    if (!program.items.has(name)) {
      throw new Error(`parity: "${name}" is not a data item with a PICTURE in ${contract.legacy.source}`);
    }
  }

  const legacyBin = join(workDir, "build", "legacy");
  const tracedBin = join(workDir, "build", "legacy-traced");
  const std = `-std=${contract.legacy.dialect}`;
  sh(`cobc -x ${std} -o "${legacyBin}" "${src}"`, contract.dir);
  sh(`cobc -x ${std} -ftraceall -o "${tracedBin}" "${src}"`, contract.dir);
  if (contract.modern.build) sh(contract.modern.build, contract.dir);

  return { contract, program, legacyBin, tracedBin, modernRun: contract.modern.run, workDir };
}
