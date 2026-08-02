import { XeLaTeXCompiler, XeLaTeXCompileError } from "@arnon3339/thtex";

export interface CompileProgress {
  message: string;
  loadedBytes?: number;
  totalBytes?: number;
}

export interface CompileOutcome {
  pdf: ArrayBuffer;
  log: string;
}

// Spec §7.6 step 1: lazy-load the engine on first use, not at app start —
// the WASM + TeX Live runtime is tens of MB.
let compiler: XeLaTeXCompiler | undefined;

function getCompiler(onStatus?: (p: CompileProgress) => void): XeLaTeXCompiler {
  compiler ??= new XeLaTeXCompiler({
    assetBaseUrl: `${import.meta.env.BASE_URL}xelatex/`,
    defaultPasses: 1,
    onStatus: (e) => onStatus?.({ message: e.message, loadedBytes: e.loadedBytes, totalBytes: e.totalBytes }),
  });
  return compiler;
}

/** Spec §7.6 step 4: rerun once more if the log asks for a cross-reference pass. */
const NEEDS_RERUN = /rerun to get (cross-references|.*) right/i;

export async function renderLatexToPdf(
  source: string,
  onStatus?: (p: CompileProgress) => void,
): Promise<CompileOutcome> {
  const instance = getCompiler(onStatus);
  await instance.ready;

  let result;
  try {
    result = await instance.compile(source, { passes: 1 });
  } catch (err) {
    if (err instanceof XeLaTeXCompileError) {
      return { pdf: new ArrayBuffer(0), log: err.log };
    }
    throw err;
  }

  if (NEEDS_RERUN.test(result.log)) {
    try {
      result = await instance.compile(source, { passes: 2 });
    } catch (err) {
      if (err instanceof XeLaTeXCompileError) {
        return { pdf: new ArrayBuffer(0), log: err.log };
      }
      throw err;
    }
  }

  return { pdf: result.pdf, log: result.log };
}

export function disposeCompiler(): void {
  compiler?.dispose();
  compiler = undefined;
}
