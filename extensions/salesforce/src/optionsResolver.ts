import { authenticate } from "./authenticate";

/**
 * Salesforce REST API version used by the design-time options resolvers.
 * Kept in step with the default in authenticate.ts, which serves the runtime path,
 * so the two no longer drift as they did while the resolvers pinned v56.0.
 */
export const RESOLVER_API_VERSION = "62.0";

export interface IResolverOAuthConnection {
    consumerKey: string;
    consumerSecret: string;
    instanceUrl: string;
}

export interface IResolverHttpApi {
    httpRequest?: (params: any) => Promise<any>;
}

export interface IResolverOption {
    label: string;
    value: string;
}

export interface IResolverSession {
    /** Which transport produced this session, surfaced in error messages. */
    via: string;
    getJson: (path: string) => Promise<any>;
}

/**
 * Flattens an axios-style failure into one line that keeps the Salesforce response
 * body, where the actionable `error` and `error_description` fields live. On its own
 * `error.message` only yields "Request failed with status code 400".
 */
export const summariseError = (error: any): string => {
    const responseStatus = error?.response?.status;
    const responseBody = error?.response?.data;
    const detail = responseBody === undefined || responseBody === null
        ? ""
        : ` :: ${typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody)}`;
    const base = error instanceof Error ? error.message : JSON.stringify(error);

    return `[status=${responseStatus ?? "n/a"}] ${base}${detail}`;
};

export const describePath = (entityName: string): string =>
    `/services/data/v${RESOLVER_API_VERSION}/sobjects/${encodeURIComponent(entityName)}/describe`;

/**
 * Authenticates a design-time options resolver against Salesforce.
 *
 * Two transports are tried in order and the failure of each is carried into the
 * final error, so one upload settles which of them the resolver runtime allows:
 *
 * 1. `api.httpRequest`, which honours the installation's configured HTTP proxy.
 *    The credentials go in `data` as an object because that is what
 *    IHttpExecutionApiRequestParams declares. Earlier versions passed a
 *    form-urlencoded string behind a `@ts-ignore`, which is the suspected reason
 *    the dropdowns were empty while the node itself worked at runtime.
 * 2. `authenticate()`, the axios path the node already uses successfully during
 *    flow execution. Reachable only if the resolver sandbox permits outbound HTTP
 *    from bundled code, and it bypasses any configured proxy.
 */
export const openResolverSession = async (
    api: IResolverHttpApi,
    oauthConnection: IResolverOAuthConnection
): Promise<IResolverSession> => {
    const { consumerKey, consumerSecret, instanceUrl } = oauthConnection;
    const httpRequest = api?.httpRequest;
    const attempts: string[] = [];

    if (typeof httpRequest === "function") {
        try {
            const authResponse = await httpRequest({
                method: "POST",
                url: `${instanceUrl}/services/oauth2/token`,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                data: {
                    grant_type: "client_credentials",
                    client_id: consumerKey,
                    client_secret: consumerSecret
                }
            });

            const accessToken = authResponse?.data?.access_token;

            if (accessToken) {
                return {
                    via: "api.httpRequest",
                    getJson: async (path: string) => {
                        const response = await httpRequest({
                            method: "GET",
                            url: `${instanceUrl}${path}`,
                            headers: {
                                Authorization: `Bearer ${accessToken}`
                            }
                        });

                        return response?.data;
                    }
                };
            }

            attempts.push("api.httpRequest: responded without an access_token");
        } catch (error) {
            attempts.push(`api.httpRequest: ${summariseError(error)}`);
        }
    } else {
        attempts.push("api.httpRequest: not provided by the resolver runtime");
    }

    try {
        const connection = await authenticate(oauthConnection);

        return {
            via: "authenticate",
            getJson: async (path: string) => {
                const response = await connection.request({ method: "GET", url: path });

                return response?.data;
            }
        };
    } catch (error) {
        attempts.push(`authenticate: ${summariseError(error)}`);
    }

    throw new Error(`Salesforce options resolver could not authenticate. ${attempts.join(" | ")}`);
};

/**
 * Reads active picklist entries off a describe response.
 *
 * `value` is the Salesforce API value, which is what an insert expects. `label` is
 * the org's display label and may be translated, so the two differ in localised
 * orgs and must not be used interchangeably.
 */
export const picklistOptions = (describeBody: any, entityName: string, fieldName: string): IResolverOption[] => {
    const fields = describeBody?.fields || [];
    const field = fields.find((candidate: any) => candidate?.name === fieldName);

    if (!field || !Array.isArray(field.picklistValues)) {
        throw new Error(
            `${entityName}.${fieldName} is not present on the describe response. ` +
            `Check Field-Level Security for the Connected App Run As user.`
        );
    }

    return field.picklistValues
        .filter((picklistValue: any) => picklistValue?.active)
        .map((picklistValue: any) => ({
            label: picklistValue.label || picklistValue.value,
            value: picklistValue.value
        }));
};

