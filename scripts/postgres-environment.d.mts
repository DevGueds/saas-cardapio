export function setEnvironmentValue(contents: string, key: string, value: string): string
export function configurePostgresEnvironment(
  contents: string,
  secret: () => string,
): { contents: string; upgraded: boolean }
