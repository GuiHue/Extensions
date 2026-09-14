import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";
import { authenticate } from "../authenticate";
import { escapeSoqlString } from "../soql";
import { describePath, diagnosticOptions, openResolverSession, picklistOptions, probeResolverRuntime, summariseError, tryResolverLog } from "../optionsResolver";

export interface ICreateCaseParams extends INodeFunctionBaseParams {
    config: {
        connection: {
            consumerKey: string;
            consumerSecret: string;
            instanceUrl: string;
        };
        Status: string;
        Origin: string;
        Subject: string;
        Description: string;
        additionalCaseDetails: object;
        storeLocation: string;
        contextKey: string;
        inputKey: string;
    };
}

interface SalesforceCase {
    Id: string;
    CaseNumber: string;
}

export const createCaseNode = createNodeDescriptor({
    type: "createCase",
    defaultLabel: {
        deDE: "Case erstellen",
        default: "Create Case",
    },
    summary: {
        deDE: "Erstelle einen detaillierten Salesforce Case",
        default: "Create a detailed Salesforce Case",
    },
    fields: [
        {
            key: "connection",
            label: {
                deDE: "Salesforce Connected App",
                default: "Salesforce Connected App",
            },
            type: "connection",
            params: {
                connectionType: "oauth",
                required: true
            }
        },
        {
            key: "Status",
            type: "select",
            label: {
                deDE: "Status",
                default: "Status",
            },
            params: {
                required: true
            },
            optionsResolver: {
                dependencies: ["connection"],
                resolverFunction: async ({ api, config }) => {
                    const probe = probeResolverRuntime(api, config);
                    const logged = tryResolverLog(api, `Cognigy Salesforce resolver probe: ${probe}`);

                    try {
                        const session = await openResolverSession(api, config?.connection);
                        const describeBody = await session.getJson(describePath("Case"));

                        return picklistOptions(describeBody, "Case", "Status");
                    } catch (error) {
                        tryResolverLog(api, `Cognigy Salesforce resolver failed: ${probe} ERROR=${summariseError(error)}`);

                        return diagnosticOptions(
                            "Case.Status did not load - read the entries below",
                            `${probe} ${logged} ERROR=${summariseError(error)}`
                        );
                    }
                }
            }
        },
        {
            key: "Origin",
            type: "select",
            label: {
                deDE: "Herkunft",
                default: "Origin"
            },
            params: {
                required: true
            },
            optionsResolver: {
                dependencies: ["connection"],
                resolverFunction: async ({ api, config }) => {
                    const probe = probeResolverRuntime(api, config);
                    const logged = tryResolverLog(api, `Cognigy Salesforce resolver probe: ${probe}`);

                    try {
                        const session = await openResolverSession(api, config?.connection);
                        const describeBody = await session.getJson(describePath("Case"));

                        return picklistOptions(describeBody, "Case", "Origin");
                    } catch (error) {
                        tryResolverLog(api, `Cognigy Salesforce resolver failed: ${probe} ERROR=${summariseError(error)}`);

                        return diagnosticOptions(
                            "Case.Origin did not load - read the entries below",
                            `${probe} ${logged} ERROR=${summariseError(error)}`
                        );
                    }
                }
            }
        },
        {
            key: "Subject",
            type: "cognigyText",
            label: {
                deDE: "Betreff",
                default: "Subject"
            },
            defaultValue: "",
            params: {
                required: true
            },
        },
        {
            key: "Description",
            type: "cognigyText",
            label: {
                deDE: "Beschreibung",
                default: "Description"
            },
            defaultValue: "{{input.text}}",
            params: {
                required: true
            },
        },
        {
            key: "additionalCaseDetails",
            type: "json",
            label: {
                deDE: "Weitere Case Details",
                default: "Additional Case Details"
            },
            defaultValue: `{}`,
        },
        {
            key: "storeLocation",
            type: "select",
            label: {
                deDE: "Ergebnisspeicherung",
                default: "Where to store the result"
            },
            defaultValue: "input",
            params: {
                options: [
                    {
                        label: "Input",
                        value: "input"
                    },
                    {
                        label: "Context",
                        value: "context"
                    }
                ],
                required: true
            },
        },
        {
            key: "inputKey",
            type: "text",
            label: {
                deDE: "Input Schlüssel für Ergebnisspeicherung",
                default: "Input Key to store Result"
            },
            defaultValue: "salesforce.case",
            condition: {
                key: "storeLocation",
                value: "input"
            }
        },
        {
            key: "contextKey",
            type: "text",
            label: {
                deDE: "Context Schlüssel für Ergebnisspeicherung",
                default: "Context Key to store Result"
            },
            defaultValue: "salesforce.case",
            condition: {
                key: "storeLocation",
                value: "context"
            }
        },
    ],
    sections: [
        {
            key: "storage",
            label: {
                deDE: "Ergebnisspeicherung",
                default: "Storage Option"
            },
            defaultCollapsed: true,
            fields: [
                "storeLocation",
                "inputKey",
                "contextKey",
            ]
        },
        {
            key: "advanced",
            label: {
                deDE: "Erweitert",
                default: "Advanced"
            },
            defaultCollapsed: true,
            fields: ["additionalCaseDetails"]
        },
    ],
    form: [
        { type: "field", key: "connection" },
        { type: "field", key: "Status" },
        { type: "field", key: "Origin" },
        { type: "field", key: "Subject" },
        { type: "field", key: "Description" },
        { type: "section", key: "advanced" },
        { type: "section", key: "storage" },
    ],
    appearance: {
        color: "#009EDB"
    },
    dependencies: {
        children: [
            "onSuccessCreateCase",
            "onErrorCreateCase"
        ]
    },
    function: async ({ cognigy, config, childConfigs }: ICreateCaseParams) => {
        const { api } = cognigy;
        const { Status, Origin, Subject, Description, additionalCaseDetails, connection, storeLocation, contextKey, inputKey } = config;

        try {

            const salesforceConnection = await authenticate(connection);

            // Single record creation
            const record = await salesforceConnection.sobject("Case").create({
                Status,
                Origin,
                Subject,
                Description,
                ...additionalCaseDetails
            });

            const recordId: string = escapeSoqlString(record?.id);
            const queryRecord = await salesforceConnection.query(`SELECT Id, CaseNumber from Case Where Id = '${recordId}'`);

            const onSuccessChild = childConfigs.find(child => child.type === "onSuccessCreateCase");
            api.setNextNode(onSuccessChild.id);

            if (storeLocation === "context") {
                api.addToContext(contextKey, queryRecord?.records[0], "simple");
            } else {
                // @ts-ignore
                api.addToInput(inputKey, queryRecord?.records[0]);
            }

        } catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : JSON.stringify(error);
            api.log("error", `createCase execution failed: ${errorMessage}`);

            const onErrorChild = childConfigs.find(child => child.type === "onErrorCreateCase");
            api.setNextNode(onErrorChild.id);

            if (storeLocation === "context") {
                api.addToContext(contextKey, errorMessage, "simple");
            } else {
                // @ts-ignore
                api.addToInput(inputKey, errorMessage);
            }
        }
    }
});

export const onSuccessCreateCase = createNodeDescriptor({
    type: "onSuccessCreateCase",
    parentType: "createCase",
    defaultLabel: "On Success",
    constraints: {
        editable: false,
        deletable: false,
        creatable: false,
        movable: false,
        placement: {
            predecessor: {
                whitelist: []
            }
        }
    },
    appearance: {
        color: "#61d188",
        textColor: "white",
        variant: "mini",
        showIcon: false
    }
});

export const onErrorCreateCase = createNodeDescriptor({
    type: "onErrorCreateCase",
    parentType: "createCase",
    defaultLabel: "On Error",
    constraints: {
        editable: false,
        deletable: false,
        creatable: false,
        movable: false,
        placement: {
            predecessor: {
                whitelist: []
            }
        }
    },
    appearance: {
        color: "#cf142b",
        textColor: "white",
        variant: "mini",
        showIcon: false
    }
});