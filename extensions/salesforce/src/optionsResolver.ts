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
