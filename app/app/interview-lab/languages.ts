/**
 * app/app/interview-lab/languages.ts
 *
 * Language catalogue for the coding-test answer editor. `value` is a short
 * code-fence tag (so the evaluator sees the language), `label` is the display
 * name. Ordered roughly by popularity, then alphabetical.
 */
export interface CodeLanguage {
  value: string;
  label: string;
}

export const CODE_LANGUAGES: CodeLanguage[] = [
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "kotlin", label: "Kotlin" },
  { value: "swift", label: "Swift" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "scala", label: "Scala" },
  { value: "dart", label: "Dart" },
  { value: "r", label: "R" },
  { value: "matlab", label: "MATLAB" },
  { value: "julia", label: "Julia" },
  { value: "perl", label: "Perl" },
  { value: "haskell", label: "Haskell" },
  { value: "elixir", label: "Elixir" },
  { value: "erlang", label: "Erlang" },
  { value: "clojure", label: "Clojure" },
  { value: "fsharp", label: "F#" },
  { value: "ocaml", label: "OCaml" },
  { value: "lua", label: "Lua" },
  { value: "groovy", label: "Groovy" },
  { value: "objectivec", label: "Objective-C" },
  { value: "vbnet", label: "Visual Basic .NET" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash / Shell" },
  { value: "powershell", label: "PowerShell" },
  { value: "solidity", label: "Solidity" },
  { value: "assembly", label: "Assembly" },
  { value: "fortran", label: "Fortran" },
  { value: "cobol", label: "COBOL" },
  { value: "pascal", label: "Pascal" },
  { value: "zig", label: "Zig" },
  { value: "nim", label: "Nim" },
  { value: "crystal", label: "Crystal" },
  { value: "racket", label: "Racket" },
  { value: "scheme", label: "Scheme" },
  { value: "vhdl", label: "VHDL" },
  { value: "verilog", label: "Verilog" },
  { value: "pseudocode", label: "Pseudocode" },
];

export function languageLabel(value: string): string {
  return CODE_LANGUAGES.find((l) => l.value === value)?.label ?? value;
}
