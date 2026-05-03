import { Config, Effect, Layer } from "effect";
import * as Context from "effect/Context";

export interface CoreApiConfigService {
  readonly port: number;
  readonly corsAllowedOrigins: readonly string[];
}

const parseCorsAllowedOrigins = (value: string): readonly string[] => {
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return origins.includes("*") ? [] : origins;
};

export class CoreApiConfig extends Context.Service<
  CoreApiConfig,
  CoreApiConfigService
>()("@acme/core-api/CoreApiConfig") {
  static readonly layer = Layer.effect(
    CoreApiConfig,
    Effect.gen(function* () {
      const port = yield* Config.int("PORT").pipe(
        Config.orElse(() => Config.succeed(4000)),
      );
      const corsAllowedOrigins = yield* Config.string(
        "CORS_ALLOWED_ORIGINS",
      ).pipe(
        Config.orElse(() => Config.succeed("*")),
        Config.map(parseCorsAllowedOrigins),
      );

      return CoreApiConfig.of({
        port,
        corsAllowedOrigins,
      });
    }),
  );
}