/**
 * Reports what the resolver runtime actually handed this function.
 *
 * The point is to separate three failures that all look identical in the editor:
 * the resolver never ran, it ran without an HTTP transport, or it ran without
 * usable Connected App credentials. Only the presence and length of the key and
 * secret are reported, never their values.
 */
/**
 * Lists everything the resolver's `api` object actually carries, own properties
 * and prototype alike, with the type of each.
 *
 * The typings declare `IHttpExecutionApi` with a single optional `httpRequest`,
 * while `log` belongs to `INodeExecutionAPI`, the runtime api a node's function
 * receives. That is a statement about the declared type, not about the object
 * the resolver is handed, so the object is enumerated rather than assumed.
 */
export const apiSurface = (api: any): string => {
    if (!api || typeof api !== "object") {
        return `api is ${typeof api}`;
    }

    const names: string[] = [];
    let current = api;

    while (current && current !== Object.prototype) {
        for (const name of Object.getOwnPropertyNames(current)) {
            if (name !== "constructor" && names.indexOf(name) === -1) {
                names.push(name);
            }
        }
        current = Object.getPrototypeOf(current);
    }

    return names
        .map((name: string) => {
            try {
                return `${name}:${typeof api[name]}`;
            } catch (error) {
                return `${name}:<threw>`;
            }
        })
        .join(",") || "<no members>";
};

/**
 * Writes to the resolver's log if one turns out to be there.
 *
 * Returns what happened so the outcome can be reported through the options
 * channel, which is the only output known to reach the editor. Never throws:
 * a diagnostic must not become the failure it is meant to explain.
 */
export const tryResolverLog = (api: any, message: string): string => {
    if (!api || typeof api.log !== "function") {
        return `api.log=${typeof api?.log}(unusable)`;
    }

    try {
        api.log("error", message);

        return "api.log=called";
    } catch (error) {
        return `api.log=threw(${error instanceof Error ? error.message : "unknown"})`;
    }
};

export const probeResolverRuntime = (api: any, config: any): string => {
    const connection = config?.connection;
    const describeSecret = (value: any): string =>
        value ? `present(len=${String(value).length})` : "MISSING";

    return [
        `api=${typeof api}`,
        `apiMembers={${apiSurface(api)}}`,
        `configKeys=[${Object.keys(config || {}).join(",")}]`,
        `connection=${typeof connection}`,
        `connectionKeys=[${Object.keys(connection || {}).join(",")}]`,
        `instanceUrl=${connection?.instanceUrl || "MISSING"}`,
        `consumerKey=${describeSecret(connection?.consumerKey)}`,
        `consumerSecret=${describeSecret(connection?.consumerSecret)}`
    ].join(" ");
};

/**
 * Characters kept in an option label. Returned options are validated against a
 * schema and invalid ones are silently ignored, which renders as "no options",
 * so labels are reduced to a conservative set and a short length.
 */
const LABEL_UNSAFE = /[^A-Za-z0-9 .,:;_/@()=+-]/g;

const toDiagnosticOptions = (detail: string): IResolverOption[] => {
    const cleaned = String(detail).replace(LABEL_UNSAFE, " ").replace(/\s+/g, " ").trim();
    const chunks = cleaned.match(/.{1,38}/g) || ["no detail"];

    return [{ label: "DIAG read the entries below", value: "d0" }].concat(
        chunks.slice(0, 12).map((chunk: string, index: number) => ({
            label: `${index + 1} ${chunk}`,
            value: `d${index + 1}`
        }))
    );
};

/**
 * Runs an options resolver so that it always returns a schema-valid array.
 *
 * Everything runs inside the guard, the diagnostic build is itself guarded, and
 * an empty or malformed result is replaced rather than returned. A resolver that
 * throws shows only "error loading select options" and a resolver returning
 * invalid options shows "no options"; both discard the reason, so neither is
 * allowed to happen.
 */
export const safeResolve = async (
    work: () => Promise<IResolverOption[]>,
    context: () => string
): Promise<IResolverOption[]> => {
    try {
        const options = await work();

        if (Array.isArray(options) && options.length > 0) {
            return options
                .filter((option: any) => option && option.value !== undefined && option.value !== null)
                .map((option: any) => ({
                    label: String(option.label === undefined || option.label === null ? option.value : option.label).slice(0, 120),
                    value: String(option.value)
                }));
        }

        return toDiagnosticOptions("EMPTY Salesforce returned no usable values");
    } catch (error) {
        let detail: string;

        try {
            detail = `${context()} ERROR ${summariseError(error)}`;
        } catch (contextError) {
            detail = `diagnostic failed ${contextError instanceof Error ? contextError.message : "unknown"}`;
        }

        return toDiagnosticOptions(detail);
    }
};
