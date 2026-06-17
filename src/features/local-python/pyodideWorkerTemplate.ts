// This string stays as plain worker JavaScript because Pyodide needs a runtime base URL before importScripts().
// __PYODIDE_BASE_URL__ is replaced by buildPyodideWorkerScript at runtime.
export const PYODIDE_WORKER_CODE_TEMPLATE = `
const PYODIDE_BASE_URL = "__PYODIDE_BASE_URL__";
importScripts(PYODIDE_BASE_URL + "pyodide.js");

let pyodide = null;
let pyodideReadyPromise = null;

async function loadPyodideAndPackages() {
  if (!pyodide) {
    pyodide = await loadPyodide({
      indexURL: PYODIDE_BASE_URL,
    });
    await pyodide.loadPackage(['micropip', 'pandas', 'numpy', 'matplotlib']);
  }
  return pyodide;
}

function getMimeType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const mimeMap = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
    py: 'text/x-python',
    js: 'text/javascript',
    html: 'text/html',
    md: 'text/markdown',
    pdf: 'application/pdf',
    zip: 'application/zip',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

// FS.readFile returns a Uint8Array view that may share a larger backing buffer;
// copy the bytes into an exact-sized standalone ArrayBuffer so it can be
// transferred back to the main thread without dragging unrelated bytes along.
function ensureArrayBuffer(data) {
    const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

function normalizeErrorMessage(error) {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error.message === 'string') return error.message;
    return String(error);
}

function ensureDir(path) {
    const segments = path.split('/').filter(Boolean);
    let current = '';
    for (const segment of segments) {
        current += '/' + segment;
        try {
            pyodide.FS.mkdir(current);
        } catch (error) {
            if (error && error.errno === 20) {
                continue;
            }
            throw error;
        }
    }
}

function removePath(path) {
    try {
        const stat = pyodide.FS.stat(path);
        if (pyodide.FS.isDir(stat.mode)) {
            const entries = pyodide.FS.readdir(path);
            for (const entry of entries) {
                if (entry === '.' || entry === '..') continue;
                removePath(path + '/' + entry);
            }
            pyodide.FS.rmdir(path);
            return;
        }
        pyodide.FS.unlink(path);
    } catch (error) {
        // Best-effort cleanup
    }
}

function listFilesRecursively(currentPath) {
    const files = [];
    const entries = pyodide.FS.readdir(currentPath);
    for (const entry of entries) {
        if (entry === '.' || entry === '..') continue;
        const absolutePath = currentPath === '.' ? './' + entry : currentPath + '/' + entry;
        const stat = pyodide.FS.stat(absolutePath);
        if (pyodide.FS.isDir(stat.mode)) {
            files.push(...listFilesRecursively(absolutePath));
        } else if (pyodide.FS.isFile(stat.mode)) {
            const relativePath = absolutePath.replace(/^\\.\\//, '');
            files.push(relativePath);
        }
    }
    return files;
}

async function installDependencies(code) {
    try {
        // loadPackagesFromImports parses the code's import statements (AST-level,
        // not substring matching) and loads every importable package from the
        // Pyodide lock file. Pyodide de-dupes packages already loaded at init,
        // so this is a no-op for the preloaded set.
        await pyodide.loadPackagesFromImports(code);
    } catch (dependencyError) {
        const message = normalizeErrorMessage(dependencyError);
        if (/No known package|not found|could not find|unknown package/i.test(message)) {
            throw new Error("A requested dependency is not available in the browser Pyodide environment: " + message);
        }
        throw new Error("Dependency download failed, please retry: " + message);
    }
}

self.onmessage = async (event) => {
  const { type, id, code, files } = event.data;

  try {
    if (!pyodideReadyPromise) {
      pyodideReadyPromise = loadPyodideAndPackages();
    }
    await pyodideReadyPromise;

    if (type === 'WARMUP') {
      // No code to run; just ensure the runtime + packages are loaded so the
      // next real execution skips the cold load.
      self.postMessage({ status: 'success', type: 'WARMUP_READY' });
      return;
    }

    const previousDir = pyodide.FS.cwd();
    const runDir = '/tmp/local-python-' + id;

    removePath(runDir);
    ensureDir(runDir);

    let result;
    const transferBuffers = [];

    try {
      if (files && Array.isArray(files)) {
          for (const file of files) {
              const normalizedName = String(file.name || '').replace(/^\\/+/, '');
              if (!normalizedName) continue;
              const parentDir = normalizedName.includes('/')
                  ? runDir + '/' + normalizedName.split('/').slice(0, -1).join('/')
                  : runDir;
              ensureDir(parentDir);
              pyodide.FS.writeFile(runDir + '/' + normalizedName, new Uint8Array(file.data));
          }
      }

      pyodide.FS.chdir(runDir);

      const initialFiles = new Set();
      try {
          const fsFiles = listFilesRecursively(runDir);
          for (const file of fsFiles) initialFiles.add(file);
      } catch (initialListError) {
        // Listing the starting file set is best-effort; an empty dir is fine.
      }

      let stdout = [];
      pyodide.setStdout({ batched: (msg) => stdout.push(msg) });
      pyodide.setStderr({ batched: (msg) => stdout.push(msg) });

      await installDependencies(code);

      // Reset matplotlib state carried over from any prior run before executing.
      await pyodide.runPythonAsync(\`
        try:
          import matplotlib
          matplotlib.use("Agg")
          import matplotlib.pyplot as plt
          plt.close('all')
        except ImportError:
          pass
      \`);

      result = await pyodide.runPythonAsync(code);

      const generatedOutputFiles = [];
      try {
          const finalFiles = listFilesRecursively(runDir);
          for (const filePath of finalFiles) {
              if (!initialFiles.has(filePath)) {
                   const content = pyodide.FS.readFile(filePath);
                   const fileBuffer = ensureArrayBuffer(content);
                   generatedOutputFiles.push({
                       name: filePath,
                       data: fileBuffer,
                       type: getMimeType(filePath)
                   });
                   transferBuffers.push(fileBuffer);
              }
          }
      } catch (outputError) {
          console.error("Error reading output files", normalizeErrorMessage(outputError));
      }

      let image = null;
      const hasPlot = pyodide.runPython(\`
        try:
          import matplotlib.pyplot as plt
          len(plt.get_fignums()) > 0
        except:
          False
      \`);

      if (hasPlot) {
          const plotPath = runDir + '/__matplotlib_plot__.png';
          pyodide.runPython(
              "import matplotlib.pyplot as plt\\n" +
              "plt.savefig(" + JSON.stringify(plotPath) + ", format='png', bbox_inches='tight')\\n" +
              "plt.close('all')"
          );
          try {
              const content = pyodide.FS.readFile(plotPath);
              image = ensureArrayBuffer(content);
              pyodide.FS.unlink(plotPath);
          } catch (plotReadError) {
              // best-effort plot extraction
          }
      }

      if (image && generatedOutputFiles.some((file) => file.type.startsWith('image/'))) {
          image = null;
      } else if (image) {
          transferBuffers.push(image);
      }

      self.postMessage({
        id,
        status: 'success',
        output: stdout.join('\\n'),
        image,
        files: generatedOutputFiles,
        result: result !== undefined ? String(result) : undefined
      }, transferBuffers);
    } finally {
      try {
          pyodide.runPython(
              "try:\\n" +
              "    import matplotlib.pyplot as plt\\n" +
              "    plt.close('all')\\n" +
              "    plt.rcdefaults()\\n" +
              "except Exception:\\n" +
              "    pass"
          );
      } catch (cleanupError) {
          // best-effort isolation cleanup between runs
      }
      try {
          pyodide.FS.chdir(previousDir);
      } catch (error) {
          // ignore best-effort restore
      }
      removePath(runDir);
    }

  } catch (executionError) {
    self.postMessage({ id, status: 'error', error: normalizeErrorMessage(executionError) });
  }
};
`;
