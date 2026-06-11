// MATLAB Studio — LLM-side reference and parsing.
//
// Mirrors the GeoGebra Math Studio design: a curated, real-function
// cheat-sheet is injected into the system prompt so the model emits valid
// base-MATLAB scripts, the reply's fenced ```matlab block is parsed out, and
// a repair prompt feeds engine errors back verbatim. Execution goes through
// the OFFICIAL MathWorks MCP server (matlab/matlab-mcp-core-server) — see
// lib/workplace/matlab/mcp-client.ts for the tool names we call.

export const MATLAB_REFERENCE = `MATLAB FUNCTION REFERENCE (base MATLAB — one runnable script)

MATRICES & LINEAR ALGEBRA
  A=[1 2; 3 4]   zeros(n)   ones(m,n)   eye(n)   rand(m,n)   randn(m,n)
  linspace(a,b,n)   a:step:b   reshape(A,m,n)   A'   inv(A)   pinv(A)
  A\\b  (solve Ax=b)   det(A)   rank(A)   trace(A)   norm(A)
  [V,D]=eig(A)   [U,S,V]=svd(A)   [Q,R]=qr(A)   [L,U,P]=lu(A)
  size(A)   numel(A)   length(v)   sum(A)   prod(A)   cumsum(v)   diff(v)
  max(A)   min(A)   mean(A)   median(A)   std(A)   var(A)   sort(v)
  find(cond)   any(v)   all(v)   abs(x)   round/floor/ceil(x)   mod(a,b)

PLOTTING (always label; end figures with grid on)
  figure; plot(x, y, 'LineWidth', 1.5)
  hold on … hold off      legend('a','b','Location','best')
  xlabel('x'); ylabel('y'); title('…');  grid on;  axis equal
  scatter(x,y,sz)   bar(x,y)   histogram(data,nbins)   stairs   stem
  semilogx / semilogy / loglog     errorbar(x,y,e)
  subplot(m,n,k)  or  tiledlayout(m,n); nexttile
  fplot(@(x) sin(x)./x, [-10 10])     fimplicit(@(x,y) x.^2+y.^2-4)
  3D: plot3(x,y,z)   surf(X,Y,Z)   mesh(X,Y,Z)   contour(X,Y,Z,20)
      [X,Y]=meshgrid(-3:0.1:3);  Z=peaks(…)   colormap turbo; colorbar
  polarplot(theta,rho)   quiver(X,Y,U,V)   fill(x,y,c)

NUMERICAL METHODS
  roots([1 0 -2 5])   polyfit(x,y,n)   polyval(p,x)   interp1(x,v,xq,'spline')
  fzero(@(x) f(x), x0)   fminsearch(@(x) f(x), x0)   fminbnd(f,a,b)
  integral(@(x) f(x), a, b)   integral2   trapz(x,y)   cumtrapz
  ODE: [t,y]=ode45(@(t,y) f(t,y), [t0 tf], y0);   ode23s for stiff
  gradient(y,x)   conv(a,b)   fft(x)   abs(fft(x))/N for spectra

SYMBOLIC (Symbolic Math Toolbox — only when asked for exact algebra)
  syms x y;  f=x^2+3*x;  diff(f,x)   int(f,x)   solve(f==0,x)
  simplify(expr)   expand   factor   limit(f,x,0)   taylor(f,x)
  subs(f,x,2)   double(sym)   vpa(expr,8)   latex(expr)

PROGRAMMING
  function out = name(in) … end   (define AFTER the script body)
  if/elseif/else … end   for k=1:n … end   while … end
  fprintf('x = %.4f\\n', x)   disp(msg)   num2str   sprintf
  try … catch err; disp(err.message); end
  v(end)   v(2:end-1)   logical indexing v(v>0)
  arrayfun(@(x) f(x), v)   cellfun   struct('a',1)   containers.Map

STRINGS & I/O
  "double-quoted string"   strcat   strsplit   strrep   contains
  readmatrix('f.csv')   writematrix(A,'f.csv')   readtable   writetable
  exportgraphics(gcf,'fig.png','Resolution',200)`;

export const MATLAB_RULES = `═══ OUTPUT CONTRACT ═══
- Reply with a SHORT explanation (≤3 sentences, same language as the user) and then EXACTLY ONE fenced code block tagged \`\`\`matlab containing ONE complete, runnable script.
- The script must run top-to-bottom in base MATLAB with no undefined names. Local functions go at the END of the script.
- Plots: every figure gets xlabel/ylabel/title/grid on. Prefer fplot/fimplicit for analytic curves.
- Print numeric answers with fprintf so the console output IS the result.
- Use ONLY base MATLAB unless the user explicitly mentions a toolbox (Symbolic, Signal, Stats…). If a toolbox is essential, say so in the prose and still provide the closest base-MATLAB alternative in the script when feasible.
- Never use \`clear all\`/\`close all force\`/\`system(...)\`/\`!cmd\`/\`delete(...)\`/\`rmdir\`/\`web(...)\` — scripts must be side-effect-free beyond figures and printed output.
- Vectorise (x.^2, element-wise ops); avoid growing arrays in loops.`;

export function buildMatlabSystemPrompt(): string {
  return [
    'You are MATLAB Studio: an expert MATLAB engineer embedded in a web workbench. ' +
    'The user describes a computation, simulation, analysis or plot; you answer with one runnable script. ' +
    'The script may be executed verbatim through the official MATLAB MCP server, so correctness matters more than brevity.',
    MATLAB_RULES,
    MATLAB_REFERENCE,
  ].join('\n\n');
}

/** Repair prompt: the engine's exact error, the code, fix-and-return-one-block. */
export function buildMatlabRepairPrompt(): string {
  return [
    'You are MATLAB Studio\'s repair pass. The script below failed when executed by a real MATLAB engine. ' +
    'Fix the EXACT reported problem with the smallest coherent change and return the FULL corrected script as ONE ```matlab block. ' +
    'Do not switch approach unless the error makes the approach impossible.',
    MATLAB_RULES,
  ].join('\n\n');
}

export function formatMatlabRepairContent(code: string, errorText: string): string {
  return `Script that was run:
\`\`\`matlab
${code}
\`\`\`

MATLAB reported:
${errorText}

Return the full corrected script as ONE \`\`\`matlab block.`;
}

/** Commands that must never reach the engine (defence in depth — the MCP
 *  server runs with the user's own license/files). */
const DANGEROUS = /(^|\n)\s*(!|system\s*\(|delete\s+|delete\s*\(|rmdir|fclose\s*\(\s*'all'|web\s*\(|urlread|websave|setenv|winopen|unzip\s*\(|movefile|copyfile)/i;

export function matlabCodeIsSafe(code: string): boolean {
  return !DANGEROUS.test(code);
}

/** Extract the LAST fenced matlab block from an assistant reply. */
export function parseMatlabBlock(text: string): string {
  const re = /```(?:matlab|m|octave)\s*\n([\s\S]*?)```/gi;
  const matches = [...text.matchAll(re)];
  if (matches.length > 0) return matches[matches.length - 1][1].trim();
  // unterminated fence while streaming
  const open = text.match(/```(?:matlab|m|octave)\s*\n([\s\S]*)$/i);
  if (open) return open[1].trim();
  return '';
}

/** Paste-ready destination for the visitor's free MATLAB Online account. */
export const MATLAB_ONLINE_URL = 'https://matlab.mathworks.com/';
