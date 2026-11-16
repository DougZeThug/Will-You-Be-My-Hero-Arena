// Minimal `--name value` option lookup shared by the capture/review scripts.
// Deliberately not util.parseArgs: unknown flags and missing values must keep
// the lenient behaviour these scripts always had.
export const cliOption = (args, name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
