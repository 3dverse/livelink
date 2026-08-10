/**
 * A JSON Schema, as a plain JSON object.
 *
 * @category Data
 */
export type JsonSchema = Record<string, unknown>;

/**
 * Minimal structural view of the ajv module, avoiding a hard type dependency on its dual
 * (ESM/CJS) type declarations.
 *
 * @internal
 */
type AjvValidateFn = ((payload: unknown) => boolean) & { errors?: unknown };
type AjvLike = {
    compile(schema: object): AjvValidateFn;
    errorsText(errors?: unknown): string;
};
type AjvConstructor = new (options?: object) => AjvLike;

/**
 * The outcome of validating a payload.
 *
 * @inline
 * @internal
 */
export type ValidationResult = { valid: true } | { valid: false; errors: string };

/**
 * Validates event payloads against a JSON Schema.
 *
 * Requires the optional dependency `ajv`, loaded lazily by {@link SchemaValidator.create} — the
 * rest of the data module works without it when no schema is configured.
 *
 * @internal
 */
export class SchemaValidator {
    /**
     * The validation function.
     *
     * @param payload The payload to validate.
     * @returns `true` if the payload is valid, `false` otherwise.
     */
    readonly #validate: (payload: unknown) => boolean;

    /**
     * Returns a human-readable string of the last validation errors.
     *
     * @returns A string describing the last validation errors.
     */
    readonly #errorsText: () => string;

    /**
     * Compile a validator for a schema.
     *
     * @throws If `ajv` is not installed or the schema does not compile.
     */
    static async create({ schema }: { schema: JsonSchema }): Promise<SchemaValidator> {
        let ajv_module: { default?: AjvConstructor };
        try {
            ajv_module = (await import("ajv")) as unknown as { default?: AjvConstructor };
        } catch {
            throw new Error(
                'Event schema validation requires the optional dependency "ajv". Install it with `npm install ajv`.',
            );
        }

        // Depending on the module system the default export is either on `.default` or is the
        // module itself.
        const Ajv = ajv_module.default ?? (ajv_module as unknown as AjvConstructor);
        const ajv = new Ajv({ allErrors: true });
        const validate = ajv.compile(schema);
        return new SchemaValidator({
            validate: payload => validate(payload),
            errorsText: () => ajv.errorsText(validate.errors),
        });
    }

    /**
     *
     */
    private constructor({
        validate,
        errorsText,
    }: {
        validate: (payload: unknown) => boolean;
        errorsText: () => string;
    }) {
        this.#validate = validate;
        this.#errorsText = errorsText;
    }

    /**
     * Validate a payload against the schema.
     */
    validate(payload: unknown): ValidationResult {
        if (this.#validate(payload)) {
            return { valid: true };
        }
        return { valid: false, errors: this.#errorsText() };
    }
}
